/**
 * At 12:00 AM (midnight) check for orders still pending payment and create one summary notification for admin.
 */
import cron from "node-cron";
import { prisma } from "../config/prisma.js";

const TIMEZONE = process.env.TZ || "Asia/Kolkata";

function isMidnightInTimezone(): boolean {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour === 0 && minute === 0;
}

export async function runPendingPaymentAlert(): Promise<number> {
  const pendingOrders = await prisma.order.findMany({
    where: {
      paymentStatus: { in: ["PAYMENT_PENDING", "PARTIAL", "UNPAID"] },
    },
    select: { id: true, totalAmount: true, branchId: true },
    orderBy: { id: "asc" },
  });

  if (pendingOrders.length === 0) return 0;

  const totalPending = pendingOrders.reduce((sum, o) => sum + (o.totalAmount ?? 0), 0);
  const totalRounded = Math.round(totalPending);
  const orderList = pendingOrders.slice(0, 20).map((o) => `#${o.id} ₹${Math.round(o.totalAmount ?? 0)}`).join(", ");
  const more = pendingOrders.length > 20 ? ` (+${pendingOrders.length - 20} more)` : "";
  const message =
    pendingOrders.length === 1
      ? `Pending payment for Order #${pendingOrders[0].id} (₹${Math.round(pendingOrders[0].totalAmount ?? 0)})`
      : `${pendingOrders.length} payments still pending at 12 AM. Total ₹${totalRounded}. ${orderList}${more}`;

  await prisma.adminNotification.create({
    data: {
      type: "PAYMENT_PENDING",
      message,
      meta: {
        count: pendingOrders.length,
        totalPending: totalRounded,
        orderIds: pendingOrders.map((o) => o.id),
      },
      isRead: false,
    },
  });

  console.log(`[PendingPaymentAlert] 12 AM: created notification for ${pendingOrders.length} pending order(s), total ₹${totalRounded}`);
  return pendingOrders.length;
}

let lastMinute = -1;

export function startPendingPaymentCron(): void {
  setInterval(() => {
    const now = new Date();
    const minute = now.getMinutes();
    if (minute === lastMinute) return;
    lastMinute = minute;
    if (!isMidnightInTimezone()) return;
    runPendingPaymentAlert().catch((e) => console.error("Pending payment alert error:", e));
  }, 60 * 1000);
}
