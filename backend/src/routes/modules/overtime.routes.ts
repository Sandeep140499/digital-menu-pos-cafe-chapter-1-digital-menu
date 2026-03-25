import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import type { EmployeeShift, Employee } from "@prisma/client";

export const overtimeRouter = Router();

const DEFAULT_WORKING_HOURS = 8;
const TIMEZONE = process.env.TZ || "Asia/Kolkata";

type ShiftWithEmployee = EmployeeShift & { employee: Pick<Employee, "id" | "name" | "role" | "workingHoursPerDay"> };

/** Parse YYYY-MM-DD to Date at start of day UTC. Invalid or DD-MM-YYYY returns null. */
function parseDateFilter(value: string): Date | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(trimmed);
  if (iso) {
    const d = new Date(trimmed + "T00:00:00.000Z");
    return isNaN(d.getTime()) ? null : d;
  }
  const ddmmyy = /^(\d{1,2})-(\d{1,2})-(\d{4})$/.exec(trimmed);
  if (ddmmyy) {
    const [, day, month, year] = ddmmyy;
    const d = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** Shift start date in branch timezone (for filter comparison). */
function getShiftDateInTimezone(shiftStart: Date): Date {
  const dateStr = shiftStart.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// Admin: list overtime records with filters (dateFrom, dateTo, employeeId) + live running overtime
overtimeRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { dateFrom, dateTo, employeeId } = req.query;

      const where: { shiftDate?: { gte?: Date; lte?: Date }; employeeId?: number } = {};

      const fromDate = parseDateFilter(dateFrom as string);
      const toDate = parseDateFilter(dateTo as string);
      if (fromDate) {
        where.shiftDate = where.shiftDate ?? {};
        (where.shiftDate as { gte?: Date }).gte = fromDate;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setUTCDate(end.getUTCDate() + 1);
        end.setUTCMilliseconds(-1);
        where.shiftDate = where.shiftDate ?? {};
        (where.shiftDate as { lte?: Date }).lte = end;
      }
      const empId = employeeId as string;
      if (empId && empId !== "all" && empId !== "") {
        const id = Number(empId);
        if (!Number.isNaN(id)) where.employeeId = id;
      }

      const records = await prisma.employeeOvertime.findMany({
        where,
        orderBy: [{ shiftDate: "desc" }, { shiftStart: "desc" }],
        include: {
          employee: { select: { id: true, name: true, employeeCode: true, role: true } },
        },
      });

      // Merge live overtime (active shifts > employee.workingHoursPerDay) so they appear in the table
      const activeShifts = await prisma.employeeShift.findMany({
        where: { shiftEnd: null },
        include: { employee: { select: { id: true, name: true, employeeCode: true, role: true, workingHoursPerDay: true } } },
      });
      const now = Date.now();
      const existingShiftIds = new Set(records.map((r) => r.shiftId));
      const liveList: any[] = [];
      for (const s of activeShifts as ShiftWithEmployee[]) {
        const hours = (now - s.shiftStart.getTime()) / (1000 * 60 * 60);
        const requiredHours = s.employee.workingHoursPerDay ?? DEFAULT_WORKING_HOURS;
        if (hours <= requiredHours) continue;
        if (existingShiftIds.has(s.id)) continue;
        const shiftDate = getShiftDateInTimezone(s.shiftStart);
        if (fromDate && shiftDate < fromDate) continue;
        if (toDate) {
          const toEnd = new Date(toDate);
          toEnd.setUTCDate(toEnd.getUTCDate() + 1);
          toEnd.setUTCMilliseconds(-1);
          if (shiftDate > toEnd) continue;
        }
        if (where.employeeId != null && s.employeeId !== where.employeeId) continue;
        const overtimeHours = Math.round((hours - requiredHours) * 100) / 100;
        liveList.push({
          id: `live-${s.id}`,
          shiftId: s.id,
          employeeId: s.employeeId,
          employeeName: s.employee.name,
          role: s.employee.role ?? null,
          shiftDate,
          shiftStart: s.shiftStart,
          shiftEnd: null,
          totalHours: Math.round(hours * 100) / 100,
          overtimeHours,
          reason: null,
          status: "RUNNING",
          live: true,
          employee: s.employee,
        });
      }
      const combined = [...liveList, ...records];
      combined.sort((a, b) => {
        const dA = new Date(a.shiftDate).getTime();
        const dB = new Date(b.shiftDate).getTime();
        if (dA !== dB) return dB - dA;
        return new Date(b.shiftStart).getTime() - new Date(a.shiftStart).getTime();
      });

      return res.json(combined);
    } catch (e) {
      console.error("Overtime list error:", e);
      return res.status(500).json({ message: "Failed to load overtime records" });
    }
  }
);

