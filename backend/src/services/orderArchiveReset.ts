import { prisma } from "../config/prisma.js";

/**
 * Deletes all rows in order-related tables so the `Order` id sequence keeps incrementing
 * (PostgreSQL: DELETE does not reset SERIAL; next order continues e.g. 101 after 100).
 * Run only after monthly director PDF/email has been sent successfully.
 */
export async function purgeAllOrderData(): Promise<{ deletedOrders: number }> {
  const countBefore = await prisma.order.count();

  await prisma.$transaction(async (tx) => {
    await tx.paymentRecord.deleteMany({});
    await tx.orderModification.deleteMany({});
    await tx.removedItemsReport.deleteMany({});
    await tx.orderItem.deleteMany({});
    await tx.adminNotification.updateMany({
      where: { orderId: { not: null } },
      data: { orderId: null },
    });
    await tx.customerQuery.updateMany({
      where: { orderId: { not: null } },
      data: { orderId: null },
    });
    await tx.order.deleteMany({});
  });

  return { deletedOrders: countBefore };
}
