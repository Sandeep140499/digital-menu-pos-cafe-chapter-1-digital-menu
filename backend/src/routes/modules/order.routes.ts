import { Router } from 'express';
import { z } from 'zod';
import { OrderStatus as OrderStatusEnum } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { getBusinessDayRange as getBusinessDayRangeForDate } from '../../utils/businessDay.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { buildOrderInvoice, buildStatusMessage, getWaMeLink } from '../../services/whatsapp.js';
import { generateOrderInvoicePdf, getInvoiceFileName } from '../../services/invoicePdf.js';
import { isMailConfigured, sendEmail } from '../../config/mailer.js';
import { onOrderStatus, publishOrderStatus } from '../../utils/orderStatusEvents.js';
import {
  OrderNotificationService,
  determineOrderPriority,
} from '../../services/orderNotifications.js';
import { logger } from '../../utils/logger.js';

const mobileRegex = /^[6-9]\d{9}$/;

const createOrderSchema = z
  .object({
    tableId: z.number().int().optional(),
    orderType: z.enum(['DINE_IN', 'TAKE_AWAY']).optional().default('DINE_IN'),
    tableNumber: z.string().optional().default(''),
    branchId: z.number().int(),
    sessionToken: z.string().optional(),
    packaging: z.boolean().optional(),
    customerName: z.string().min(1, 'Name is required'),
    customerMobile: z
      .union([z.string().regex(mobileRegex), z.string().max(20)])
      .optional()
      .transform(s => {
        if (s == null || s === undefined) return null;
        const digits = String(s).replace(/\D/g, '').slice(-10);
        return digits.length === 10 && /^[6-9]/.test(digits) ? digits : null;
      }),
    items: z
      .array(
        z.object({
          name: z.string().min(1),
          unitPrice: z.number().nonnegative(),
          quantity: z.number().int().min(1),
          variant: z.enum(['HALF', 'FULL']).optional(),
        })
      )
      .min(1),
  })
  .superRefine((data, ctx) => {
    const table = (data.tableNumber || '').trim();
    if (data.orderType === 'DINE_IN') {
      if (!table || !/^\d$/.test(table)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tableNumber'],
          message:
            'Dine-in table must be exactly one digit (0–9), as printed on your table. Do not enter 10, letters, or spaces.',
        });
      }
    }
  });

const updateStatusSchema = z.object({
  status: z.enum(['ACCEPTED', 'PREPARING', 'SERVED', 'ORDER_COMPLETE', 'REJECTED']),
});

const updateOrderCustomerSchema = z.object({
  customerName: z.string().min(1).optional(),
  customerMobile: z
    .union([z.string().regex(mobileRegex), z.literal('')])
    .optional()
    .transform(s => {
      const raw = (s ?? '').trim();
      if (!raw) return null;
      const digits = raw.replace(/\D/g, '').slice(-10);
      return digits.length === 10 && /^[6-9]/.test(digits) ? digits : null;
    }),
});

const modifyOrderSchema = z.object({
  removedItemIds: z.array(z.number()),
  reason: z.string().optional(),
});

const modifyOrderV2Schema = z.object({
  removedItemIds: z.array(z.number()).optional().default([]),
  addedItems: z
    .array(
      z.object({
        name: z.string().min(1),
        menuItemId: z.number().int().optional(),
        unitPrice: z.number().nonnegative(),
        quantity: z.number().int().min(1),
        variant: z.enum(['HALF', 'FULL']).optional(),
      })
    )
    .optional()
    .default([]),
  updatedItems: z
    .array(
      z.object({
        orderItemId: z.number().int(),
        quantity: z.number().int().min(1).optional(),
        unitPrice: z.number().nonnegative().optional(),
        variant: z.enum(['HALF', 'FULL']).nullable().optional(),
      })
    )
    .optional()
    .default([]),
  reason: z.string().optional(),
});

export const orderRouter = Router();

async function assignEmployeeToOrder(branchId: number) {
  // Allow any ACTIVE employee to handle orders, not just those with active shifts
  // This enables multiple employees to work concurrently
  const employee = await prisma.employee.findFirst({
    where: {
      branchId,
      status: 'ACTIVE' as any,
    },
    select: { id: true },
    orderBy: undefined,
  });

  if (employee) {
    return {
      employeeId: employee.id,
      shiftId: null, // Not using shift system for concurrent access
    };
  }

  // No active employee found - fallback to any active employee
  const anyActiveEmployee = await prisma.employee.findFirst({
    where: {
      branchId,
      status: 'ACTIVE' as any,
    },
    select: { id: true },
  });

  if (anyActiveEmployee) {
    console.log(`Assigning order to any active employee for branch ${branchId}`);
    return {
      employeeId: anyActiveEmployee.id,
      shiftId: null,
    };
  }

  // No active employees at all
  console.log(`Cannot assign order for branch ${branchId} - no active employees found`);
  return {
    employeeId: null,
    shiftId: null,
  };
}

