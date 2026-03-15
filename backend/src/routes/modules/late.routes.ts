import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";

const TIMEZONE = process.env.TZ || "Asia/Kolkata";

export const lateRouter = Router();

function parseDateFilter(value: string): Date | null {
  if (!value || typeof value !== "string") return null;
  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
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

// Admin: list late entries with filters (dateFrom, dateTo, employeeId)
lateRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { dateFrom, dateTo, employeeId } = req.query;
      const where: { date?: { gte?: Date; lte?: Date }; employeeId?: number } = {};

      const fromDate = parseDateFilter(dateFrom as string);
      const toDate = parseDateFilter(dateTo as string);
      if (fromDate) {
        where.date = where.date ?? {};
        (where.date as { gte?: Date }).gte = fromDate;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setUTCDate(end.getUTCDate() + 1);
        end.setUTCMilliseconds(-1);
        where.date = where.date ?? {};
        (where.date as { lte?: Date }).lte = end;
      }
      const empId = employeeId as string;
      if (empId && empId !== "all" && empId !== "") {
        const id = Number(empId);
        if (!Number.isNaN(id)) where.employeeId = id;
      }

      const entries = await prisma.lateEntry.findMany({
        where,
        orderBy: [{ date: "desc" }, { createdAt: "desc" }],
        include: {
          employee: { select: { id: true, name: true, employeeCode: true } },
        },
      });

      return res.json(entries);
    } catch (e) {
      console.error("Late entries list error:", e);
      return res.status(500).json({ message: "Failed to load late entries" });
    }
  }
);

// Admin or salary slip: total late minutes for an employee in a date range (for salary slip integration)
lateRouter.get(
  "/summary",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    try {
      const { employeeId, dateFrom, dateTo } = req.query;
      const empId = employeeId as string;
      const fromDate = parseDateFilter(dateFrom as string);
      const toDate = parseDateFilter(dateTo as string);
      if (!empId || Number.isNaN(Number(empId))) {
        return res.status(400).json({ message: "employeeId required" });
      }

      const where: { employeeId: number; date?: { gte?: Date; lte?: Date } } = {
        employeeId: Number(empId),
      };
      if (fromDate) {
        where.date = where.date ?? {};
        (where.date as { gte?: Date }).gte = fromDate;
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setUTCDate(end.getUTCDate() + 1);
        end.setUTCMilliseconds(-1);
        where.date = where.date ?? {};
        (where.date as { lte?: Date }).lte = end;
      }

      const entries = await prisma.lateEntry.findMany({
        where,
        select: { lateDurationMinutes: true },
      });
      const totalLateMinutes = entries.reduce((s, e) => s + e.lateDurationMinutes, 0);

      return res.json({ employeeId: Number(empId), totalLateMinutes, count: entries.length });
    } catch (e) {
      console.error("Late summary error:", e);
      return res.status(500).json({ message: "Failed to load late summary" });
    }
  }
);
