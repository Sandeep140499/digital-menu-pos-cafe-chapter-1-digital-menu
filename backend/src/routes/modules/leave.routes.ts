import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";

export const leaveRouter = Router();

const applyLeaveSchema = z.object({
  startDate: z.string().min(1),
  endDate: z.string().min(1),
  reason: z.string().optional(),
});

// Employee: apply leave
leaveRouter.post(
  "/apply",
  authenticate,
  requireRole("EMPLOYEE"),
  async (req, res) => {
    const parsed = applyLeaveSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const employeeId = req.user!.id;
    const startDate = new Date(parsed.data.startDate);
    const endDate = new Date(parsed.data.endDate);
    if (!Number.isFinite(startDate.getTime()) || !Number.isFinite(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date range" });
    }
    if (endDate < startDate) {
      return res.status(400).json({ message: "End date must be after start date" });
    }
    const leave = await prisma.employeeLeave.create({
      data: {
        employeeId,
        startDate,
        endDate,
        reason: parsed.data.reason?.trim() || null,
        status: "PENDING" as any,
      },
    });
    return res.status(201).json({ leave });
  },
);

// Admin: list leaves with filters
leaveRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const { employeeId, startDate, endDate, status } = req.query;
    const where: any = {};
    if (employeeId) where.employeeId = Number(employeeId);
    if (status) where.status = String(status).toUpperCase();
    if (startDate || endDate) {
      where.AND = [];
      if (startDate) where.AND.push({ endDate: { gte: new Date(String(startDate)) } });
      if (endDate) where.AND.push({ startDate: { lte: new Date(String(endDate)) } });
    }
    const leaves = await prisma.employeeLeave.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { employee: { select: { id: true, name: true, branchId: true, status: true } } },
      take: 500,
    });
    const summary = {
      total: leaves.length,
      pending: leaves.filter((l) => String(l.status) === "PENDING").length,
      approved: leaves.filter((l) => String(l.status) === "APPROVED").length,
      rejected: leaves.filter((l) => String(l.status) === "REJECTED").length,
    };
    return res.json({ leaves, summary });
  },
);

const updateLeaveStatusSchema = z.object({
  status: z.enum(["APPROVED", "REJECTED"]),
});

// Admin: approve/reject leave
leaveRouter.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = updateLeaveStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const id = Number(req.params.id);
    const leave = await prisma.employeeLeave.update({
      where: { id },
      data: { status: parsed.data.status as any },
    });
    return res.json({ leave });
  },
);