// Customer: create order from QR menu
orderRouter.post('/', async (req, res) => {
  const parsed = createOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const {
    tableId,
    tableNumber: rawTableNumber,
    orderType,
    branchId,
    items,
    sessionToken,
    packaging,
    customerName: rawName,
    customerMobile: rawMobile,
  } = parsed.data;
  const tableNumber = orderType === 'TAKE_AWAY' ? 'TAKE_AWAY' : (rawTableNumber || '').trim();
  const customerMobile = rawMobile ?? null;
  const customerName = (rawName || '').trim().toUpperCase() || (rawName || '').trim();

  const branchExists = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { id: true },
  });
  if (!branchExists) {
    return res.status(400).json({
      success: false,
      message:
        'Invalid branch. The branch may have been removed. Please refresh the page or scan the QR again.',
    });
  }

  let resolvedTableId = tableId ?? null;
  if (!resolvedTableId) {
    let table = await prisma.table.findFirst({
      where: {
        tableNumber,
        branchId,
      },
    });

    if (!table) {
      table = await prisma.table.create({
        data: {
          tableNumber,
          branchId,
        },
      });
    }

    resolvedTableId = table.id;
  }

  // Normalize item name: store base name without "(5pc / 8pc)" so variant (HALF/FULL) carries size for analytics
  const normalizeItemName = (name: string) =>
    (name || '').replace(/\s*\(5pc\s*\/\s*8pc\)\s*/gi, '').trim() || name;

  let totalAmount = 0;
  const orderItemsData = items.map(item => {
    const price = item.unitPrice;
    totalAmount += price * item.quantity;
    const baseName = normalizeItemName(item.name);

    return {
      name: baseName,
      quantity: item.quantity,
      price,
      variant: item.variant ?? undefined,
    };
  });

  if (packaging) {
    orderItemsData.push({
      name: 'Packaging',
      quantity: 1,
      price: 0,
      variant: undefined,
    });
  }

  // Assign order to employee with active shift
  const { employeeId: assignedEmployeeId, shiftId: assignedShiftId } = await assignEmployeeToOrder(branchId);
  if (assignedEmployeeId == null) {
    try {
      await prisma.errorLog.create({
        data: {
          errorType: 'NO_ACTIVE_SHIFT',
          apiEndpoint: '/orders',
          errorMessage:
            'A customer tried to place an order but no employee has started their shift. Please ask staff to start their shift.',
          branchId,
          status: 'UNRESOLVED',
        },
      });
    } catch (logErr) {
      console.error('Failed to log no-active-shift notification:', logErr);
    }
    return res.status(503).json({
      message: 'No staff on shift. Please ask restaurant staff to start their shift to take orders.',
    });
  }

  const order = await prisma.order.create({
    data: {
      tableId: resolvedTableId,
      branchId,
      employeeId: assignedEmployeeId, // Assign to employee with active shift
      shiftId: assignedShiftId, // Assign the active shift
      status: 'NEW_ORDER',
      orderType: orderType as any,
      totalAmount,
      sessionToken,
      customerName,
      customerMobile,
      orderSource: 'CUSTOMER', // This is a customer order from QR menu
      priority: determineOrderPriority(orderType, 'CUSTOMER', totalAmount, items.length),
      items: {
        create: orderItemsData,
      },
    },
    select: {
      id: true,
      branchId: true,
      status: true,
      paymentStatus: true,
      orderType: true,
      totalAmount: true,
      createdAt: true,
      orderSource: true,
      priority: true,
    },
  });
  // Invoice generation/linking intentionally omitted from order-create response to keep the
  // customer checkout path fast under high concurrency. Invoice endpoints remain available.

  // For realtime employee popups we still need order details (items/table). Fetch once and emit.
  // This keeps the customer API response small while preserving existing employee UX.
  const orderForRealtime = await prisma.order.findUnique({
    where: { id: order.id },
    include: {
      items: true,
      table: true,
      employee: { select: { id: true, name: true } },
      branch: true,
    },
  });

  // Emit enhanced notifications using the new notification service
  const notificationService = new OrderNotificationService(req.app.locals.io);

  // Prepare notification data
  const notificationData = {
    orderId: order.id,
    branchId: order.branchId,
    tableNumber: tableNumber === 'TAKE_AWAY' ? 'Take Away' : tableNumber,
    customerName,
    orderType: orderType as 'DINE_IN' | 'TAKE_AWAY',
    orderSource: 'CUSTOMER' as const,
    priority: order.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT',
    totalAmount: order.totalAmount,
    items: items.map(item => ({ name: item.name, quantity: item.quantity })),
  };

  // Send loud notification for new customer order
  await notificationService.sendNewOrderNotification(notificationData);

  // Keep legacy emissions for backward compatibility
  req.app.locals.io?.emit('order:new', orderForRealtime ?? order);
  req.app.locals.io?.to(`branch:${order.branchId}`)?.emit('order:new', orderForRealtime ?? order);

  publishOrderStatus({
    id: order.id,
    status: order.status,
    acceptedAt: (order as any).acceptedAt ?? null,
    completedAt: (order as any).completedAt ?? null,
    updatedAt: (order as any).updatedAt ?? null,
  });

  logger.info('New customer order created with enhanced notifications', {
    orderId: order.id,
    branchId: order.branchId,
    priority: order.priority,
    totalAmount: order.totalAmount,
    itemCount: items.length,
  });

  // Send email notification to admin + branch directors for new orders
  if (isMailConfigured()) {
    setImmediate(async () => {
      try {
        const items = await prisma.orderItem.findMany({
          where: { orderId: order.id, isRemoved: false },
          select: { name: true, quantity: true, price: true, variant: true },
          orderBy: { id: 'asc' },
        });
        const branch = await prisma.branch.findUnique({
          where: { id: order.branchId },
          select: { directorsEmail: true },
        });
        const admin = await prisma.admin.findFirst({ select: { email: true } });
        const directorEmails: string[] = (branch?.directorsEmail || '')
          .split(',')
          .map(s => s.trim())
          .filter(Boolean);
        const recipients = [
          ...new Set([admin?.email, ...directorEmails].filter(Boolean)),
        ] as string[];
        if (recipients.length === 0) return;

        const orderTypeLabel = orderType === 'TAKE_AWAY' ? 'Take Away' : 'Dine In';
        const tableLabel = orderType === 'TAKE_AWAY' ? 'Take Away' : `Table ${tableNumber}`;
        const itemRows = items
          .map(i => {
            const variantLabel = i.variant ? ` (${i.variant === 'HALF' ? 'Half' : 'Full'})` : '';
            return `<tr><td style="padding:6px 12px;border-bottom:1px solid #eee;">${i.quantity}× ${i.name}${variantLabel}</td><td style="padding:6px 12px;border-bottom:1px solid #eee;text-align:right;">₹${(i.price * i.quantity).toFixed(0)}</td></tr>`;
          })
          .join('');

        const html = `
<div style="font-family:sans-serif;max-width:540px;margin:0 auto;background:#f9f9f9;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">
  <div style="background:#1a5c38;color:#fff;padding:20px 24px;">
    <h2 style="margin:0;font-size:20px;">🛎️ New Order Received — #${order.id}</h2>
    <p style="margin:4px 0 0;opacity:0.85;font-size:14px;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST</p>
  </div>
  <div style="padding:20px 24px;">
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Customer</td><td style="font-weight:600;font-size:14px;">${customerName || 'Walk-in'}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Mobile</td><td style="font-size:14px;">${customerMobile || '—'}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Type</td><td style="font-size:14px;font-weight:600;color:#1a5c38;">${orderTypeLabel}</td></tr>
      <tr><td style="color:#6b7280;font-size:13px;padding:4px 0;">Location</td><td style="font-size:14px;">${tableLabel}</td></tr>
    </table>
    <table style="width:100%;border-collapse:collapse;background:#fff;border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
      <thead><tr style="background:#f3f4f6;"><th style="text-align:left;padding:8px 12px;font-size:13px;color:#374151;">Item</th><th style="text-align:right;padding:8px 12px;font-size:13px;color:#374151;">Amount</th></tr></thead>
      <tbody>${itemRows}</tbody>
      <tfoot><tr style="background:#f0fdf4;"><td style="padding:10px 12px;font-weight:700;font-size:15px;">Total</td><td style="padding:10px 12px;font-weight:700;font-size:15px;text-align:right;color:#1a5c38;">₹${order.totalAmount.toFixed(0)}</td></tr></tfoot>
    </table>
    <p style="margin-top:16px;font-size:12px;color:#9ca3af;">This notification was sent automatically by Cafe Chapter 1 POS system.</p>
  </div>
</div>`;

        await sendEmail({
          to: recipients,
          subject: `🛎️ New Order #${order.id} — ${customerName || 'Walk-in'} (${tableLabel})`,
          html,
        });
      } catch (err) {
        console.error('[order-email] Failed to send new order notification:', err);
      }
    });
  }

  return res.status(201).json({
    order,
    invoicePdfUrl: undefined,
    invoiceFileName: undefined,
  });
});

