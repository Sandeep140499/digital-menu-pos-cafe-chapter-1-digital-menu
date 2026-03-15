import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { getWaMeLink } from "../../services/whatsapp.js";

const createQuerySchema = z.object({
  name: z.string().min(1, "Name is required"),
  mobile: z.string().regex(/^[6-9]\d{9}$/, "Valid 10-digit mobile required"),
  orderId: z.number().int().optional(),
  branchId: z.number().int().optional(),
  issueType: z.enum(["ORDER_ISSUE", "PAYMENT_ISSUE", "FOOD_ISSUE", "DELAY_ISSUE", "OTHER"]),
  message: z.string().min(1, "Please describe your issue"),
});

const updateStatusSchema = z.object({
  status: z.enum(["PENDING", "IN_PROGRESS", "RESOLVED"]),
});

export const customerQueryRouter = Router();

// Public: customer raises issue / query
customerQueryRouter.post("/", async (req, res) => {
  const parsed = createQuerySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
  }
  const { name, mobile, orderId, branchId, issueType, message } = parsed.data;
  try {
    const query = await prisma.customerQuery.create({
      data: { name, mobile, orderId: orderId ?? null, branchId: branchId ?? null, issueType, message },
    });
    return res.status(201).json(query);
  } catch (err: any) {
    console.error("Customer query create error:", err);
    const message = err?.code === "P2021" || err?.message?.includes("does not exist")
      ? "Customer queries are not set up yet. Please contact the restaurant directly."
      : err?.message ?? "Failed to submit your query. Please try again or contact us directly.";
    return res.status(500).json({ message });
  }
});

// Admin: list all customer queries
customerQueryRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const { status } = req.query;
    const where: { status?: string } = {};
    if (status && typeof status === "string") where.status = status;
    const queries = await prisma.customerQuery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { branch: { select: { id: true, name: true } } },
    });
    return res.json(queries);
  },
);

// Admin: update status (PENDING | IN_PROGRESS | RESOLVED)
customerQueryRouter.patch(
  "/:id/status",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateStatusSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const data: { status: string; resolvedAt?: Date } = { status: parsed.data.status };
    if (parsed.data.status === "RESOLVED") data.resolvedAt = new Date();
    const query = await prisma.customerQuery.update({
      where: { id },
      data,
      include: { branch: { select: { id: true, name: true } } },
    });
    return res.json(query);
  },
);

// Admin: resolve and get WhatsApp link to notify customer
customerQueryRouter.post(
  "/:id/resolve",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    const query = await prisma.customerQuery.findUnique({ where: { id } });
    if (!query) return res.status(404).json({ message: "Query not found" });
    await prisma.customerQuery.update({
      where: { id },
      data: { status: "RESOLVED", resolvedAt: new Date() },
    });
    const orderIdStr = query.orderId ? `ORD${String(query.orderId).padStart(4, "0")}` : "your request";
    const message = `Hello ${query.name} 👋\n\nYour query regarding order ${orderIdStr} has been resolved.\n\nThank you for your patience ❤️\n\nContact us if you need any further assistance.`;
    const waMeLink = getWaMeLink(query.mobile, message);
    return res.json({ query: { ...query, status: "RESOLVED" }, waMeLink, message });
  },
);