// Admin: count of overtime records (e.g. for badge) and current overtime-running employees
overtimeRouter.get(
  "/summary",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    try {
      const [pendingCount, activeShifts] = await Promise.all([
        prisma.employeeOvertime.count({ where: { status: "PENDING" } }),
        prisma.employeeShift.findMany({
          where: { shiftEnd: null },
          include: { employee: { select: { id: true, name: true, role: true, workingHoursPerDay: true } } },
        }),
      ]);

      const now = Date.now();
      const overtimeRunning = (activeShifts as ShiftWithEmployee[]).filter((s: ShiftWithEmployee) => {
        const hours = (now - s.shiftStart.getTime()) / (1000 * 60 * 60);
        const required = s.employee.workingHoursPerDay ?? DEFAULT_WORKING_HOURS;
        return hours > required;
      });

      return res.json({
        pendingOvertimeCount: pendingCount,
        overtimeRunningCount: overtimeRunning.length,
        overtimeRunning: overtimeRunning.map((s: ShiftWithEmployee) => ({
          id: s.id,
          employeeId: s.employee.id,
          employeeName: s.employee.name,
          role: s.employee.role,
          shiftStart: s.shiftStart,
          workingHours: (now - s.shiftStart.getTime()) / (1000 * 60 * 60),
        })),
      });
    } catch (e) {
      console.error("Overtime summary error:", e);
      return res.status(500).json({ message: "Failed to load overtime summary" });
    }
  }
);

// Admin: update overtime status (PENDING | APPROVED | REJECTED | PAID). Live records cannot be updated.
overtimeRouter.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id) || req.params.id.startsWith("live-")) {
      return res.status(400).json({ message: "Cannot update live overtime; end the shift first." });
    }
    const { status } = req.body;
    if (!["PENDING", "APPROVED", "REJECTED", "PAID"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }
    const record = await prisma.employeeOvertime.update({
      where: { id },
      data: { status },
    });
    return res.json(record);
  }
);

// Employee: approved overtime counter (only counts admin-approved records)
overtimeRouter.get(
  "/my-summary",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    try {
      const employeeId = req.user!.id;
      const timeZone = process.env.TZ || "Asia/Kolkata";
      const now = new Date();
      const monthStr = now.toLocaleDateString("en-CA", { timeZone }).slice(0, 7); // YYYY-MM
      const monthStart = new Date(`${monthStr}-01T00:00:00.000Z`);
      const nextMonth = new Date(monthStart);
      nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
      nextMonth.setUTCMilliseconds(-1);

      const approved = await prisma.employeeOvertime.findMany({
        where: {
          employeeId,
          status: "APPROVED",
          shiftDate: { gte: monthStart, lte: nextMonth },
        },
        select: { overtimeHours: true },
      });
      const approvedHours = approved.reduce((s, r) => s + (Number(r.overtimeHours) || 0), 0);
      return res.json({
        month: monthStr,
        approvedHours: Math.round(approvedHours * 100) / 100,
        approvedCount: approved.length,
      });
    } catch (e) {
      console.error("Employee overtime summary error:", e);
      return res.status(500).json({ message: "Failed to load overtime summary" });
    }
  }
);
