/**
 * At 04:05 AM (after shifts auto-close at 04:00) send Daily Business Report email to director(s).
 */
import { prisma } from "../config/prisma.js";
import { mailer, getFromAddress, isMailConfigured } from "../config/mailer.js";

const TIMEZONE = process.env.TZ || "Asia/Kolkata";
const REPORT_HOUR = 4;
const REPORT_MINUTE = 5;

function is405AMInTimezone(): boolean {
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
  return hour === REPORT_HOUR && minute === REPORT_MINUTE;
}

function formatINR(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}

/** Report date = "yesterday" in TIMEZONE (the day that just ended when job runs at 4:05 AM). */
function getReportDate(): { start: Date; end: Date; dateStr: string } {
  const now = new Date();
  const istOffsetMs = (TIMEZONE === "Asia/Kolkata" ? 5.5 : 0) * 60 * 60 * 1000;
  const todayInTz = new Date(now.getTime() + istOffsetMs);
  const y = todayInTz.getUTCFullYear();
  const m = todayInTz.getUTCMonth();
  const d = todayInTz.getUTCDate();
  const yesterdayStartUTC = Date.UTC(y, m, d - 1, 0, 0, 0, 0) - istOffsetMs;
  const yesterdayEndUTC = Date.UTC(y, m, d - 1, 23, 59, 59, 999) - istOffsetMs;
  const start = new Date(yesterdayStartUTC);
  const end = new Date(yesterdayEndUTC);
  const yesterday = new Date(yesterdayStartUTC + istOffsetMs);
  const dateStr = yesterday.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return { start, end, dateStr };
}

export async function runDailyDirectorReport(): Promise<boolean> {
  if (!isMailConfigured()) {
    console.log("[DailyDirectorReport] Mail not configured, skip");
    return false;
  }

  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, directorsEmail: true },
  });
  const directorEmails = [
    ...new Set(
      branches.flatMap((b) =>
        (b.directorsEmail || "")
          .split(/[,\s]+/)
          .map((e) => e.trim())
          .filter((e) => e.length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)),
      ),
    ),
  ];
  if (directorEmails.length === 0) {
    console.log("[DailyDirectorReport] No director emails configured");
    return false;
  }

  const { start, end, dateStr } = getReportDate();

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { items: { select: { name: true, quantity: true, price: true } } },
  });

  const paidOrders = orders.filter((o) => o.paymentStatus === "PAID");
  const totalSales = paidOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const totalOrders = orders.length;
  const completedCount = paidOrders.length;
  const pendingOrders = orders.filter((o) => o.paymentStatus !== "PAID");
  const pendingCount = pendingOrders.length;
  const totalPending = pendingOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const avgOrder = completedCount > 0 ? totalSales / completedCount : 0;

  const itemSales = new Map<string, { qty: number; revenue: number }>();
  for (const order of paidOrders) {
    for (const item of order.items) {
      const key = item.name;
      const cur = itemSales.get(key) ?? { qty: 0, revenue: 0 };
      cur.qty += item.quantity;
      cur.revenue += item.quantity * (item.price ?? 0);
      itemSales.set(key, cur);
    }
  }
  const topItems = [...itemSales.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 10)
    .map(([name, data]) => ({ name, quantity: data.qty, revenue: data.revenue }));

  const lateToday = await prisma.lateEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { employee: { select: { name: true } } },
  });
  const overtimeToday = await prisma.employeeOvertime.findMany({
    where: { shiftDate: { gte: start, lte: end } },
    select: { employeeName: true, overtimeHours: true },
  });

  const fromName = process.env.EMAIL_FROM_NAME || "Cafe Chapter 1";
  const subject = `📊 Daily Business Report – ${dateStr} – Store Performance Summary`;

  const rows = (arr: string[][]) =>
    arr.map((r) => `<tr>${r.map((c) => `<td style="padding:6px 12px;border:1px solid #e2e8f0">${c}</td>`).join("")}</tr>`).join("");

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Daily Report</title></head>
<body style="font-family:system-ui,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#334155">
  <h1 style="color:#047857;margin-bottom:8px">📊 Daily Business Summary</h1>
  <p style="color:#64748b;margin-bottom:24px">Date: ${dateStr}</p>

  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Metric</th><th style="padding:8px 12px;text-align:right">Value</th></tr></thead>
    <tbody>
      ${rows([
        ["Total Sales", formatINR(totalSales)],
        ["Total Orders", String(totalOrders)],
        ["Completed (Paid)", String(completedCount)],
        ["Pending", String(pendingCount)],
        ["Average Order Value", formatINR(avgOrder)],
      ])}
    </tbody>
  </table>

  ${
    topItems.length > 0
      ? `
  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">Top Selling Items</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Item</th><th style="padding:8px 12px;text-align:right">Qty</th><th style="padding:8px 12px;text-align:right">Revenue</th></tr></thead>
    <tbody>
      ${rows(topItems.map((i) => [i.name, String(i.quantity), formatINR(i.revenue)]))}
    </tbody>
  </table>
  `
      : ""
  }

  ${
    lateToday.length > 0 || overtimeToday.length > 0
      ? `
  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">Attendance</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px">Metric</th><th style="padding:8px 12px">Value</th></tr></thead>
    <tbody>
      ${rows([
        ["Employees Late", String(lateToday.length)],
        ["Overtime Records", String(overtimeToday.length)],
      ])}
    </tbody>
  </table>
  `
      : ""
  }

  ${
    pendingCount > 0
      ? `
  <h2 style="color:#b45309;font-size:1.1em;margin-top:24px">⚠ Pending Payment Summary</h2>
  <p>${pendingCount} order(s) still pending. Total: ${formatINR(totalPending)}</p>
  `
      : ""
  }

  <p style="margin-top:32px;color:#64748b;font-size:12px">This report was generated automatically at 04:05 AM after shift auto-close.</p>
</body>
</html>`;

  const text = [
    `Daily Business Report – ${dateStr}`,
    `Total Sales: ${formatINR(totalSales)}`,
    `Total Orders: ${totalOrders} | Completed: ${completedCount} | Pending: ${pendingCount}`,
    `Avg Order: ${formatINR(avgOrder)}`,
    pendingCount > 0 ? `Pending amount: ${formatINR(totalPending)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await mailer.sendMail({
      to: directorEmails,
      from: `"${fromName}" <${getFromAddress()}>`,
      subject,
      text,
      html,
    });
    console.log(`[DailyDirectorReport] Sent to ${directorEmails.length} director(s) for ${dateStr}`);
    return true;
  } catch (e: unknown) {
    console.error("[DailyDirectorReport] Send failed:", (e as Error)?.message ?? e);
    return false;
  }
}

let lastMinute = -1;

export function startDailyDirectorReportCron(): void {
  setInterval(() => {
    const now = new Date();
    const minute = now.getMinutes();
    if (minute === lastMinute) return;
    lastMinute = minute;
    if (!is405AMInTimezone()) return;
    runDailyDirectorReport().catch((e) => console.error("Daily director report error:", e));
  }, 60 * 1000);
}
