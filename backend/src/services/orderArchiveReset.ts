import { prisma } from '../config/prisma.js';

/**
 * Deletes orders whose `createdAt` falls in [from, to] (inclusive), plus dependent rows.
 * PostgreSQL `Order.id` sequence is unchanged (DELETE does not reset SERIAL), so the next
 * new order continues numbering (e.g. 101 after 100).
 *
 * Use the same `from`/`to` as the monthly director report for the closed month.
 */
export async function purgeOrdersCreatedBetween(
  from: Date,
  to: Date
): Promise<{ deletedOrders: number }> {
  const targets = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { id: true },
  });
  const ids = targets.map(o => o.id);
  if (ids.length === 0) {
    return { deletedOrders: 0 };
  }

  await prisma.$transaction(async tx => {
    await tx.paymentRecord.deleteMany({ where: { orderId: { in: ids } } });
    await tx.orderModification.deleteMany({ where: { orderId: { in: ids } } });
    await tx.removedItemsReport.deleteMany({ where: { orderId: { in: ids } } });
    await tx.orderItem.deleteMany({ where: { orderId: { in: ids } } });
    await tx.adminNotification.updateMany({
      where: { orderId: { in: ids } },
      data: { orderId: null },
    });
    await tx.customerQuery.updateMany({
      where: { orderId: { in: ids } },
      data: { orderId: null },
    });
    await tx.order.deleteMany({ where: { id: { in: ids } } });
  });

  return { deletedOrders: ids.length };
}
