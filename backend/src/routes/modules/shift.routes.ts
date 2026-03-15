import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";

const startShiftSchema = z.object({
  branchId: z.number().int().optional(), // optional: if omitted, use employee's branchId from DB
});

export const shiftRouter = Router();

// Employee: get current shift status (active or not)
shiftRouter.get(
  "/current",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const employeeId = req.user!.id;
    const activeShift = await prisma.employeeShift.findFirst({
      where: { employeeId, shiftEnd: null },
      include: { orders: { select: { id: true } } },
    });
    return res.json({
      active: !!activeShift,
      shift: activeShift
        ? {
            id: activeShift.id,
            branchId: activeShift.branchId,
            shiftStart: activeShift.shiftStart,
            shiftEnd: activeShift.shiftEnd,
            totalHours: activeShift.totalHours,
            totalSales: activeShift.totalSales ?? 0,
            ordersCount: activeShift.orders.length,
            status: (activeShift as any).status ?? "ACTIVE",
            pauseCount: (activeShift as any).pauseCount ?? 0,
            lastPauseAt: (activeShift as any).lastPauseAt ?? null,
          }
        : null,
    });
  },
);

// Employee: get own shift history (with daily totals)
shiftRouter.get(
  "/my-history",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const employeeId = req.user!.id;

    const shifts = await prisma.employeeShift.findMany({
      where: { employeeId },
      orderBy: { shiftStart: "desc" },
      take: 60,
      select: {
        id: true,
        branchId: true,
        shiftStart: true,
        shiftEnd: true,
        totalHours: true,
        totalSales: true,
        status: true,
        pauseCount: true,
        lastPauseAt: true,
      },
    });

    // Daily totals (by shiftStart date)
    const dailyStats = new Map<string, { date: string; totalHours: number; totalSales: number; shifts: number }>();
    for (const shift of shifts) {
      const date = shift.shiftStart.toISOString().slice(0, 10);
      if (!dailyStats.has(date)) {
        dailyStats.set(date, { date, totalHours: 0, totalSales: 0, shifts: 0 });
      }
      const stats = dailyStats.get(date)!;
      stats.totalHours += shift.totalHours || 0;
      stats.totalSales += shift.totalSales || 0;
      stats.shifts += 1;
    }

    return res.json({
      shifts,
      dailyStats: Array.from(dailyStats.values()),
    });
  },
);

// Employee: pause shift (status indicator only; hours continue counting)
shiftRouter.post(
  "/pause",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const employeeId = req.user!.id;
    const shift = await prisma.employeeShift.findFirst({
      where: { employeeId, shiftEnd: null },
    });
    if (!shift) return res.status(400).json({ message: "No active shift" });

    const updated = await prisma.employeeShift.update({
      where: { id: shift.id },
      data: {
        status: "PAUSED" as any,
        pauseCount: { increment: 1 },
        lastPauseAt: new Date(),
      },
    });

    return res.json(updated);
  },
);

// Employee: resume shift
shiftRouter.post(
  "/resume",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const employeeId = req.user!.id;
    const shift = await prisma.employeeShift.findFirst({
      where: { employeeId, shiftEnd: null },
    });
    if (!shift) return res.status(400).json({ message: "No active shift" });

    const updated = await prisma.employeeShift.update({
      where: { id: shift.id },
      data: { status: "ACTIVE" as any },
    });

    return res.json(updated);
  },
);

