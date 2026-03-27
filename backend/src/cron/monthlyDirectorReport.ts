/**
 * At 04:10 AM on the 1st day of each month (TIMEZONE), send Monthly Business Report PDF to director(s).
 * Month range is calendar month: 01..last day (28/29/30/31).
 */
import { prisma } from "../config/prisma.js";
import { isMailConfigured, sendEmail } from "../config/mailer.js";
import {
  generateMonthlyDirectorReportPdf,
  getMonthlyDirectorReportFileName,
} from "../services/directorMonthlyReportPdf.js";
import { getPreviousCalendarMonthBounds } from "../utils/calendarMonth.js";

const TIMEZONE = process.env.TZ || "Asia/Kolkata";
const REPORT_HOUR = 4;
const REPORT_MINUTE = 10;

function nowPartsInTz(now: Date): { y: number; m0: number; d: number; hh: number; mm: number } {
  const dateStr = now.toLocaleDateString("en-CA", { timeZone: TIMEZONE }); // YYYY-MM-DD
  const [y, m, d] = dateStr.split("-").map(Number);
  const parts = new Intl.DateTimeFormat("en-IN", {
    timeZone: TIMEZONE,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(now);
  const hh = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const mm = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return { y, m0: m - 1, d, hh, mm };
}

function isMonthStartTime(now: Date): boolean {
  const p = nowPartsInTz(now);
  return p.d === 1 && p.hh === REPORT_HOUR && p.mm === REPORT_MINUTE;
}

function parseDirectorEmails(input: string | null | undefined): string[] {
  return (input || "")
    .split(/[,\s]+/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
}

function formatINR(n: number): string {
  return "₹" + Math.round(Number(n) || 0).toLocaleString("en-IN");
}

function formatPct(n: number): string {
  return `${Math.round((Number(n) || 0) * 10) / 10}%`;
}

export async function runMonthlyDirectorReport(): Promise<boolean> {
  const now = new Date();
  const { monthKey, monthLabel, from, to, fromLabel, toLabel, daysInMonth } =
    getPreviousCalendarMonthBounds(now);
  const [snapYear, snapMonth] = monthKey.split("-").map(Number);
  const prevMonthFrom = new Date(from);
  prevMonthFrom.setMonth(prevMonthFrom.getMonth() - 1);
  prevMonthFrom.setDate(1);
  prevMonthFrom.setHours(0, 0, 0, 0);
  const prevMonthTo = new Date(from);
  prevMonthTo.setMilliseconds(-1);
  const prevMonthDays = new Date(
    prevMonthFrom.getFullYear(),
    prevMonthFrom.getMonth() + 1,
    0,
  ).getDate();

  let snapshotSuccess = false;
  const { computeMonthlyMetrics, upsertMonthlyRevenueSnapshot } = await import(
    "../services/monthlyRevenueSnapshot.js"
  );
  let metrics: Awaited<ReturnType<typeof computeMonthlyMetrics>>;
  try {
    metrics = await computeMonthlyMetrics(from, to, daysInMonth);
  } catch (e: unknown) {
    console.error(
      "[MonthlyDirectorReport] Metrics computation failed:",
      (e as Error)?.message ?? e,
    );
    return false;
  }
  try {
    await upsertMonthlyRevenueSnapshot(
      monthKey,
      snapYear,
      snapMonth,
      from,
      to,
      daysInMonth,
      metrics,
    );
    snapshotSuccess = true;
    console.log(
      `[MonthlyDirectorReport] Monthly revenue snapshot saved for ${monthKey} (persists after order purge).`,
    );
  } catch (e: unknown) {
    console.error(
      "[MonthlyDirectorReport] Snapshot upsert failed:",
      (e as Error)?.message ?? e,
    );
  }

  const totalOrders = metrics.totalOrders;
  const totalRevenue = metrics.totalSales;
  const paidOrders = metrics.paidOrdersCount;
  const pendingOrders = Math.max(0, totalOrders - paidOrders);
  const uniqueCustomers = metrics.uniqueCustomers;
  const newCustomersCount = metrics.newCustomersCount;
  const totalLosses = metrics.totalLoss;
  const avgDailySale = daysInMonth > 0 ? totalRevenue / daysInMonth : 0;
  const avgDailyOrders = daysInMonth > 0 ? totalOrders / daysInMonth : 0;
  const paymentCollectionRate =
    totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;
  const monthlyTargetRow = await prisma.monthlyTarget.findUnique({
    where: { yearMonth: monthKey },
    select: { targetAmount: true },
  });
  const monthlyTarget = Number(monthlyTargetRow?.targetAmount ?? 0);
  const monthlyTargetSet = monthlyTarget > 0;
  const targetAchievementPct =
    monthlyTargetSet ? (totalRevenue / monthlyTarget) * 100 : null;
  const monthlyExpenses = Number(process.env.MONTHLY_EXPENSES_INR || 0);
  const totalCostProxy = totalLosses + monthlyExpenses;
  const netProfit = totalRevenue - totalCostProxy;
  const profitMarginPct = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  let previousMonthRevenue = 0;
  let previousMonthOrders = 0;
  try {
    const prevMetrics = await computeMonthlyMetrics(
      prevMonthFrom,
      prevMonthTo,
      prevMonthDays,
    );
    previousMonthRevenue = prevMetrics.totalSales;
    previousMonthOrders = prevMetrics.totalOrders;
  } catch (e: unknown) {
    console.warn(
      "[MonthlyDirectorReport] Previous-month metrics unavailable:",
      (e as Error)?.message ?? e,
    );
  }
  const revenueVsPreviousMonthPct =
    previousMonthRevenue > 0
      ? ((totalRevenue - previousMonthRevenue) / previousMonthRevenue) * 100
      : totalRevenue > 0
        ? 100
        : 0;
  const ordersVsPreviousMonthPct =
    previousMonthOrders > 0
      ? ((totalOrders - previousMonthOrders) / previousMonthOrders) * 100
      : totalOrders > 0
        ? 100
        : 0;

  const paidOrdersWithItems = await prisma.order.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      paymentStatus: "PAID",
    },
    select: {
      createdAt: true,
      totalAmount: true,
      items: { select: { name: true, quantity: true } },
    },
  });
  const byDay = new Map<string, { orders: number; revenue: number; itemQty: Map<string, number> }>();
  for (const order of paidOrdersWithItems) {
    const d = new Date(order.createdAt).toISOString().slice(0, 10);
    const cur = byDay.get(d) ?? { orders: 0, revenue: 0, itemQty: new Map<string, number>() };
    cur.orders += 1;
    cur.revenue += Number(order.totalAmount ?? 0);
    for (const it of order.items) {
      cur.itemQty.set(it.name, (cur.itemQty.get(it.name) ?? 0) + (it.quantity ?? 0));
    }
    byDay.set(d, cur);
  }
  let bestDay:
    | { date: string; orders: number; revenue: number; topItem: string; topItemQty: number }
    | null = null;
  for (const [date, v] of byDay.entries()) {
    const topItemEntry =
      [...v.itemQty.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["N/A", 0];
    if (!bestDay || v.revenue > bestDay.revenue) {
      bestDay = {
        date,
        orders: v.orders,
        revenue: v.revenue,
        topItem: topItemEntry[0],
        topItemQty: topItemEntry[1],
      };
    }
  }

  const purgeEnabled =
    String(process.env.ORDER_PURGE_AFTER_MONTHLY_REPORT || "")
      .trim()
      .toLowerCase() === "true";
  const purgeWithoutEmail =
    String(process.env.ORDER_PURGE_WITHOUT_EMAIL || "")
      .trim()
      .toLowerCase() === "true";

  async function runOrderPurgeIfEligible(emailSent: boolean): Promise<void> {
    if (!purgeEnabled) return;
    if (!snapshotSuccess) {
      console.log(
        "[MonthlyDirectorReport] Order purge skipped (snapshot did not save).",
      );
      return;
    }
    if (!emailSent && !purgeWithoutEmail) {
      console.log(
        "[MonthlyDirectorReport] Order purge skipped (email not sent). Set ORDER_PURGE_WITHOUT_EMAIL=true to purge after snapshot when mail/directors are missing.",
      );
      return;
    }
    try {
      const { purgeOrdersCreatedBetween } = await import(
        "../services/orderArchiveReset.js"
      );
      const { deletedOrders } = await purgeOrdersCreatedBetween(from, to);
      console.log(
        `[MonthlyDirectorReport] Purged orders for reported month ${monthKey} only (${from.toISOString().slice(0, 10)}…${to.toISOString().slice(0, 10)}): ${deletedOrders} row(s); next Order id continues from sequence.`,
      );
    } catch (pErr: unknown) {
      console.error(
        "[MonthlyDirectorReport] Order purge failed (orders NOT cleared):",
        (pErr as Error)?.message ?? pErr,
      );
    }
  }

  if (!isMailConfigured()) {
    console.log("[MonthlyDirectorReport] Mail not configured, skip email");
    await runOrderPurgeIfEligible(false);
    return true;
  }

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, directorsEmail: true },
  });
  const directorEmails = [
    ...new Set(branches.flatMap((b) => parseDirectorEmails(b.directorsEmail))),
  ];
  if (directorEmails.length === 0) {
    console.log("[MonthlyDirectorReport] No director emails configured, skip email");
    await runOrderPurgeIfEligible(false);
    return true;
  }

  const pdfBytes = await generateMonthlyDirectorReportPdf({
    monthLabel,
    monthKey,
    fromDateLabel: fromLabel,
    toDateLabel: toLabel,
    totalRevenue,
    totalOrders,
    paidOrders,
    pendingOrders,
    uniqueCustomers,
    newCustomersCount,
    totalLosses,
    avgDailySale,
    avgDailyOrders,
    paymentCollectionRate,
    netProfit,
    profitMarginPct,
    targetAchievementPct,
    monthlyTarget,
    revenueVsPreviousMonthPct,
    ordersVsPreviousMonthPct,
    bestDay,
    monthlyExpenses,
  });

  const subject = `Monthly Director Report – ${monthLabel} (${monthKey})`;
  const text = [
    `Monthly Director Report – ${monthLabel}`,
    `Period: ${fromLabel} to ${toLabel}`,
    `Revenue (Paid): ${formatINR(totalRevenue)}`,
    `Orders: ${totalOrders} | Paid: ${paidOrders} | Pending: ${pendingOrders}`,
    `Unique customers (month): ${uniqueCustomers}`,
    `New customers (first order in month): ${newCustomersCount}`,
    `Losses: ${formatINR(totalLosses)}`,
    monthlyExpenses > 0 ? `Manual monthly expenses: ${formatINR(monthlyExpenses)}` : "",
    `Net profit (proxy): ${formatINR(netProfit)}`,
    `Profit margin: ${formatPct(profitMarginPct)}`,
    `Avg daily sale: ${formatINR(avgDailySale)}`,
    `Avg daily orders: ${Math.round(avgDailyOrders * 10) / 10}`,
    `Payment collection rate: ${formatPct(paymentCollectionRate)}`,
    monthlyTargetSet
      ? `Target achievement: ${formatPct(targetAchievementPct ?? 0)} of ${formatINR(monthlyTarget)}`
      : `Target achievement: target not set`,
    `Vs previous month - Revenue: ${revenueVsPreviousMonthPct >= 0 ? "+" : ""}${formatPct(revenueVsPreviousMonthPct)}, Orders: ${ordersVsPreviousMonthPct >= 0 ? "+" : ""}${formatPct(ordersVsPreviousMonthPct)}`,
    bestDay
      ? `Best day: ${bestDay.date} (${bestDay.orders} paid orders, ${formatINR(bestDay.revenue)}) | Reason: top item ${bestDay.topItem} (${bestDay.topItemQty})`
      : "",
  ].join("\n");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Monthly Director Report</title></head>
