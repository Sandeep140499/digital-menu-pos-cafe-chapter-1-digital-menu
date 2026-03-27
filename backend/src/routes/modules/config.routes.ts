import { Router } from 'express';
import { z } from 'zod';
import type { Order, PaymentRecord, ErrorLog } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { getPublicMenuViewCount } from '../../services/publicTraffic.js';
import {
  getFromAddress,
  isMailConfigured,
  sendEmail,
  verifyMailConnection,
} from '../../config/mailer.js';

type CustomerQueryRecord = {
  id: number;
  name: string;
  mobile: string;
  orderId: number | null;
  issueType: string;
  message: string;
  status: string;
  createdAt: Date;
};

const branchSchema = z.object({
  name: z.string().min(1),
  location: z.string().optional(),
  timezone: z.string().optional(),
  // Be forgiving: allow non-URL strings (some users paste relative/cdn links). Frontend can validate if needed.
  logoUrl: z
    .union([z.string(), z.literal('')])
    .optional()
    .nullable(),
  phone: z.string().optional().nullable(),
  googleReviewUrl: z
    .union([z.string(), z.literal('')])
    .optional()
    .nullable(),
  pincode: z.string().optional().nullable(),
  directorsEmail: z.string().optional().nullable(),
  showTotalAmountToCustomers: z.boolean().optional(),
  enableNewOrderRinging: z.boolean().optional(),
  newOrderSoundPreset: z.enum(['beep', 'ring', 'siren', 'chime']).optional(),
  newOrderSoundVolume: z.number().min(0).max(1).optional(),
});

const notificationSchema = z.object({
  type: z.enum(['ORDER', 'PAYMENT', 'SHIFT', 'SYSTEM']),
  message: z.string().min(1),
});

export const configRouter = Router();

const emailTestSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1).optional(),
  message: z.string().min(1).optional(),
});

configRouter.get('/google-review', (_req, res) => {
  return res.json({
    url: process.env.GOOGLE_REVIEW_URL || null,
  });
});

// Admin: check SMTP/email configuration status (helps debugging deployment)
configRouter.get('/email/status', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const from = getFromAddress();
  const status = {
    configured: isMailConfigured(),
    from: from || null,
    host: process.env.EMAIL_SMTP_HOST ? String(process.env.EMAIL_SMTP_HOST) : null,
    port: process.env.EMAIL_SMTP_PORT ? Number(process.env.EMAIL_SMTP_PORT) : null,
    user: process.env.EMAIL_SMTP_USER ? String(process.env.EMAIL_SMTP_USER) : null,
    hasPass: !!process.env.EMAIL_SMTP_PASS,
    note: 'In production, set EMAIL_SMTP_* and EMAIL_FROM_* as platform env vars (not only .env file).',
  };
  return res.json(status);
});

