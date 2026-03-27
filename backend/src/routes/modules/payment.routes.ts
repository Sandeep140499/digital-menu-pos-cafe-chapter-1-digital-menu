import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { buildPaymentMessage, getWaMeLink } from '../../services/whatsapp.js';

const paymentSchema = z.object({
  paymentStatus: z.enum(['PAID', 'PARTIAL', 'UNPAID', 'PAYMENT_PENDING']),
  paidAmount: z.number().nonnegative().optional(),
  remainingAmount: z.number().nonnegative().optional(),
});

export const paymentRouter = Router();

paymentRouter.patch('/:orderId', authenticate, requireRole('EMPLOYEE'), async (req, res) => {
  const parsed = paymentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const employeeId = req.user!.id;
  const orderId = Number(req.params.orderId);

  const { paymentStatus, paidAmount = 0, remainingAmount = 0 } = parsed.data;

  const existingOrder = await prisma.order.findUnique({
    where: { id: orderId },
    include: { branch: true, items: true },
  });
  if (!existingOrder) {
    return res.status(404).json({ message: 'Order not found' });
  }

  // Business rule: payment flags only after order is completed (kitchen flow done).
  if (
    (paymentStatus === 'PAID' || paymentStatus === 'PAYMENT_PENDING') &&
    existingOrder.status !== 'ORDER_COMPLETE'
  ) {
    return res.status(400).json({
      message: 'Complete the order first, then update payment.',
    });
  }

  const includeReviewLink = paymentStatus === 'PAID' && !existingOrder.reviewSent;

  const prismaPaymentStatus =
    paymentStatus === 'PAID'
      ? 'PAID'
      : paymentStatus === 'PARTIAL'
        ? 'PARTIAL'
        : paymentStatus === 'PAYMENT_PENDING'
          ? 'PAYMENT_PENDING'
          : 'UNPAID';

  const order = await prisma.order.update({
    where: { id: orderId },
    data: {
      paymentStatus: prismaPaymentStatus,
      reviewSent: paymentStatus === 'PAID' && includeReviewLink ? true : existingOrder.reviewSent,
    },
    include: { branch: true, items: true },
  });

  const record = await prisma.paymentRecord.create({
    data: {
      orderId: order.id,
      paymentStatus: prismaPaymentStatus,
      paidAmount,
      remainingAmount,
      confirmedByEmployee: employeeId,
    },
  });

  if (paymentStatus === 'PAID') {
    const shift = await prisma.employeeShift.findFirst({
      where: { employeeId, shiftEnd: null },
    });
    if (shift) {
      await prisma.employeeShift.update({
        where: { id: shift.id },
        data: { totalSales: (shift.totalSales ?? 0) + order.totalAmount },
      });
    }
  }

  const paymentEvent = {
    orderId: order.id,
    paymentStatus: order.paymentStatus,
    branchId: (order as any).branchId,
  };
  req.app.locals.io?.emit('payment:updated', paymentEvent);
  if ((order as any).branchId) {
    req.app.locals.io
      ?.to(`branch:${(order as any).branchId}`)
      ?.emit('payment:updated', paymentEvent);
  }

  let paymentWhatsAppMessage: string | null = null;
  let paymentWaMeLink: string | null = null;
  if (order.customerMobile && order.customerName) {
    const branchInfo = order.branch
      ? {
          name: order.branch.name,
          location: order.branch.location,
          phone: order.branch.phone,
          googleReviewUrl: order.branch.googleReviewUrl,
          showTotalAmountToCustomers: (order.branch as any).showTotalAmountToCustomers,
        }
      : null;
    const waPaymentStatus: 'PAID' | 'PARTIAL' | 'UNPAID' =
      order.paymentStatus === 'PAID'
        ? 'PAID'
        : order.paymentStatus === 'PARTIAL'
          ? 'PARTIAL'
          : 'UNPAID';

    paymentWhatsAppMessage = buildPaymentMessage({
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
      paymentStatus: waPaymentStatus,
      includeReviewLink: paymentStatus === 'PAID' ? includeReviewLink : false,
      branch: branchInfo,
    });
    paymentWaMeLink = getWaMeLink(order.customerMobile, paymentWhatsAppMessage);
  }

  return res.json({
    order,
    record,
    ...(paymentWhatsAppMessage && paymentWaMeLink
      ? { paymentWhatsAppMessage, paymentWaMeLink }
      : {}),
  });
});