// Public: stream order status updates (SSE) for customer tracking (no auth)
orderRouter.get('/:id/stream', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid order id' });

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  // Helps nginx/proxies not buffer SSE.
  res.setHeader('X-Accel-Buffering', 'no');

  // Flush headers early (if supported).
  (res as any).flushHeaders?.();

  const writeEvent = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // Send initial snapshot immediately so UI can render without waiting.
  try {
    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        acceptedAt: true,
        completedAt: true,
        updatedAt: true,
      },
    });
    if (!order) {
      writeEvent('error', { message: 'Order not found' });
      return res.end();
    }
    writeEvent('snapshot', order);
  } catch (err) {
    writeEvent('error', { message: 'Failed to load order snapshot' });
    return res.end();
  }

  const unsubscribe = onOrderStatus(id, payload => {
    writeEvent('status', payload);
  });

  // Keep-alive ping to prevent idle timeouts.
  const ping = setInterval(() => {
    res.write(`: ping ${Date.now()}\n\n`);
  }, 25000);

  req.on('close', () => {
    clearInterval(ping);
    unsubscribe();
  });
});

// Customer or staff: get WhatsApp invoice link for an order (by order id)
orderRouter.get('/:id/whatsapp-invoice', async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, branch: true, table: true, employee: true },
  });
  if (!order || !order.customerMobile || !order.customerName) {
    return res.status(404).json({ message: 'Order not found or has no customer details' });
  }
  const branchInfo = order.branch
    ? {
        name: order.branch.name,
        location: order.branch.location,
        logoUrl: order.branch.logoUrl,
        phone: order.branch.phone,
        googleReviewUrl: order.branch.googleReviewUrl,
      }
    : null;
  const acceptedBy = order.employee
    ? { name: order.employee.name, role: order.employee.role ?? 'Counter Staff' }
    : undefined;
  const apiBase = process.env.PUBLIC_API_BASE_URL || '';
  const invoicePdfUrl = apiBase
    ? `${apiBase.replace(/\/$/, '')}/api/orders/${order.id}/invoice-pdf`
    : undefined;
  const invoiceMessage = buildOrderInvoice({
    orderId: order.id,
    customerName: order.customerName,
    items: order.items.map(i => ({
      name: i.name,
      quantity: i.quantity,
      price: i.price,
      variant: i.variant,
      isRemoved: i.isRemoved,
    })),
    totalAmount: order.totalAmount,
    tableNumber: order.table?.tableNumber ?? String(order.tableId),
    branch: branchInfo,
    invoicePdfUrl,
    acceptedBy,
  });
  const waMeLink = getWaMeLink(order.customerMobile, invoiceMessage);
  return res.json({ invoiceMessage, waMeLink });
});