// Employee: start shift (uses employee's branchId from DB so foreign key always valid)
shiftRouter.post(
  "/start",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const parsed = startShiftSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const employeeId = req.user!.id;

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { branchId: true, shiftStartTime: true },
    });
    if (!employee) {
      return res.status(404).json({ message: "Employee not found" });
    }
    // Always use employee's branchId so foreign key is always valid (ignore client branchId)
    const branchId = employee.branchId;
    if (branchId == null || typeof branchId !== "number") {
      return res.status(400).json({ message: "Employee has no branch assigned. Contact admin." });
    }
    const branchExists = await prisma.branch.findUnique({ where: { id: branchId }, select: { id: true } });
    if (!branchExists) {
      return res.status(400).json({ message: "Branch not found. Contact admin." });
    }

    const activeShift = await prisma.employeeShift.findFirst({
      where: { employeeId, shiftEnd: null },
      include: { orders: { select: { id: true } } },
    });
    if (activeShift) {
      return res.status(200).json({
        id: activeShift.id,
        branchId: activeShift.branchId,
        shiftStart: activeShift.shiftStart,
        shiftEnd: activeShift.shiftEnd,
        totalHours: activeShift.totalHours,
        totalSales: activeShift.totalSales ?? 0,
        ordersCount: activeShift.orders.length,
        status: (activeShift as any).status ?? "ACTIVE",
        pauseCount: (activeShift as any).pauseCount ?? 0,
        lastPauseAt: (activeShift as any).lastPauseAt ?? null,
      });
    }

    // One shift per day: if employee already ended a shift today, they cannot start again until next day
    const todayStr = new Date().toISOString().slice(0, 10);
    const completedToday = await prisma.employeeShift.findMany({
      where: { employeeId, shiftEnd: { not: null } },
      select: { shiftEnd: true },
    });
    const hasEndedShiftToday = completedToday.some(
      (s) => s.shiftEnd && s.shiftEnd.toISOString().slice(0, 10) === todayStr
    );
    if (hasEndedShiftToday) {
      return res.status(400).json({
        message: "You already completed a shift today. You can start again tomorrow.",
      });
    }

    const shiftStartTime = new Date();
    const shift = await prisma.employeeShift.create({
      data: {
        employeeId,
        branchId,
        shiftStart: shiftStartTime,
        status: "ACTIVE" as any,
      },
    });

    // Late entry: if employee has scheduled shiftStartTime and logged in after it
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        select: { shiftStartTime: true },
      });
      if (employee?.shiftStartTime) {
        const dateStr = shiftStartTime.toLocaleDateString("en-CA", { timeZone: process.env.TZ || "Asia/Kolkata" });
        const [y, m, d] = dateStr.split("-").map(Number);
        const [hr, min] = employee.shiftStartTime.split(":").map(Number);
        const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
        const scheduledUtc = Date.UTC(y, m - 1, d, hr, min ?? 0, 0, 0) - IST_OFFSET_MS;
        const scheduledStart = new Date(scheduledUtc);
        if (shiftStartTime.getTime() > scheduledStart.getTime()) {
          const lateDurationMinutes = Math.floor((shiftStartTime.getTime() - scheduledStart.getTime()) / 60000);
          await prisma.lateEntry.create({
            data: {
              employeeId,
              date: new Date(Date.UTC(y, m - 1, d)),
              shiftStartTime: employee.shiftStartTime,
              actualLoginTime: shiftStartTime,
              lateDurationMinutes,
              shiftId: shift.id,
            },
          });
        }
      }
    } catch (lateErr) {
      console.error("Late entry create failed:", lateErr);
    }

    return res.status(201).json({
      id: shift.id,
      branchId: shift.branchId,
      shiftStart: shift.shiftStart,
      shiftEnd: shift.shiftEnd,
      totalHours: shift.totalHours,
      totalSales: shift.totalSales ?? 0,
      ordersCount: 0,
      status: (shift as any).status ?? "ACTIVE",
      pauseCount: (shift as any).pauseCount ?? 0,
      lastPauseAt: (shift as any).lastPauseAt ?? null,
    });
  },
);

// Employee: end shift
shiftRouter.post(
  "/end",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const employeeId = req.user!.id;

    const shift = await prisma.employeeShift.findFirst({
      where: { employeeId, shiftEnd: null },
      include: { employee: true },
    });

    if (!shift) {
      return res.status(400).json({ message: "No active shift" });
    }

    const shiftEnd = new Date();
    const { endShiftAndCreateOvertimeIfNeeded } = await import("../../services/shiftAutoClose.js");
    await endShiftAndCreateOvertimeIfNeeded(shift.id, shiftEnd, "Normal End");

    const completedShift = await prisma.employeeShift.findUnique({
      where: { id: shift.id },
    });

    return res.json({
      id: completedShift!.id,
      branchId: completedShift!.branchId,
      shiftStart: completedShift!.shiftStart,
      shiftEnd: completedShift!.shiftEnd,
      totalHours: completedShift!.totalHours,
      totalSales: completedShift!.totalSales ?? 0,
      status: (completedShift as any).status ?? "ENDED",
    });
  },
);

