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

const TIMEZONE = process.env.TZ || "Asia/Kolkata";
const REPORT_HOUR = 4;
const REPORT_MINUTE = 10;

function tzOffsetHours(): number {
  // This codebase runs in Asia/Kolkata; keep behavior consistent with existing daily report logic.
  if (TIMEZONE === "Asia/Kolkata") return 5.5;
  return 0;
}

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

function monthRangeForPreviousMonth(now: Date): {
  monthKey: string;
  monthLabel: string;
  from: Date;
  to: Date;
  fromLabel: string;
  toLabel: string;
  daysInMonth: number;
} {
  const offsetMs = tzOffsetHours() * 60 * 60 * 1000;
  const p = nowPartsInTz(now);
  // Current local month in TZ: y, m0. Previous month:
  const prevMonth0 = p.m0 - 1;
  const year = prevMonth0 < 0 ? p.y - 1 : p.y;
  const month0 = (prevMonth0 + 12) % 12;

  const monthKey = `${year}-${String(month0 + 1).padStart(2, "0")}`;
  const monthLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
    timeZone: TIMEZONE,
  });

  // Map local midnight to UTC by subtracting offset (works for IST, and keeps consistent behavior).
  const startUtc = Date.UTC(year, month0, 1, 0, 0, 0, 0) - offsetMs;
  const endUtc = Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999) - offsetMs;
  const from = new Date(startUtc);
  const to = new Date(endUtc);
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

  const fromLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  });
  const toLabel = new Date(Date.UTC(year, month0 + 1, 0)).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: TIMEZONE,
  });
  return { monthKey, monthLabel, from, to, fromLabel, toLabel, daysInMonth };
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

export async function runMonthlyDirectorReport(): Promise<boolean> {
  if (!isMailConfigured()) {
    console.log("[MonthlyDirectorReport] Mail not configured, skip");
    return false;
  }

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, directorsEmail: true },
  });
  const directorEmails = [
    ...new Set(branches.flatMap((b) => parseDirectorEmails(b.directorsEmail))),
  ];
  if (directorEmails.length === 0) {
    console.log("[MonthlyDirectorReport] No director emails configured");
    return false;
  }

  const now = new Date();
  const { monthKey, monthLabel, from, to, fromLabel, toLabel, daysInMonth } =
    monthRangeForPreviousMonth(now);

  // Orders
  const [totalOrders, paidOrders, paidAgg] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.order.count({
      where: { createdAt: { gte: from, lte: to }, paymentStatus: "PAID" as any },
    }),
    prisma.order.aggregate({
      where: { createdAt: { gte: from, lte: to }, paymentStatus: "PAID" as any },
      _sum: { totalAmount: true },
    }),
  ]);
  const totalRevenue = Number(paidAgg._sum.totalAmount || 0);
  const pendingOrders = Math.max(0, totalOrders - paidOrders);

  // Unique customers (mobile if present else sessionToken)
  const customerRows = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { customerMobile: true, sessionToken: true },
  });
  const customerSet = new Set<string>();
  for (const r of customerRows) {
    const m = (r.customerMobile || "").replace(/\D/g, "").slice(-10);
    if (m.length === 10) customerSet.add(`m:${m}`);
    else if (r.sessionToken) customerSet.add(`s:${r.sessionToken}`);
  }
  const uniqueCustomers = customerSet.size;

  // Losses (removed items report)
  const lossAgg = await prisma.removedItemsReport.aggregate({
    where: { createdAt: { gte: from, lte: to } },
    _sum: { totalLoss: true },
  });
  const totalLosses = Number(lossAgg._sum.totalLoss || 0);

  const avgDailySale = daysInMonth > 0 ? totalRevenue / daysInMonth : 0;
  const avgDailyOrders = daysInMonth > 0 ? totalOrders / daysInMonth : 0;

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
    totalLosses,
    avgDailySale,
    avgDailyOrders,
  });

  const subject = `Monthly Director Report – ${monthLabel} (${monthKey})`;
  const text = [
    `Monthly Director Report – ${monthLabel}`,
    `Period: ${fromLabel} to ${toLabel}`,
    `Revenue (Paid): ${formatINR(totalRevenue)}`,
    `Orders: ${totalOrders} | Paid: ${paidOrders} | Pending: ${pendingOrders}`,
    `Unique customers: ${uniqueCustomers}`,
    `Losses: ${formatINR(totalLosses)}`,
    `Avg daily sale: ${formatINR(avgDailySale)}`,
    `Avg daily orders: ${Math.round(avgDailyOrders * 10) / 10}`,
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
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Unique customers</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${uniqueCustomers}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Losses</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatINR(totalLosses)}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Avg daily sale</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${formatINR(avgDailySale)}</td></tr>
      <tr><td style="padding:6px 12px;border:1px solid #e2e8f0">Avg daily orders</td><td style="padding:6px 12px;border:1px solid #e2e8f0;text-align:right">${Math.round(avgDailyOrders * 10) / 10}</td></tr>
    </tbody>
  </table>
  <p style="color:#64748b;font-size:12px">A detailed PDF report is attached.</p>
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

    const purgeEnabled =
      String(process.env.ORDER_PURGE_AFTER_MONTHLY_REPORT || "")
        .trim()
        .toLowerCase() === "true";
    if (purgeEnabled) {
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
    } else {
      console.log(
        "[MonthlyDirectorReport] Order purge skipped (set ORDER_PURGE_AFTER_MONTHLY_REPORT=true on Railway to enable after successful email).",
      );
    }

    return true;
  } catch (e: unknown) {
    console.error("[MonthlyDirectorReport] Send failed:", (e as Error)?.message ?? e);
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