// Public: download professional PDF invoice (INV-YYYY-NNNN.pdf)
orderRouter.get('/:id/invoice-pdf', async (req, res) => {
  const id = Number(req.params.id);
  const order = await prisma.order.findUnique({
    where: { id },
    include: { items: true, branch: true, table: true, employee: true },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });

  const tableNumber = order.table?.tableNumber ?? String(order.tableId);
  const acceptedBy = order.employee
    ? { name: order.employee.name, role: order.employee.role ?? 'Counter Staff' }
    : undefined;
  const orderType =
    (order as any).orderType === 'TAKE_AWAY'
      ? 'Take Away'
      : (order as any).orderType === 'DINE_IN'
        ? 'Dine In'
        : tableNumber === 'Takeaway'
          ? 'Take Away'
          : 'Dine In';
  const statusMap: Record<string, string> = {
    NEW_ORDER: 'Preparing',
    ACCEPTED: 'Preparing',
    PREPARING: 'Preparing',
    SERVED: 'Served',
    ORDER_COMPLETE: 'Completed',
  };
  const paymentMap: Record<string, string> = {
    PAYMENT_PENDING: 'Pending',
    PAID: 'Paid',
    PARTIAL: 'Partial',
    UNPAID: 'Unpaid',
  };

  try {
    const pdfBytes = await generateOrderInvoicePdf({
      id: order.id,
      createdAt: order.createdAt,
      totalAmount: order.totalAmount,
      status: statusMap[order.status] ?? order.status,
      paymentStatus: paymentMap[order.paymentStatus] ?? order.paymentStatus,
      customerName: order.customerName,
      customerMobile: order.customerMobile,
      tableNumber,
      orderType,
      items: order.items.map(i => ({
        name: i.name,
        quantity: i.quantity,
        price: i.price,
        variant: i.variant,
        isRemoved: i.isRemoved,
      })),
      branch: order.branch
        ? {
            name: order.branch.name,
            location: order.branch.location,
            phone: order.branch.phone,
            googleReviewUrl: order.branch.googleReviewUrl,
            logoUrl: order.branch.logoUrl ?? undefined,
          }
        : null,
      acceptedBy,
    });
    const filename = getInvoiceFileName(order.id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('Invoice PDF error:', err);
    return res.status(500).json({ message: 'Failed to generate invoice PDF' });
  }
});

// Public: get order status for customer tracking (lightweight — no auth required)
orderRouter.get('/:id/status', async (req, res) => {
  const id = Number(req.params.id);
  if (isNaN(id)) return res.status(400).json({ message: 'Invalid order id' });
  const order = await prisma.order.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      paymentStatus: true,
      orderType: true,
      totalAmount: true,
      createdAt: true,
      acceptedAt: true,
      completedAt: true,
      customerName: true,
    },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  return res.json(order);
});

// Customer: get active order for table/session
orderRouter.get('/session', async (req, res) => {
  const tableId = Number(req.query.tableId);
  const sessionToken = req.query.sessionToken as string | undefined;

  if (!tableId || !sessionToken) {
    return res.status(400).json({ message: 'tableId and sessionToken required' });
  }

  const order = await prisma.order.findFirst({
    where: {
      tableId,
      sessionToken,
      status: { in: ['NEW_ORDER', 'ACCEPTED', 'PREPARING', 'SERVED'] },
    },
    include: { items: { include: { menuItem: true } }, table: true },
    orderBy: { createdAt: 'desc' },
  });

  return res.json(order);
});

// Admin: unique customer mobiles (for new item broadcast)
orderRouter.get('/customer-mobiles', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const orders = await prisma.order.findMany({
    where: { customerMobile: { not: null } },
    select: { customerMobile: true, customerName: true },
  });
  const seen = new Set<string>();
  const mobiles: { mobile: string; name: string | null }[] = [];
  for (const o of orders) {
    const m = o.customerMobile!.replace(/\D/g, '').slice(-10);
    if (m.length === 10 && !seen.has(m)) {
      seen.add(m);
      mobiles.push({ mobile: m, name: o.customerName });
    }
  }
  return res.json({ mobiles, count: mobiles.length });
});

// Admin or Employee: get live orders (NEW_ORDER..SERVED) + ORDER_COMPLETE (so Pending Payments shows completed-but-unpaid)
// Limited to today (branch timezone, default Asia/Kolkata) so we don't return yesterday's orders.
function getStartOfTodayInTimezone(timeZone = 'Asia/Kolkata'): Date {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-CA', { timeZone }); // "YYYY-MM-DD"
  const [y, m, d] = dateStr.split('-').map(Number);
  // 00:00 in that timezone: for Asia/Kolkata (UTC+5:30), (y,m,d) 00:00 IST = (y,m,d-1) 18:30 UTC
  const utcPrevDay = Date.UTC(y, m - 1, d - 1);
  const istOffsetMs = 18.5 * 60 * 60 * 1000; // 18h30 in ms
  return new Date(utcPrevDay + istOffsetMs);
}

orderRouter.get('/live', authenticate, async (req, res) => {
  try {
    const user = (req as any).user;
    const role = user?.role;
    const userId = user?.id != null ? Number(user.id) : null;

    const timeZone = process.env.TZ || 'Asia/Kolkata';
    const startOfToday = getStartOfTodayInTimezone(timeZone);

    const liveStatuses: OrderStatusEnum[] = [
      OrderStatusEnum.NEW_ORDER,
      OrderStatusEnum.ACCEPTED,
      OrderStatusEnum.PREPARING,
      OrderStatusEnum.SERVED,
      OrderStatusEnum.ORDER_COMPLETE,
    ];
    const where: {
      branchId?: number;
      status: { in: OrderStatusEnum[] };
      createdAt?: { gte: Date };
    } = {
      status: { in: liveStatuses },
      createdAt: { gte: startOfToday },
    };

    if (role === 'EMPLOYEE' && userId != null) {
      const employee = await prisma.employee.findUnique({
        where: { id: userId },
        select: { branchId: true },
      });
      if (employee?.branchId != null) where.branchId = employee.branchId;
    }

    const limitNum = Math.min(Math.max(Number(req.query.limit) || 300, 1), 1000);

    const orders = await prisma.order.findMany({
      where,
      orderBy: { createdAt: 'asc' },
      take: limitNum,
      select: {
        id: true,
        branchId: true,
        tableId: true,
        status: true,
        paymentStatus: true,
        orderType: true,
        totalAmount: true,
        createdAt: true,
        updatedAt: true,
        acceptedAt: true,
        completedAt: true,
        customerName: true,
        customerMobile: true,
        employeeId: true,
        shiftId: true,
        table: { select: { id: true, tableNumber: true } },
        employee: { select: { id: true, name: true } },
        items: {
          orderBy: { id: 'asc' },
          select: {
            id: true,
            name: true,
            quantity: true,
            price: true,
            variant: true,
            isRemoved: true,
            menuItemId: true,
          },
        },
      },
    });

    return res.json(orders);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load live orders';
    const details = err instanceof Error ? err.stack : String(err);
    console.error('GET /orders/live error:', message, details);
    return res.status(500).json({
      message: 'Failed to load live orders. Check server logs.',
      ...(process.env.NODE_ENV === 'development' && { detail: message }),
    });
  }
});

