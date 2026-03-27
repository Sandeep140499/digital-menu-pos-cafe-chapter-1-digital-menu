/**
 * Auto-close open shifts at 04:00 AM (Asia/Kolkata) and create overtime records when worked > workingHoursPerDay.
 */
import { prisma } from '../config/prisma.js';
import { getBusinessDayRange } from '../utils/businessDay.js';

const TIMEZONE = process.env.TZ || 'Asia/Kolkata';
const DEFAULT_WORKING_HOURS = 8;
const AUTO_CLOSE_ENABLED =
  String(process.env.AUTO_CLOSE_SHIFTS || 'true').toLowerCase() !== 'false';

function getShiftDateInTimezone(shiftStart: Date): Date {
  const dateStr = shiftStart.toLocaleDateString('en-CA', { timeZone: TIMEZONE });
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export async function endShiftAndCreateOvertimeIfNeeded(
  shiftId: number,
  shiftEnd: Date,
  endReason: string
): Promise<void> {
  const shift = await prisma.employeeShift.findUnique({
    where: { id: shiftId },
    include: { employee: true },
  });
  if (!shift || shift.shiftEnd != null) return;

  const totalHours = (shiftEnd.getTime() - shift.shiftStart.getTime()) / (1000 * 60 * 60);

  await prisma.employeeShift.update({
    where: { id: shiftId },
    data: {
      shiftEnd,
      totalHours,
      status: 'ENDED',
      endReason,
    },
  });

  // Any in-progress orders should be unassigned so other staff can accept.
  // This ensures auto-close behaves the same as a normal end shift.
  try {
    await prisma.order.updateMany({
      where: {
        shiftId,
        status: { in: ['NEW_ORDER', 'ACCEPTED', 'PREPARING', 'SERVED'] as any },
      },
      data: {
        employeeId: null,
        shiftId: null,
        status: 'NEW_ORDER' as any,
      },
    });
  } catch {
    // Non-fatal; shift still ended.
  }

  const requiredHours = shift.employee.workingHoursPerDay ?? DEFAULT_WORKING_HOURS;
  if (totalHours > requiredHours) {
    const overtimeHours = Math.round((totalHours - requiredHours) * 100) / 100;
    const shiftDate = getShiftDateInTimezone(shift.shiftStart);
    await prisma.employeeOvertime.create({
      data: {
        employeeId: shift.employeeId,
        shiftId,
        employeeName: shift.employee.name,
        role: shift.employee.role ?? null,
        shiftDate,
        shiftStart: shift.shiftStart,
        shiftEnd,
        totalHours: Math.round(totalHours * 100) / 100,
        overtimeHours,
        reason: endReason,
        status: 'PENDING',
      },
    });
  }
}

export async function runAutoCloseAt4AM(): Promise<number> {
  if (!AUTO_CLOSE_ENABLED) return 0;
  // Close only when the *current* instant is in a later business day than the shift's start
  // (same rule as dateKey in getBusinessDayRange). End time = 04:00 at the start of "now"'s business day.
  // Do not use shiftStart < todayBoundary alone — Intl "hour 24" bugs and boundary math can close too early.
  const now = new Date();
  const { dateKey: nowKey, start: boundaryAtStartOfNowsBusinessDay } = getBusinessDayRange({
    date: now,
    boundaryHour: 4,
    timeZone: TIMEZONE,
  });

  const openShifts = await prisma.employeeShift.findMany({
    where: { shiftEnd: null },
    include: { employee: true },
  });

  let closed = 0;
  for (const shift of openShifts) {
    const { dateKey: shiftKey } = getBusinessDayRange({
      date: shift.shiftStart,
      boundaryHour: 4,
      timeZone: TIMEZONE,
    });
    if (shiftKey >= nowKey) continue;

    try {
      await endShiftAndCreateOvertimeIfNeeded(
        shift.id,
        boundaryAtStartOfNowsBusinessDay,
        'Auto Closed'
      );
      closed++;
    } catch (e) {
      console.error('Auto-close shift failed:', shift.id, e);
    }
  }
  if (closed > 0) {
    console.log(`[Auto-close] Closed ${closed} shift(s) at 04:00 ${TIMEZONE}`);
  }
  return closed;
}

export function startAutoCloseCron(): void {
  if (!AUTO_CLOSE_ENABLED) return;
  // Run frequently so we never miss 04:00 due to cold starts. Cheap query with index-friendly filters.
  const intervalMs = 5 * 60 * 1000;
  // Run once shortly after boot too.
  setTimeout(() => {
    runAutoCloseAt4AM().catch(e => console.error('Auto-close cron error:', e));
  }, 15 * 1000);
  setInterval(() => {
    runAutoCloseAt4AM().catch(e => console.error('Auto-close cron error:', e));
  }, intervalMs);
}
