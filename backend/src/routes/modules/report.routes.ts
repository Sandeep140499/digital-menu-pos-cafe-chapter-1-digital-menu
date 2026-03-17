import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { mailer, getFromAddress, isMailConfigured } from "../../config/mailer.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { getPublicMenuViewCount } from "../../services/publicTraffic.js";

export const reportRouter = Router();

const sendEmailSchema = z.object({
  to: z.array(z.string().email()).min(1, "At least one recipient email required"),
  subject: z.string().min(1, "Subject required"),
  html: z.string().min(1, "HTML body required"),
});

const salaryRowSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1),
  amount: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0),
});

const createSalarySlipSchema = z.object({
  employeeId: z.number().int(),
  salaryNumber: z.string().min(1).optional(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  paidDays: z.number().int().min(0).max(31).optional(),
  lopDays: z.number().int().min(0).max(31).optional(),
  basicSalary: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0),
  netSalary: z.union([z.number(), z.string()]).transform((v) => Number(v) || 0),
  allowances: z.array(salaryRowSchema).optional(),
  deductions: z.array(salaryRowSchema).optional(),
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

// Admin: create salary slip (stored in DB)
reportRouter.post(
  "/salary-slips",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = createSalarySlipSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.issues });
    }
    const data = parsed.data;

    const employee = await prisma.employee.findUnique({
      where: { id: data.employeeId },
      select: { id: true },
    });
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const slip = await prisma.salarySlip.create({
      data: {
        employeeId: data.employeeId,
        salaryNumber: data.salaryNumber,
        month: data.month,
        year: data.year,
        paidDays: data.paidDays,
        lopDays: data.lopDays,
        basicSalary: data.basicSalary,
        netSalary: data.netSalary,
        allowances: data.allowances ?? [],
        deductions: data.deductions ?? [],
      },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, email: true } },
      },
    });

    return res.status(201).json(slip);
  },
);

// Admin: list salary slips (filter by month/year)
reportRouter.get(
  "/salary-slips",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const monthParam = typeof req.query.month === "string" ? req.query.month : "";
    const employeeIdParam = typeof req.query.employeeId === "string" ? req.query.employeeId : "";
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    let year: number | undefined;
    let month: number | undefined;
    if (monthParam) {
      const [y, m] = monthParam.split("-").map(Number);
      if (Number.isFinite(y) && Number.isFinite(m) && m >= 1 && m <= 12) {
        year = y;
        month = m;
      }
    }

    const employeeId = employeeIdParam ? Number(employeeIdParam) : undefined;

    const slips = await prisma.salarySlip.findMany({
      where: {
        ...(employeeId ? { employeeId } : {}),
        ...(year && month ? { year, month } : {}),
        ...(q
          ? {
              employee: {
                OR: [
                  { name: { contains: q, mode: "insensitive" } },
                  { employeeCode: { contains: q, mode: "insensitive" } },
                  { email: { contains: q, mode: "insensitive" } },
                ],
              },
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      include: {
        employee: { select: { id: true, name: true, employeeCode: true, email: true } },
      },
      take: 2000,
    });

    return res.json({ slips, count: slips.length });
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

// Admin: dashboard performance summary (for admin Performance page)
reportRouter.get(
  "/dashboard-summary",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const { start, end } = getBusinessDayRange();

    const paidOrders = await prisma.order.findMany({
      where: {
        paymentStatus: "PAID",
        createdAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        createdAt: true,
        totalAmount: true,
        table: {
          select: { tableNumber: true },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    // Simple per-hour buckets for "trend"
    const buckets: Record<
      string,
      { orders: number; revenue: number }
    > = {};

    for (const o of paidOrders) {
      const d = new Date(o.createdAt);
      const key = `${d.getHours().toString().padStart(2, "0")}:00`;
      if (!buckets[key]) {
        buckets[key] = { orders: 0, revenue: 0 };
      }
      buckets[key].orders += 1;
      buckets[key].revenue += o.totalAmount || 0;
    }

    const trend = Object.entries(buckets)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([label, value]) => ({
        label,
        orders: value.orders,
        revenue: value.revenue,
      }));

    // Top routes – currently approximated from table number (this can be refined later)
    const byTable: Record<string, { count: number; revenue: number }> = {};
    for (const o of paidOrders) {
      const key = o.table?.tableNumber || "Takeaway";
      if (!byTable[key]) {
        byTable[key] = { count: 0, revenue: 0 };
      }
      byTable[key].count += 1;
      byTable[key].revenue += o.totalAmount || 0;
    }
    const routes = Object.entries(byTable)
      .map(([name, value]) => ({
        route: name,
        orders: value.count,
        revenue: value.revenue,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6);

    // Public network traffic from in-memory counter
    const publicNetworkTraffic = getPublicMenuViewCount();

    return res.json({
      date: start.toISOString().slice(0, 10),
      totalOrders: paidOrders.length,
      totalRevenue: paidOrders.reduce(
        (sum, o) => sum + (o.totalAmount || 0),
        0,
      ),
      publicNetworkTraffic,
      trend,
      routes,
    });
  },
);

// Admin: average order completion time per employee (minutes)
reportRouter.get(
  "/order-completion-times",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const days = Math.min(Math.max(Number(req.query.days) || 1, 1), 30);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const orders = await prisma.order.findMany({
      where: {
        completedAt: { not: null, gte: since },
        acceptedAt: { not: null },
        employeeId: { not: null },
      },
      select: {
        employeeId: true,
        acceptedAt: true,
        completedAt: true,
      },
      take: 50_000,
    });

    const employees = await prisma.employee.findMany({
      select: { id: true, name: true, employeeCode: true },
    });
    const empMap = new Map(employees.map((e) => [e.id, e]));

    const byEmp = new Map<number, { count: number; sumMins: number; minMins: number; maxMins: number }>();
    for (const o of orders) {
      if (!o.employeeId || !o.acceptedAt || !o.completedAt) continue;
      const ms = new Date(o.completedAt).getTime() - new Date(o.acceptedAt).getTime();
      if (!Number.isFinite(ms) || ms < 0) continue;
      const mins = ms / 60000;
      const cur = byEmp.get(o.employeeId) ?? { count: 0, sumMins: 0, minMins: Number.POSITIVE_INFINITY, maxMins: 0 };
      cur.count += 1;
      cur.sumMins += mins;
      cur.minMins = Math.min(cur.minMins, mins);
      cur.maxMins = Math.max(cur.maxMins, mins);
      byEmp.set(o.employeeId, cur);
    }

    const rows = Array.from(byEmp.entries()).map(([employeeId, s]) => {
      const emp = empMap.get(employeeId);
      const avg = s.count ? s.sumMins / s.count : 0;
      return {
        employeeId,
        employeeName: emp?.name ?? "—",
        employeeCode: emp?.employeeCode ?? null,
        ordersCompleted: s.count,
        avgMinutes: Math.round(avg * 10) / 10,
        minMinutes: s.minMins === Number.POSITIVE_INFINITY ? 0 : Math.round(s.minMins * 10) / 10,
        maxMinutes: Math.round(s.maxMins * 10) / 10,
      };
    });

    rows.sort((a, b) => b.ordersCompleted - a.ordersCompleted || a.avgMinutes - b.avgMinutes);

    return res.json({ since: since.toISOString(), days, rows });
  },
);