// Admin: get all orders (for dashboard)
orderRouter.get('/all', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { date, status, tableId, startDate, endDate } = req.query;

  let dateFilter = {};
  if (date) {
    // Single "business day" filter: 4 AM → 3:59 AM in branch timezone
    const { start, end } = getBusinessDayRangeForDate({
      date: new Date(date as string),
      boundaryHour: 4,
    });
    dateFilter = { createdAt: { gte: start, lte: end } };
  } else if (startDate || endDate) {
    // Explicit calendar range filter: startDate 00:00 → endDate 23:59
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (startDate) {
      const start = new Date(startDate as string);
      start.setHours(0, 0, 0, 0);
      createdAt.gte = start;
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      createdAt.lte = end;
    }
    dateFilter = Object.keys(createdAt).length ? { createdAt } : {};
  }

  const where: any = {
    ...dateFilter,
  };

  if (status) {
    where.status = status as any;
  }

  if (tableId) {
    where.tableId = Number(tableId);
  }

  const orders = await prisma.order.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    include: {
      items: { include: { menuItem: true } },
      table: true,
      employee: true,
      branch: true,
    },
  });

  // Group by table
  const byTable = new Map();
  for (const order of orders) {
    const key = order.table?.tableNumber || order.tableId;
    if (!byTable.has(key)) {
      byTable.set(key, {
        tableId: order.tableId,
        tableNumber: order.table?.tableNumber || key,
        orders: [],
        totalAmount: 0,
      });
    }
    const table = byTable.get(key);
    table.orders.push(order);
    table.totalAmount += order.totalAmount;
  }

  const totalOrders = orders.length;
  const pendingOrders = orders.filter(o => o.paymentStatus !== 'PAID').length;
  const totalRevenue = orders
    .filter(o => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + (o.totalAmount || 0), 0);

  return res.json({
    orders,
    byTable: Array.from(byTable.values()),
    count: orders.length,
    summary: {
      totalOrders,
      pendingOrders,
      totalRevenue,
    },
  });
});

// Admin: customer leaderboard (aggregate from orders by customerMobile)
orderRouter.get('/customer-leaderboard', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { limit = '20', sortBy = 'orders' } = req.query;
  const limitNum = Math.min(Math.max(Number(limit) || 20, 1), 100);

  const orders = await prisma.order.findMany({
    where: { customerMobile: { not: null } },
    select: {
      customerName: true,
      customerMobile: true,
      totalAmount: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
  });

  const byMobile = new Map<
    string,
    {
      customerName: string | null;
      totalOrders: number;
      totalSpent: number;
      lastOrderDate: string | null;
    }
  >();
  for (const o of orders) {
    const mobile = (o.customerMobile || '').trim();
    if (!mobile) continue;
    const existing = byMobile.get(mobile);
    const name = (o.customerName || '').trim() || null;
    const createdAt = o.createdAt?.toISOString?.() ?? null;
    if (!existing) {
      byMobile.set(mobile, {
        customerName: name,
        totalOrders: 1,
        totalSpent: o.totalAmount ?? 0,
        lastOrderDate: createdAt,
      });
    } else {
      existing.totalOrders += 1;
      existing.totalSpent += o.totalAmount ?? 0;
      if (createdAt && (!existing.lastOrderDate || createdAt > existing.lastOrderDate)) {
        existing.lastOrderDate = createdAt;
      }
      if (name) existing.customerName = name;
    }
  }

  const toDisplayName = (name: string | null): string => {
    const s = (name || '').trim();
    return s === '' ? '—' : s.toUpperCase();
  };
  let list = Array.from(byMobile.entries()).map(([mobile, data]) => ({
    customerMobile: mobile,
    customerName: toDisplayName(data.customerName),
    totalOrders: data.totalOrders,
    totalSpent: data.totalSpent,
    lastOrderDate: data.lastOrderDate,
  }));

  if (sortBy === 'amount') {
    list.sort((a, b) => b.totalSpent - a.totalSpent);
  } else {
    list.sort((a, b) => b.totalOrders - a.totalOrders);
  }
  list = list.slice(0, limitNum);

  return res.json({ leaderboard: list });
});