<body style="font-family:system-ui,sans-serif;max-width:680px;margin:0 auto;padding:24px;color:#334155">
  <h1 style="color:#047857;margin-bottom:8px">Monthly Director Report</h1>
  <p style="color:#64748b;margin-bottom:18px">${monthLabel} • ${fromLabel} – ${toLabel}</p>
  <table style="width:100%;border-collapse:collapse;margin-bottom:18px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Metric</th><th style="padding:8px 12px;text-align:right">Value</th></tr></thead>
    <tbody>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Revenue (Paid)</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatINR(totalRevenue)}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Total orders</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${totalOrders}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Paid orders</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${paidOrders}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Pending orders</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${pendingOrders}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Unique customers (month)</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${uniqueCustomers}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">New customers (first order)</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${newCustomersCount}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Losses</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatINR(totalLosses)}</td></tr>
      ${
        monthlyExpenses > 0
          ? `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Manual monthly expenses</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatINR(monthlyExpenses)}</td></tr>`
          : ""
      }
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Net profit (proxy)</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatINR(netProfit)}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Profit margin</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatPct(profitMarginPct)}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Avg daily sale</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatINR(avgDailySale)}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Avg daily orders</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${Math.round(avgDailyOrders * 10) / 10}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Payment collection rate</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatPct(paymentCollectionRate)}</td></tr>
      ${
        monthlyTargetSet
          ? `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Target achievement</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatPct(targetAchievementPct ?? 0)} of ${formatINR(monthlyTarget)}</td></tr>`
          : `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Target achievement</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">Target not set</td></tr>`
      }
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Revenue vs previous month</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${revenueVsPreviousMonthPct >= 0 ? "▲" : "▼"} ${formatPct(Math.abs(revenueVsPreviousMonthPct))}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Orders vs previous month</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${ordersVsPreviousMonthPct >= 0 ? "▲" : "▼"} ${formatPct(Math.abs(ordersVsPreviousMonthPct))}</td></tr>
    </tbody>
  </table>
  ${
    bestDay
      ? `<p style="margin:0 0 16px 0"><strong>Best performing day:</strong> ${bestDay.date} (${bestDay.orders} paid orders, ${formatINR(bestDay.revenue)}). <strong>Reason:</strong> highest paid revenue; top item was ${bestDay.topItem} (${bestDay.topItemQty} sold).</p>`
      : ""
  }
  <p style="color:#64748b;font-size:12px">A detailed PDF report is attached.</p>
  <p style="color:#64748b;font-size:12px">Note: Net profit uses a proxy (paid revenue minus removed-item losses and optional manual monthly expenses). For full accounting profit, an expense ledger is required.</p>
</body></html>`;

  try {
    await sendEmail({
      to: directorEmails,
      subject,
      text,
      html,
      attachments: [
        {
          filename: getMonthlyDirectorReportFileName(monthKey),
          content: Buffer.from(pdfBytes),
          contentType: "application/pdf",
        },
      ],
    });
    console.log(`[MonthlyDirectorReport] Sent to ${directorEmails.length} director(s) for ${monthKey}`);

    await runOrderPurgeIfEligible(true);
    return true;
  } catch (e: unknown) {
    console.error("[MonthlyDirectorReport] Send failed:", (e as Error)?.message ?? e);
    await runOrderPurgeIfEligible(false);
    return false;
  }
}

let lastMinute = -1;

export function startMonthlyDirectorReportCron(): void {
  setInterval(() => {
    const now = new Date();
    const minute = now.getMinutes();
    if (minute === lastMinute) return;
    lastMinute = minute;
    if (!isMonthStartTime(now)) return;
    runMonthlyDirectorReport().catch((e) =>
      console.error("Monthly director report error:", e),
    );
  }, 60 * 1000);
}

