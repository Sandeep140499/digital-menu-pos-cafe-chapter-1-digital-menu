import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { mailer, getFromAddress, isMailConfigured } from "../../config/mailer.js";
import { authenticate, requireRole } from "../../middleware/auth.js";

export const reportRouter = Router();

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1, "At least one recipient email required"),
  subject: z.string().min(1, "Subject required"),
  html: z.string().min(1, "HTML body required"),
});

// Admin: send email (e.g. salary slip HTML) to given addresses
reportRouter.post(
  "/send-email",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = sendEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const { to, subject, html } = parsed.data;
    if (!isMailConfigured()) {
      return res.status(503).json({
        message: "Email is not configured. Set EMAIL_SMTP_* and EMAIL_FROM_ADDRESS in .env.",
      });
    }
    try {
      await mailer.sendMail({
        to,
        from: `"${process.env.EMAIL_FROM_NAME || "Cafe Chapter 1"}" <${getFromAddress()}>`,
        subject,
        html,
      });
      return res.json({ message: "Email sent successfully" });
    } catch (e) {
      console.error("Send email failed:", e);
      return res.status(500).json({
        message: "Failed to send email. Check SMTP settings (e.g. Gmail app password in .env).",
      });
    }
  },
);

function getBusinessDayRange() {
  const now = new Date();
  const businessStart = new Date(now);
  // If current time is before 4 AM, use previous calendar day as "business day"
  if (businessStart.getHours() < 4) {
    businessStart.setDate(businessStart.getDate() - 1);
  }
  businessStart.setHours(4, 0, 0, 0);

  const businessEnd = new Date(businessStart);
  businessEnd.setDate(businessEnd.getDate() + 1);
  businessEnd.setHours(3, 59, 59, 999);

  return { start: businessStart, end: businessEnd };
}

// Admin: daily sales summary (restaurant day 4 AM → 3:59 AM)
reportRouter.get(
  "/daily-sales",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const { start, end } = getBusinessDayRange();

    const paidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        createdAt: { gte: start, lte: end },
      },
    });

    const totalSales = paidOrders.reduce(
      (sum, o) => sum + (o.totalAmount || 0),
      0,
    );

    return res.json({
      date: start.toISOString().slice(0, 10),
      orders: paidOrders.length,
      totalSales,
      windowStart: start.toISOString(),
      windowEnd: end.toISOString(),
    });
  },
);

// Admin: menu item performance for business day (by category and item)
reportRouter.get(
  "/menu-today",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const { start, end } = getBusinessDayRange();

    const items = await prisma.orderItem.findMany({
      where: {
        order: {
          createdAt: { gte: start, lte: end },
          paymentStatus: "PAID",
        },
      },
      include: {
        menuItem: {
          include: { category: true },
        },
      },
    });

    const byCategory: Record<
      string,
      { totalQuantity: number; totalRevenue: number; items: Record<string, { quantity: number; revenue: number }> }
    > = {};

    for (const oi of items) {
      const categoryName = oi.menuItem?.category?.name ?? "Uncategorized";
      const itemName = oi.menuItem?.name ?? oi.name;
      const revenue = oi.price * oi.quantity;

      if (!byCategory[categoryName]) {
        byCategory[categoryName] = {
          totalQuantity: 0,
          totalRevenue: 0,
          items: {},
        };
      }

      const cat = byCategory[categoryName];
      cat.totalQuantity += oi.quantity;
      cat.totalRevenue += revenue;

      if (!cat.items[itemName]) {
        cat.items[itemName] = { quantity: 0, revenue: 0 };
      }

      cat.items[itemName].quantity += oi.quantity;
      cat.items[itemName].revenue += revenue;
    }

    const categories = Object.entries(byCategory).map(
      ([category, value]) => ({
        category,
        totalQuantity: value.totalQuantity,
        totalRevenue: value.totalRevenue,
        items: Object.entries(value.items).map(
          ([name, stats]) => ({
            name,
            quantity: stats.quantity,
            revenue: stats.revenue,
          }),
        ),
      }),
    );

    return res.json({
      date: start.toISOString().slice(0, 10),
      categories,
    });
  },
);

// Admin: employee sales summary
reportRouter.get(
  "/employee-sales",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const result = await prisma.employeeShift.groupBy({
      by: ["employeeId"],
      _sum: {
        totalSales: true,
      },
    });

    const employees = await prisma.employee.findMany();
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const data = result.map((row) => ({
      employeeId: row.employeeId,
      name: employeeMap.get(row.employeeId)?.name,
      totalSales: row._sum.totalSales ?? 0,
    }));

    return res.json(data);
  },
);

// Admin: employee hours summary
reportRouter.get(
  "/employee-hours",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const result = await prisma.employeeShift.groupBy({
      by: ["employeeId"],
      _sum: {
        totalHours: true,
      },
    });

    const employees = await prisma.employee.findMany();
    const employeeMap = new Map(employees.map((e) => [e.id, e]));

    const data = result.map((row) => ({
      employeeId: row.employeeId,
      name: employeeMap.get(row.employeeId)?.name,
      totalHours: row._sum.totalHours ?? 0,
    }));

    return res.json(data);
  },
);