// Employee: accept order (first to click gets it; locks order to this employee)
orderRouter.post('/:id/accept', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const id = Number(req.params.id);
  const employeeId = req.user!.id;
  const order = await prisma.order.findUnique({
    where: { id },
    include: { branch: true, table: true, employee: true },
  });
  if (!order) return res.status(404).json({ message: 'Order not found' });
  if (order.employeeId != null) {
    return res.status(409).json({
      message: 'Order already accepted by another employee',
      acceptedBy: order.employee
        ? { name: order.employee.name, employeeCode: order.employee.employeeCode }
        : null,
    });
  }
  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee || employee.branchId !== order.branchId) {
    return res.status(403).json({ message: 'You can only accept orders for your branch' });
  }
  const activeShift = await prisma.employeeShift.findFirst({
    where: { employeeId, branchId: order.branchId, shiftEnd: null, status: 'ACTIVE' as any },
  });
  if (!activeShift) {
    return res.status(400).json({ message: 'Start (or resume) your shift first to accept orders' });
  }
  const updated = await prisma.order.update({
    where: { id },
    data: {
      employeeId,
      shiftId: activeShift.id,
      status: OrderStatusEnum.ACCEPTED,
      ...(order.acceptedAt ? {} : { acceptedAt: new Date() }),
    },
    include: { items: true, table: true, employee: true, branch: true },
  });
  req.app.locals.io?.emit('order:updated', updated);
  req.app.locals.io?.to(`branch:${updated.branchId}`)?.emit('order:updated', updated);
  publishOrderStatus({
    id: updated.id,
    status: updated.status,
    acceptedAt: (updated as any).acceptedAt ?? null,
    completedAt: (updated as any).completedAt ?? null,
    updatedAt: (updated as any).updatedAt ?? null,
  });
  let statusWaMeLink: string | null = null;
  const up = updated as typeof updated & {
    table?: { tableNumber: string } | null;
    branch?: {
      name: string;
      location: string | null;
      phone: string | null;
      googleReviewUrl: string | null;
    } | null;
  };
  if (up.customerMobile && up.customerName) {
    const msg = buildStatusMessage({
      orderId: up.id,
      customerName: up.customerName,
      status: 'Accepted',
      tableNumber: up.table?.tableNumber ?? undefined,
      totalAmount: up.totalAmount,
      branch: up.branch
        ? {
            name: up.branch.name,
            location: up.branch.location,
            phone: up.branch.phone,
            googleReviewUrl: up.branch.googleReviewUrl,
          }
        : null,
    });
    statusWaMeLink = getWaMeLink(up.customerMobile, msg);
  }
  return res.json({ order: up, statusWaMeLink });
});

orderRouter.patch('/:id/status', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const id = Number(req.params.id);
  const status = parsed.data.status as OrderStatusEnum;

  const statusUpdateData: { status: OrderStatusEnum; completedAt?: Date | null } = {
    status,
  };
  if (status === OrderStatusEnum.ORDER_COMPLETE) {
    statusUpdateData.completedAt = new Date();
  }

  // Reject can only be applied to unassigned NEW_ORDER.
  if (status === (OrderStatusEnum as any).REJECTED) {
    const existing = await prisma.order.findUnique({
      where: { id },
      select: { id: true, status: true, employeeId: true, shiftId: true },
    });
    if (!existing) return res.status(404).json({ message: 'Order not found' });
    if (existing.status !== OrderStatusEnum.NEW_ORDER || existing.employeeId != null) {
      return res.status(409).json({ message: 'Order cannot be rejected now' });
    }
    const rejected = await prisma.order.update({
      where: { id },
      data: { status: (OrderStatusEnum as any).REJECTED, employeeId: null, shiftId: null },
      include: { branch: true, table: true, items: true, employee: true },
    });
    req.app.locals.io?.emit('order:updated', rejected);
    req.app.locals.io?.to(`branch:${rejected.branchId}`)?.emit('order:updated', rejected);
    publishOrderStatus({
      id: rejected.id,
      status: rejected.status,
      acceptedAt: (rejected as any).acceptedAt ?? null,
      completedAt: (rejected as any).completedAt ?? null,
      updatedAt: (rejected as any).updatedAt ?? null,
    });
    return res.json({ order: rejected, message: 'Order rejected' });
  }

  const order = await prisma.order.update({
    where: { id },
    data: statusUpdateData,
    include: { branch: true, table: true, items: true, employee: true },
  });

  req.app.locals.io?.emit('order:updated', order);
  req.app.locals.io?.to(`branch:${order.branchId}`)?.emit('order:updated', order);
  publishOrderStatus({
    id: order.id,
    status: order.status,
    acceptedAt: (order as any).acceptedAt ?? null,
    completedAt: (order as any).completedAt ?? null,
    updatedAt: (order as any).updatedAt ?? null,
  });

  type OrderWithRelations = typeof order & {
    table?: { tableNumber: string } | null;
    branch?: {
      name: string;
      location: string | null;
      phone: string | null;
      googleReviewUrl: string | null;
    } | null;
  };
  const o = order as OrderWithRelations;

  let statusWhatsAppMessage: string | null = null;
  let statusWaMeLink: string | null = null;
  if (o.customerMobile && o.customerName) {
    const statusLabel =
      status === 'SERVED'
        ? 'Food is ready'
        : status === 'ORDER_COMPLETE'
          ? 'Order completed'
          : status;
    statusWhatsAppMessage = buildStatusMessage({
      orderId: o.id,
      customerName: o.customerName,
      status: statusLabel,
      tableNumber: o.table?.tableNumber ?? undefined,
      totalAmount: o.totalAmount,
      branch: o.branch
        ? {
            name: o.branch.name,
            location: o.branch.location,
            phone: o.branch.phone,
            googleReviewUrl: o.branch.googleReviewUrl,
          }
        : null,
    });
    statusWaMeLink = getWaMeLink(o.customerMobile, statusWhatsAppMessage);
  }

  return res.json({
    order: o,
    ...(statusWhatsAppMessage && statusWaMeLink ? { statusWhatsAppMessage, statusWaMeLink } : {}),
  });
});

