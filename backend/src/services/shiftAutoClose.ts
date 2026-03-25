/**
 * Auto-close open shifts at 04:00 AM (Asia/Kolkata) and create overtime records when worked > workingHoursPerDay.
 */
import { prisma } from "../config/prisma.js";

const TIMEZONE = process.env.TZ || "Asia/Kolkata";
const DEFAULT_WORKING_HOURS = 8;
const AUTO_CLOSE_HOUR = 4;
const AUTO_CLOSE_MINUTE = 0;

function is4AMInTimezone(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour === AUTO_CLOSE_HOUR && minute === AUTO_CLOSE_MINUTE;
}

function getShiftDateInTimezone(shiftStart: Date): Date {
  const dateStr = shiftStart.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const [y, m, d] = dateStr.split("-").map(Number);
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

  const totalHours =
    (shiftEnd.getTime() - shift.shiftStart.getTime()) / (1000 * 60 * 60);

  await prisma.employeeShift.update({
    where: { id: shiftId },
    data: {
      shiftEnd,
      totalHours,
      status: "ENDED",
      endReason,
    },
  });

  // Any in-progress orders should be unassigned so other staff can accept.
  // This ensures auto-close behaves the same as a normal end shift.
  try {
    await prisma.order.updateMany({
      where: {
        shiftId,
        status: { in: ["NEW_ORDER", "ACCEPTED", "PREPARING", "SERVED"] as any },
      },
      data: {
        employeeId: null,
        shiftId: null,
        status: "NEW_ORDER" as any,
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
        status: "PENDING",
      },
    });
  }
}

export async function runAutoCloseAt4AM(): Promise<number> {
  const openShifts = await prisma.employeeShift.findMany({
    where: { shiftEnd: null },
    include: { employee: true },
  });

  if (openShifts.length === 0) return 0;

  const now = new Date();
  let closed = 0;
  for (const shift of openShifts) {
    try {
      await endShiftAndCreateOvertimeIfNeeded(shift.id, now, "Auto Closed");
      closed++;
    } catch (e) {
      console.error("Auto-close shift failed:", shift.id, e);
    }
  }
  if (closed > 0) {
    console.log(`[Auto-close] Closed ${closed} shift(s) at 04:00 ${TIMEZONE}`);
  }
  return closed;
}

let lastMinute = -1;

export function startAutoCloseCron(): void {
  setInterval(() => {
    const now = new Date();
    const minute = now.getMinutes();
    if (minute === lastMinute) return;
    lastMinute = minute;
    if (!is4AMInTimezone()) return;
    runAutoCloseAt4AM().catch((e) => console.error("Auto-close cron error:", e));
  }, 60 * 1000);
}
