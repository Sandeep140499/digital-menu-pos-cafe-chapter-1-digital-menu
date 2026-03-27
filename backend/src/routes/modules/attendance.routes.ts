import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { getBusinessDayRange } from '../../utils/businessDay.js';

export const attendanceRouter = Router();

const attendanceQuerySchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  employeeName: z.string().optional(),
});

// Admin: attendance summary (Present/Absent/On Leave) using 04:00 AM business-day boundary
attendanceRouter.get('/summary', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = attendanceQuerySchema.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end < start) {
    return res.status(400).json({ message: 'Invalid date range' });
  }
  const nameQuery = (parsed.data.employeeName || '').trim().toLowerCase();

  const employees = await prisma.employee.findMany({
    where: {
      status: 'ACTIVE' as any,
      ...(nameQuery ? { name: { contains: nameQuery, mode: 'insensitive' } } : {}),
    },
    select: { id: true, name: true, branchId: true },
    orderBy: { name: 'asc' },
    take: 500,
  });

  // Preload leaves overlapping range
  const leaves = await prisma.employeeLeave.findMany({
    where: {
      status: 'APPROVED' as any,
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { employeeId: true, startDate: true, endDate: true },
  });

  const leavesByEmployee = new Map<number, Array<{ start: Date; end: Date }>>();
  for (const l of leaves) {
    const arr = leavesByEmployee.get(l.employeeId) ?? [];
    arr.push({ start: l.startDate, end: l.endDate });
    leavesByEmployee.set(l.employeeId, arr);
  }

  // Build list of business days
  const days: Array<{ dateKey: string; start: Date; end: Date }> = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const r = getBusinessDayRange({ date: new Date(d), boundaryHour: 4 });
    days.push({ dateKey: r.dateKey, start: r.start, end: r.end });
  }

  const shiftRows = await prisma.employeeShift.findMany({
    where: {
      employeeId: { in: employees.map(e => e.id) },
      shiftStart: { gte: days[0].start, lte: days[days.length - 1].end },
    },
    select: { employeeId: true, shiftStart: true },
  });

  const shiftsByEmployee = new Map<number, Date[]>();
  for (const s of shiftRows) {
    const arr = shiftsByEmployee.get(s.employeeId) ?? [];
    arr.push(s.shiftStart);
    shiftsByEmployee.set(s.employeeId, arr);
  }

  const records = employees.map(e => {
    const empLeaves = leavesByEmployee.get(e.id) ?? [];
    const empShifts = shiftsByEmployee.get(e.id) ?? [];
    const perDay = days.map(day => {
      const onLeave = empLeaves.some(l => {
        const sd = new Date(l.start);
        const ed = new Date(l.end);
        sd.setHours(0, 0, 0, 0);
        ed.setHours(23, 59, 59, 999);
        const key = new Date(day.dateKey);
        return key >= sd && key <= ed;
      });
      if (onLeave) return { date: day.dateKey, status: 'ON_LEAVE' as const };
      const present = empShifts.some(t => t >= day.start && t <= day.end);
      return { date: day.dateKey, status: present ? ('PRESENT' as const) : ('ABSENT' as const) };
    });
    const summary = perDay.reduce(
      (acc, p) => {
        if (p.status === 'PRESENT') acc.present += 1;
        else if (p.status === 'ABSENT') acc.absent += 1;
        else acc.onLeave += 1;
        return acc;
      },
      { present: 0, absent: 0, onLeave: 0 }
    );
    return { employee: e, perDay, summary };
  });

  return res.json({ days: days.map(d => d.dateKey), records });
});