// Employee: set/update customer mobile (mandatory for WhatsApp updates)
orderRouter.patch('/:id/customer', authenticate, async (req, res) => {
  const role = (req as any).user?.role;
  if (role !== 'EMPLOYEE' && role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const parsed = updateOrderCustomerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const id = Number(req.params.id);
  const customerName = parsed.data.customerName
    ? (parsed.data.customerName || '').trim().toUpperCase() || undefined
    : undefined;
  const order = await prisma.order.update({
    where: { id },
    data: {
      customerMobile: parsed.data.customerMobile ?? null,
      ...(customerName ? { customerName } : {}),
    },
    include: { items: true, table: true },
  });
  req.app.locals.io?.emit('order:updated', order);
  return res.json(order);
});

// Admin or Employee: delete customer lead mobile across orders (clears customerMobile)
orderRouter.delete('/customer-leads/:mobile', authenticate, async (req, res) => {
  const user = (req as any).user as { id: number; role: 'ADMIN' | 'EMPLOYEE' } | undefined;
  const role = user?.role;
  if (role !== 'EMPLOYEE' && role !== 'ADMIN') {
    return res.status(403).json({ message: 'Forbidden' });
  }
  const raw = String(req.params.mobile || '')
    .replace(/\D/g, '')
    .slice(-10);
  if (raw.length !== 10 || !/^[6-9]/.test(raw)) {
    return res.status(400).json({ message: 'Valid 10-digit mobile number required' });
  }
  const result = await prisma.order.updateMany({
    where: { customerMobile: raw },
    data: { customerMobile: null },
  });
  try {
    await prisma.adminNotification.create({
      data: {
        type: 'CUSTOMER_LEAD_DELETED',
        message: `Customer lead mobile deleted (${raw}) — cleared from ${result.count} order(s).`,
        meta: {
          mobile: raw,
          clearedCount: result.count,
          actorRole: role,
          actorId: user?.id ?? null,
        },
      },
    });
  } catch {
    // ignore audit logging failures
  }
  return res.json({ ok: true, clearedCount: result.count });
});

// Employee: modify order by removing unavailable items
orderRouter.post('/:id/modify', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const parsed = modifyOrderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const orderId = Number(req.params.id);
  const employeeId = req.user!.id;
  const { removedItemIds, reason } = parsed.data;

  // Get current order
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });

  if (!order) {
    return res.status(404).json({ message: 'Order not found' });
  }

  const oldAmount = order.totalAmount;

  // Mark items as removed
  await prisma.orderItem.updateMany({
    where: { id: { in: removedItemIds }, orderId },
    data: {
      isRemoved: true,
      removedAt: new Date(),
      removedBy: employeeId,
      removalReason: reason || 'Item not available',
    },
  });

  // Calculate new total from non-removed items
  const remainingItems = await prisma.orderItem.findMany({
    where: { orderId, isRemoved: false },
  });

  const newAmount = remainingItems.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Update order total and track original amount
  const updatedOrder = await prisma.order.update({
    where: { id: orderId },
    data: {
      totalAmount: newAmount,
      originalAmount: order.originalAmount || oldAmount,
    },
    include: { items: true, table: true },
  });

  // Create removed items report entries
  const removedItems = order.items.filter(item => removedItemIds.includes(item.id));

  await prisma.removedItemsReport.createMany({
    data: removedItems.map(item => ({
      orderId,
      employeeId,
      itemName: item.name,
      quantity: item.quantity,
      unitPrice: item.price,
      totalLoss: item.price * item.quantity,
      reason: reason || 'Item not available',
      date: new Date(),
    })),
  });

  // Track modification
  await prisma.orderModification.create({
    data: {
      orderId,
      modifiedBy: employeeId,
      oldAmount,
      newAmount,
      itemsRemoved: removedItems.map(item => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
      })),
      reason: reason || 'Item not available',
    },
  });

  req.app.locals.io?.emit('order:modified', updatedOrder);
  req.app.locals.io
    ?.to(`branch:${(updatedOrder as any).branchId}`)
    ?.emit('order:modified', updatedOrder);

  return res.json({
    order: updatedOrder,
    removedItems: removedItems.map(item => ({
      name: item.name,
      quantity: item.quantity,
      totalLoss: item.price * item.quantity,
    })),
    oldAmount,
    newAmount,
  });
});

