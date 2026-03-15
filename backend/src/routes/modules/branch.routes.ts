import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { directorRouter } from "./director.routes.js";

const createBranchSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  timezone: z.string().optional(),
  logoUrl: z.string().url().optional().nullable(),
  phone: z.string().optional().nullable(),
  googleReviewUrl: z.string().url().optional().nullable(),
  pincode: z.string().optional().nullable(),
  directorsEmail: z.string().optional().nullable(),
});

const updateBranchSchema = createBranchSchema.partial();

export const branchRouter = Router();

// Admin: list all branches
branchRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const branches = await prisma.branch.findMany({
      include: {
        _count: {
          select: { employees: true, tables: true, orders: true },
        },
      },
      orderBy: { id: "asc" },
    });
    return res.json(branches);
  },
);

// Admin: create branch
branchRouter.post(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = createBranchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const branch = await prisma.branch.create({
      data: parsed.data,
    });
    return res.status(201).json(branch);
  },
);

// Admin: get single branch
branchRouter.get(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        _count: {
          select: { employees: true, tables: true, orders: true },
        },
      },
    });
    if (!branch) return res.status(404).json({ message: "Branch not found" });
    return res.json(branch);
  },
);

// Admin: update branch (directorsEmail is managed via director verify/remove; omit from free-form update or allow sync)
branchRouter.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = updateBranchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const id = Number(req.params.id);
    const branch = await prisma.branch.update({
      where: { id },
      data: parsed.data,
    });
    return res.json(branch);
  },
);

// Nested: director management (list, request-verify, request-remove)
branchRouter.use("/:id/directors", directorRouter);