// Admin: get currently active shifts (employees on shift right now) with optional late entry info
shiftRouter.get(
  "/active",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const activeShifts = await prisma.employeeShift.findMany({
      where: { shiftEnd: null },
      orderBy: { shiftStart: "asc" },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, status: true, shiftStartTime: true } },
        branch: { select: { id: true, name: true, location: true } },
        orders: { select: { id: true, totalAmount: true, paymentStatus: true } },
      },
    });
    const shiftIds = activeShifts.map((s) => s.id);
    const lateEntries = shiftIds.length > 0
      ? await prisma.lateEntry.findMany({ where: { shiftId: { in: shiftIds } } })
      : [];
    const lateByShiftId = new Map(lateEntries.map((le) => [le.shiftId!, le]));
    const now = Date.now();
    const normalized = activeShifts.map((s) => {
      const liveHours = (now - s.shiftStart.getTime()) / (1000 * 60 * 60);
      const totalSales = (s.orders || []).filter((o: any) => o.paymentStatus === "PAID").reduce((sum: number, o: any) => sum + (o.totalAmount || 0), 0);
      const late = lateByShiftId.get(s.id);
      let lateInfo: { scheduledStart: Date; actualLogin: Date; lateMinutes: number } | null = null;
      if (late) {
        const day = new Date(late.date);
        const [h = 0, m = 0] = late.shiftStartTime.split(":").map(Number);
        day.setHours(h, m, 0, 0);
        lateInfo = { scheduledStart: day, actualLogin: late.actualLoginTime, lateMinutes: late.lateDurationMinutes };
      }
      return {
        id: s.id,
        shiftStart: s.shiftStart,
        status: (s as any).status ?? "ACTIVE",
        totalHours: liveHours,
        totalSales: s.totalSales ?? totalSales,
        ordersCount: (s.orders || []).length,
        employee: s.employee,
        branch: s.branch,
        late: lateInfo,
      };
    });
    return res.json({ shifts: normalized });
  },
);

// Admin: get shift history with filters
shiftRouter.get(
  "/history",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const { employeeId, startDate, endDate } = req.query;
    
    let dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.shiftStart = {};
      if (startDate) {
        dateFilter.shiftStart.gte = new Date(startDate as string);
      }
      if (endDate) {
        const end = new Date(endDate as string);
        end.setHours(23, 59, 59, 999);
        dateFilter.shiftStart.lte = end;
      }
    }

    const shifts = await prisma.employeeShift.findMany({
      where: {
        ...dateFilter,
        ...(employeeId ? { employeeId: Number(employeeId) } : {}),
      },
      orderBy: { shiftStart: "desc" },
      include: {
        employee: {
          select: { id: true, name: true, email: true, employeeCode: true, status: true },
        },
        orders: {
          select: { id: true, totalAmount: true, paymentStatus: true },
        },
        branch: { select: { id: true, name: true, location: true } },
      },
    });

    const now = Date.now();
    const normalized = shifts.map((s) => {
      const status = (s as any).status ?? (s.shiftEnd ? "ENDED" : "ACTIVE");
      const liveHours = s.shiftEnd
        ? s.totalHours || 0
        : (now - s.shiftStart.getTime()) / (1000 * 60 * 60);
      return {
        ...s,
        status,
        totalHours: s.shiftEnd ? s.totalHours : liveHours,
      };
    });

    // Calculate daily stats
    const dailyStats = new Map();
    for (const shift of normalized) {
      const date = shift.shiftStart.toISOString().slice(0, 10);
      if (!dailyStats.has(date)) {
        dailyStats.set(date, {
          date,
          totalHours: 0,
          totalSales: 0,
          shifts: 0,
        });
      }
      const stats = dailyStats.get(date);
      stats.totalHours += shift.totalHours || 0;
      stats.totalSales += shift.totalSales || 0;
      stats.shifts += 1;
    }

    return res.json({
      shifts: normalized,
      summary: {
        totalShifts: normalized.length,
        totalHours: normalized.reduce((sum, s) => sum + (s.totalHours || 0), 0),
        totalSales: normalized.reduce((sum, s) => sum + (s.totalSales || 0), 0),
      },
      dailyStats: Array.from(dailyStats.values()),
    });
  },
);