// Employee: modify order (remove + add + edit)
orderRouter.post('/:id/modify-v2', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const parsed = modifyOrderV2Schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const orderId = Number(req.params.id);
  const employeeId = req.user!.id;
  const { removedItemIds, addedItems, updatedItems, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async tx => {
      const order = await tx.order.findUnique({
        where: { id: orderId },
        include: { items: true, table: true },
      });
      if (!order) {
        return { error: { status: 404, message: 'Order not found' } as const };
      }

      const oldAmount = order.totalAmount;

      // 1) Remove (only if not already removed -> prevents duplicate removed items reports)
      const toRemove = removedItemIds.length
        ? order.items.filter(i => removedItemIds.includes(i.id) && !i.isRemoved)
        : [];
      if (toRemove.length) {
        await tx.orderItem.updateMany({
          where: { id: { in: toRemove.map(i => i.id) }, orderId, isRemoved: false },
          data: {
            isRemoved: true,
            removedAt: new Date(),
            removedBy: employeeId,
            removalReason: reason || 'Item not available',
          },
        });

        await tx.removedItemsReport.createMany({
          data: toRemove.map(item => ({
            orderId,
            employeeId,
            itemName: item.name,
            quantity: item.quantity,
            unitPrice: item.price,
            totalLoss: item.price * item.quantity,
            reason: reason || 'Item not available',
            date: new Date(),
          })),
        });
      }

      // 2) Update qty/price/variant (skip removed items)
      const updated: Array<{
        id: number;
        oldQuantity: number;
        newQuantity: number;
        oldUnitPrice: number;
        newUnitPrice: number;
        oldVariant: string | null;
        newVariant: string | null;
      }> = [];
      for (const u of updatedItems) {
        const existing = order.items.find(i => i.id === u.orderItemId);
        if (!existing || existing.isRemoved) continue;
        const nextQty = u.quantity ?? existing.quantity;
        const nextPrice = u.unitPrice ?? existing.price;
        const nextVariant = u.variant === undefined ? existing.variant : (u.variant ?? null);
        if (
          nextQty === existing.quantity &&
          nextPrice === existing.price &&
          nextVariant === (existing.variant ?? null)
        ) {
          continue;
        }
        await tx.orderItem.update({
          where: { id: existing.id },
          data: {
            quantity: nextQty,
            price: nextPrice,
            variant: nextVariant,
          },
        });
        updated.push({
          id: existing.id,
          oldQuantity: existing.quantity,
          newQuantity: nextQty,
          oldUnitPrice: existing.price,
          newUnitPrice: nextPrice,
          oldVariant: existing.variant ?? null,
          newVariant: nextVariant,
        });
      }

      // 3) Add new items
      if (addedItems.length) {
        await tx.orderItem.createMany({
          data: addedItems.map(a => ({
            orderId,
            menuItemId: a.menuItemId ?? null,
            name: a.name,
            quantity: a.quantity,
            price: a.unitPrice,
            variant: a.variant ?? null,
            addedAt: new Date(),
            addedBy: employeeId,
          })),
        });
      }

      // 4) Recompute new total from non-removed items
      const latestItems = await tx.orderItem.findMany({
        where: { orderId },
      });
      const remaining = latestItems.filter(i => !i.isRemoved);
      const newAmount = remaining.reduce((sum, i) => sum + i.price * i.quantity, 0);

      const updatedOrder = await tx.order.update({
        where: { id: orderId },
        data: {
          totalAmount: newAmount,
          originalAmount: order.originalAmount || oldAmount,
        },
        include: { items: true, table: true },
      });

      // 5) Audit row
      await tx.orderModification.create({
        data: {
          orderId,
          modifiedBy: employeeId,
          oldAmount,
          newAmount,
          itemsRemoved: toRemove.map(i => ({
            orderItemId: i.id,
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.price,
            total: i.price * i.quantity,
          })),
          itemsAdded: addedItems.map(a => ({
            name: a.name,
            quantity: a.quantity,
            unitPrice: a.unitPrice,
            total: a.unitPrice * a.quantity,
            variant: a.variant ?? null,
            menuItemId: a.menuItemId ?? null,
          })),
          itemsUpdated: updated.map(u => ({
            orderItemId: u.id,
            oldQuantity: u.oldQuantity,
            newQuantity: u.newQuantity,
            oldUnitPrice: u.oldUnitPrice,
            newUnitPrice: u.newUnitPrice,
            oldVariant: u.oldVariant,
            newVariant: u.newVariant,
          })),
          reason: reason || 'Order modified',
        },
      });

      return { updatedOrder, oldAmount, newAmount, removedCount: toRemove.length };
    });

    if ('error' in result && result.error) {
      return res.status(result.error.status).json({ message: result.error.message });
    }

    req.app.locals.io?.emit('order:modified', result.updatedOrder);
    req.app.locals.io
      ?.to(`branch:${(result.updatedOrder as any).branchId}`)
      ?.emit('order:modified', result.updatedOrder);
    return res.json({
      order: result.updatedOrder,
      oldAmount: result.oldAmount,
      newAmount: result.newAmount,
      removedCount: result.removedCount,
    });
  } catch (err) {
    console.error('POST /orders/:id/modify-v2 error:', err);
    return res.status(500).json({ message: 'Failed to modify order' });
  }
});

// Admin: get removed items report
orderRouter.get('/reports/removed-items', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { date, startDate, endDate } = req.query;

  let dateFilter: any = {};
  if (date) {
    const start = new Date(date as string);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date as string);
    end.setHours(23, 59, 59, 999);
    dateFilter = { createdAt: { gte: start, lte: end } };
  } else if (startDate || endDate) {
    dateFilter.createdAt = {};
    if (startDate) {
      dateFilter.createdAt.gte = new Date(startDate as string);
    }
    if (endDate) {
      const end = new Date(endDate as string);
      end.setHours(23, 59, 59, 999);
      dateFilter.createdAt.lte = end;
    }
  }

  const removedItems = await prisma.removedItemsReport.findMany({
    where: dateFilter,
    orderBy: { createdAt: 'desc' },
    include: {
      order: { include: { table: true } },
      employee: { select: { id: true, name: true } },
    },
  });

  // Calculate daily totals
  const dailyTotals = new Map();
  for (const item of removedItems) {
    const date = item.createdAt.toISOString().slice(0, 10);
    if (!dailyTotals.has(date)) {
      dailyTotals.set(date, {
        date,
        totalItems: 0,
        totalLoss: 0,
        orders: new Set(),
      });
    }
    const day = dailyTotals.get(date);
    day.totalItems += item.quantity;
    day.totalLoss += item.totalLoss;
    day.orders.add(item.orderId);
  }

  const summary = {
    totalItemsRemoved: removedItems.length,
    totalQuantity: removedItems.reduce((sum, item) => sum + item.quantity, 0),
    totalLoss: removedItems.reduce((sum, item) => sum + item.totalLoss, 0),
    uniqueOrders: new Set(removedItems.map(item => item.orderId)).size,
  };

  return res.json({
    removedItems,
    dailyStats: Array.from(dailyTotals.values()).map(d => ({
      ...d,
      orders: d.orders.size,
    })),
    summary,
  });
});

// Admin: get order modifications
orderRouter.get('/reports/modifications', authenticate, requireRole('ADMIN'), async (req, res) => {
  const { date } = req.query;

  let dateFilter: any = {};
  if (date) {
    const start = new Date(date as string);
    start.setHours(0, 0, 0, 0);
    const end = new Date(date as string);
    end.setHours(23, 59, 59, 999);
    dateFilter = { modifiedAt: { gte: start, lte: end } };
  }

  const modifications = await prisma.orderModification.findMany({
    where: dateFilter,
    orderBy: { modifiedAt: 'desc' },
    include: {
      order: { include: { table: true } },
    },
  });

  return res.json(modifications);
});