// Admin: verify SMTP connection + send a test email
configRouter.post('/email/test', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = emailTestSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  if (!isMailConfigured()) {
    return res.status(400).json({
      message:
        'Email is not configured on the server. Set EMAIL_SMTP_HOST/PORT/USER/PASS and EMAIL_FROM_ADDRESS (or SMTP user as from).',
    });
  }
  try {
    await verifyMailConnection();
  } catch (err) {
    return res.status(500).json({
      message: 'SMTP verification failed',
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const { to, subject, message } = parsed.data;
  try {
    await sendEmail({
      to,
      subject: subject || '✅ Test email (Cafe Chapter 1 POS)',
      html: `<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:16px;">
          <h2 style="margin:0 0 8px;color:#065f46;">Test email sent successfully</h2>
          <p style="margin:0 0 12px;color:#334155;">This confirms your server can connect to SMTP and send emails.</p>
          <div style="padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;">
            <div><b>Server</b>: ${(process.env.EMAIL_SMTP_HOST || '').toString()}</div>
            <div><b>Port</b>: ${Number(process.env.EMAIL_SMTP_PORT) || 587}</div>
            <div><b>From</b>: ${getFromAddress()}</div>
          </div>
          ${message ? `<p style="margin-top:12px;color:#0f172a;"><b>Message:</b> ${String(message)}</p>` : ''}
        </div>`,
    });
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({
      message: 'Failed to send test email',
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Admin: public network traffic (menu page views since server start)
configRouter.get('/public-traffic', authenticate, requireRole('ADMIN'), (_req, res) => {
  return res.json({ publicNetworkTraffic: getPublicMenuViewCount() });
});

// Public: branch contact for menu (Call / WhatsApp) and branch id for placing orders
configRouter.get('/branch-contact', async (_req, res) => {
  const branch = await prisma.branch.findFirst({
    select: {
      id: true,
      name: true,
      phone: true,
      location: true,
      googleReviewUrl: true,
      logoUrl: true,
      showTotalAmountToCustomers: true,
    },
  });

  let orderingOpen = false;
  if (branch?.id) {
    // First check for active shifts (preferred)
    const liveShift = await prisma.employeeShift.findFirst({
      where: {
        branchId: branch.id,
        shiftEnd: null,
        status: 'ACTIVE',
        employee: { status: 'ACTIVE' },
      },
      select: { id: true },
    });
    
    if (liveShift) {
      orderingOpen = true;
    } else {
      // If no active shifts, check if there are any active employees
      // This allows employees to receive orders even if they haven't started a shift yet
      const activeEmployees = await prisma.employee.findFirst({
        where: {
          branchId: branch.id,
          status: 'ACTIVE',
        },
        select: { id: true },
      });
      
      orderingOpen = !!activeEmployees;
      
      // Log this for debugging
      if (activeEmployees) {
        console.log(`Ordering open for branch ${branch.id} based on active employees (no active shift)`);
      }
    }
  }

  return res.json({
    id: branch?.id ?? null,
    name: branch?.name ?? process.env.RESTAURANT_NAME ?? 'CAFE CHAPTER 1 RESTRO',
    phone: branch?.phone ?? process.env.RESTAURANT_PHONE ?? null,
    location: branch?.location ?? process.env.RESTAURANT_ADDRESS ?? null,
    googleReviewUrl: branch?.googleReviewUrl ?? process.env.GOOGLE_REVIEW_URL ?? null,
    logoUrl: branch?.logoUrl ?? null,
    showTotalAmountToCustomers: branch?.showTotalAmountToCustomers ?? true,
    /** True when at least one employee has an active shift — matches POST /orders gate. */
    orderingOpen,
  });
});

// Employee: settings that affect employee UX (ringing, etc.)
configRouter.get('/employee-settings', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const employeeId = req.user!.id;
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { branchId: true },
  });
  if (!employee?.branchId) {
    return res.json({
      enableNewOrderRinging: true,
      newOrderSoundPreset: 'ring',
      newOrderSoundVolume: 1,
    });
  }
  const branch = await prisma.branch.findUnique({
    where: { id: employee.branchId },
    select: {
      enableNewOrderRinging: true,
      newOrderSoundPreset: true,
      newOrderSoundVolume: true,
    },
  });
  return res.json({
    enableNewOrderRinging: branch?.enableNewOrderRinging ?? true,
    newOrderSoundPreset: (branch as any)?.newOrderSoundPreset ?? 'ring',
    newOrderSoundVolume:
      typeof (branch as any)?.newOrderSoundVolume === 'number'
        ? (branch as any).newOrderSoundVolume
        : 1,
  });
});

// Public: lightweight settings for customer UI
configRouter.get('/public-settings', async (_req, res) => {
  const branch = await prisma.branch.findFirst({
    select: { showTotalAmountToCustomers: true },
  });
  return res.json({
    showTotalAmountToCustomers: branch?.showTotalAmountToCustomers ?? true,
  });
});

// Admin: new item broadcast message (for WhatsApp broadcast to all customer mobiles)
configRouter.get(
  '/new-item-broadcast-message',
  authenticate,
  requireRole('ADMIN'),
  async (req, res) => {
    const itemNames =
      (req.query.itemNames as string)
        ?.split(',')
        .map(s => s.trim())
        .filter(Boolean) || [];
    const itemDetails = (req.query.itemDetails as string) || undefined;
    if (itemNames.length === 0) {
      return res.status(400).json({ message: 'itemNames required (comma-separated)' });
    }
    const { buildNewItemBroadcast } = await import('../../services/whatsapp.js');
    const branch = await prisma.branch.findFirst({
      select: { name: true, location: true, phone: true, googleReviewUrl: true },
    });
    const message = buildNewItemBroadcast({
      itemNames,
      itemDetails,
      branch: branch || undefined,
    });
    return res.json({ message });
  }
);

// Admin: get first branch (backward compat) or by query ?branchId=
configRouter.get('/branch', authenticate, requireRole('ADMIN'), async (req, res) => {
  const branchId = req.query.branchId ? Number(req.query.branchId) : null;
  const branch = branchId
    ? await prisma.branch.findUnique({
        where: { id: branchId },
        include: { _count: { select: { employees: true, tables: true } } },
      })
    : await prisma.branch.findFirst({
        include: { _count: { select: { employees: true, tables: true } } },
      });
  return res.json(branch);
});

// Admin: update branch
configRouter.patch('/branch/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = branchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const id = Number(req.params.id);
  const data = { ...parsed.data };
  if (data.logoUrl === '') data.logoUrl = null;
  if (data.googleReviewUrl === '') data.googleReviewUrl = null;
  const branch = await prisma.branch.update({
    where: { id },
    data,
  });
  return res.json(branch);
});

// Admin: get notifications (new orders, order updates, payments, system alerts)
configRouter.get('/notifications', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const admin = await prisma.admin.findUnique({
      where: { id: req.user!.id },
      select: { notificationsClearedAt: true },
    });
    const clearedAt = admin?.notificationsClearedAt ?? null;
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // last 24h
    const [recentOrders, recentPayments, recentErrors, recentQueries] = await Promise.all([
      prisma.order.findMany({
        where: { createdAt: { gte: since } },
        take: 15,
        orderBy: { createdAt: 'desc' },
        include: { table: true },
      }),
      prisma.paymentRecord.findMany({
        where: { createdAt: { gte: since } },
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: { order: { select: { id: true } } },
      }),
      prisma.errorLog.findMany({
        where: { createdAt: { gte: since }, status: 'UNRESOLVED' },
        take: 5,
        orderBy: { createdAt: 'desc' },
      }),
      ('customerQuery' in prisma
        ? (prisma as any).customerQuery.findMany({
            where: { createdAt: { gte: since } },
            take: 15,
            orderBy: { createdAt: 'desc' },
          })
        : Promise.resolve([])) as Promise<CustomerQueryRecord[]>,
    ]);

    const orderNotifs = recentOrders.map(
      (order: Order & { table?: { tableNumber?: string } | null }) => ({
        id: `order-${order.id}`,
        type: 'ORDER',
        message: `Order #${order.id} — Table ${order.table?.tableNumber ?? order.tableId} — ₹${order.totalAmount?.toFixed(0) ?? 0}`,
        createdAt: order.createdAt,
        read: false,
      })
    );
    const paymentNotifs = recentPayments.map((p: PaymentRecord) => ({
      id: `payment-${p.id}`,
      type: 'PAYMENT',
      message: `Payment ${p.paymentStatus} for Order #${p.orderId} — ₹${p.paidAmount?.toFixed(0) ?? 0}`,
      createdAt: p.createdAt,
      read: false,
    }));
    const systemNotifs = recentErrors.map((e: ErrorLog) => ({
      id: `err-${e.id}`,
      type: 'SYSTEM',
      message: e.errorMessage?.slice(0, 80) ?? 'System error',
      createdAt: e.createdAt,
      read: false,
    }));
    const queryNotifs = recentQueries.map((q: CustomerQueryRecord) => ({
      id: `query-${q.id}`,
      type: 'QUERY',
      message: `New Customer Query — ${q.name} — ${q.issueType.replace(/_/g, ' ')} — ${q.message?.slice(0, 40) ?? ''}${(q.message?.length ?? 0) > 40 ? '…' : ''}`,
      createdAt: q.createdAt,
      read: false,
      meta: {
        queryId: q.id,
        customerName: q.name,
        mobile: q.mobile,
        orderId: q.orderId,
        issueType: q.issueType,
        status: q.status,
      },
    }));

    const adminAlerts = await prisma.adminNotification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const adminNotifs = adminAlerts.map(n => ({
      id: `admin-${n.id}`,
      type: n.type,
      message: n.message,
      createdAt: n.createdAt,
      read: n.isRead,
      orderId: n.orderId ?? undefined,
      meta: n.meta ?? undefined,
    }));

    const notifications = [
      ...orderNotifs,
      ...paymentNotifs,
      ...systemNotifs,
      ...queryNotifs,
      ...adminNotifs,
    ]
      .filter(n => (clearedAt ? new Date(n.createdAt) > clearedAt : true))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 50);
    return res.json(notifications);
  } catch (err) {
    console.error('Notifications API error:', err);
    return res.json([]);
  }
});
