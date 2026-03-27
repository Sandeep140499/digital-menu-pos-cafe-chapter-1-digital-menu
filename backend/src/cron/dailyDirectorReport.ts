/**
 * At 04:05 AM (after shifts auto-close at 04:00) send Daily Business Report email to director(s).
 */
import { prisma } from "../config/prisma.js";
import { isMailConfigured, sendEmail } from "../config/mailer.js";
import { upsertDailyRevenueEntry } from "../services/monthlyTargetService.js";

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

function formatPct(n: number): string {
  return `${Math.round((Number(n) || 0) * 10) / 10}%`;
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
  const previousStart = new Date(start);
  previousStart.setDate(previousStart.getDate() - 1);
  const previousEnd = new Date(end);
  previousEnd.setDate(previousEnd.getDate() - 1);
  const lastWeekStart = new Date(start);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);
  const lastWeekEnd = new Date(end);
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

  const orders = await prisma.order.findMany({
    where: { createdAt: { gte: start, lte: end } },
    include: { items: { select: { name: true, quantity: true, price: true } } },
  });
  const prevOrders = await prisma.order.findMany({
    where: { createdAt: { gte: previousStart, lte: previousEnd } },
    select: { paymentStatus: true, totalAmount: true },
  });
  const lastWeekOrders = await prisma.order.findMany({
    where: { createdAt: { gte: lastWeekStart, lte: lastWeekEnd } },
    select: { paymentStatus: true, totalAmount: true },
  });

  const paidOrders = orders.filter((o) => o.paymentStatus === "PAID");
  const totalSales = paidOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const totalOrders = orders.length;
  const completedCount = paidOrders.length;
  const partiallyPaidCount = orders.filter((o) => o.paymentStatus === "PARTIAL").length;
  const pendingOrders = orders.filter((o) => o.paymentStatus !== "PAID");
  const pendingCount = pendingOrders.length;
  const totalPending = pendingOrders.reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const avgOrder = completedCount > 0 ? totalSales / completedCount : 0;
  const cancelledOrRejectedCount = orders.filter((o) => o.status === "REJECTED").length;

  // Persist daily revenue snapshot for historical tracking/reporting.
  await upsertDailyRevenueEntry({
    businessDate: start,
    totalOrders,
    paidOrders: completedCount,
    totalRevenue: totalSales,
  });

  const dailySalesTarget = Number(process.env.DAILY_SALES_TARGET_INR || 0);
  const manualDailyExpenses = Number(process.env.DAILY_EXPENSES_INR || 0);
  const targetAchievedPct =
    dailySalesTarget > 0 ? (totalSales / dailySalesTarget) * 100 : null;
  const paymentCollectionRate =
    totalOrders > 0 ? (completedCount / totalOrders) * 100 : 0;

  const prevPaidSales = prevOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const salesDeltaPct =
    prevPaidSales > 0
      ? ((totalSales - prevPaidSales) / prevPaidSales) * 100
      : totalSales > 0
        ? 100
        : 0;
  const ordersDeltaPct =
    prevOrders.length > 0
      ? ((totalOrders - prevOrders.length) / prevOrders.length) * 100
      : totalOrders > 0
        ? 100
        : 0;
  const lastWeekPaidSales = lastWeekOrders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((s, o) => s + (o.totalAmount ?? 0), 0);
  const salesVsLastWeekPct =
    lastWeekPaidSales > 0
      ? ((totalSales - lastWeekPaidSales) / lastWeekPaidSales) * 100
      : totalSales > 0
        ? 100
        : 0;
  const ordersVsLastWeekPct =
    lastWeekOrders.length > 0
      ? ((totalOrders - lastWeekOrders.length) / lastWeekOrders.length) * 100
      : totalOrders > 0
        ? 100
        : 0;

  // No explicit cost/expense table exists yet; use a conservative operational proxy.
  const removedItemsToday = await prisma.removedItemsReport.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { totalLoss: true },
  });
  const totalLoss = removedItemsToday.reduce((s, r) => s + (r.totalLoss || 0), 0);
  const totalCostsProxy = totalLoss + manualDailyExpenses;
  const netAfterLoss = totalSales - totalCostsProxy;

  const monthStart = new Date(start);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthSoFarPaid = await prisma.order.aggregate({
    where: {
      createdAt: { gte: monthStart, lte: end },
      paymentStatus: "PAID",
    },
    _sum: { totalAmount: true },
  });
  const monthSoFarSales = Number(monthSoFarPaid._sum.totalAmount ?? 0);
  const dayOfMonth = end.getDate();
  const daysInMonth = new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
  const monthlyYear = end.getFullYear();
  const monthlyMonth = end.getMonth() + 1;
  const monthlyYearMonth = `${monthlyYear}-${String(monthlyMonth).padStart(2, "0")}`;
  const monthlyTargetRow = await prisma.monthlyTarget.findUnique({
    where: { yearMonth: monthlyYearMonth },
    select: { targetAmount: true },
  });
  const monthlySalesTarget = Number(monthlyTargetRow?.targetAmount ?? 0);
  const monthlyTargetSet = monthlySalesTarget > 0;
  const monthlyAchievedPct = monthlyTargetSet
    ? (monthSoFarSales / monthlySalesTarget) * 100
    : null;
  const monthLabel = new Date(monthlyYear, monthlyMonth - 1, 1).toLocaleDateString(
    "en-IN",
    { month: "long" },
  );
  const monthPaceExpected =
    monthlyTargetSet ? (monthlySalesTarget * dayOfMonth) / Math.max(1, daysInMonth) : 0;
  const monthPacePct =
    monthlyTargetSet ? (monthSoFarSales / Math.max(1, monthPaceExpected)) * 100 : null;
  const daysLeftInMonth = Math.max(0, daysInMonth - dayOfMonth);
  const monthlyTargetStatus = !monthlyTargetSet
    ? "TARGET_NOT_SET"
    : (monthlyAchievedPct ?? 0) >= 100
      ? "ON_TRACK"
      : (monthlyAchievedPct ?? 0) >= 40
        ? "NEED_TO_PUSH"
        : "CRITICAL";
  const monthlyTargetStatusLabel =
    monthlyTargetStatus === "ON_TRACK"
      ? "✓ ON TRACK"
      : monthlyTargetStatus === "NEED_TO_PUSH"
        ? "⚠️ NEED TO PUSH"
        : monthlyTargetStatus === "CRITICAL"
          ? "🔴 CRITICAL"
          : "Target not set";

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

  const hourBuckets = new Map<number, { orders: number; revenue: number }>();
  for (const o of paidOrders) {
    const h = new Date(o.createdAt).getHours();
    const cur = hourBuckets.get(h) ?? { orders: 0, revenue: 0 };
    cur.orders += 1;
    cur.revenue += o.totalAmount ?? 0;
    hourBuckets.set(h, cur);
  }
  const peakHours = [...hourBuckets.entries()]
    .sort((a, b) => b[1].orders - a[1].orders || b[1].revenue - a[1].revenue)
    .slice(0, 3)
    .map(([hour, data]) => ({
      hourLabel: `${hour.toString().padStart(2, "0")}:00-${((hour + 1) % 24).toString().padStart(2, "0")}:00`,
      orders: data.orders,
      revenue: data.revenue,
    }));

  const lateToday = await prisma.lateEntry.findMany({
    where: { date: { gte: start, lte: end } },
    include: { employee: { select: { name: true } } },
  });
  const overtimeToday = await prisma.employeeOvertime.findMany({
    where: { shiftDate: { gte: start, lte: end } },
    select: { employeeName: true, overtimeHours: true },
  });
  const customerFeedback = await prisma.customerQuery.findMany({
    where: { createdAt: { gte: start, lte: end } },
    select: { issueType: true, status: true },
  });
  const feedbackOpenCount = customerFeedback.filter((q) => q.status !== "RESOLVED").length;

  const prepRows = await prisma.order.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      acceptedAt: { not: null },
      completedAt: { not: null },
    },
    select: { acceptedAt: true, completedAt: true },
  });
  const prepMinutes = prepRows
    .map((r) => {
      const ms = new Date(r.completedAt as Date).getTime() - new Date(r.acceptedAt as Date).getTime();
      return ms >= 0 ? ms / 60000 : null;
    })
    .filter((v): v is number => Number.isFinite(v));
  const avgPrepMins =
    prepMinutes.length > 0
      ? prepMinutes.reduce((s, v) => s + v, 0) / prepMinutes.length
      : 0;
  const fastestPrepMins = prepMinutes.length > 0 ? Math.min(...prepMinutes) : 0;
  const slowestPrepMins = prepMinutes.length > 0 ? Math.max(...prepMinutes) : 0;

  const activeEmployees = await prisma.employee.count({
    where: { status: "ACTIVE" },
  });
  const shiftsToday = await prisma.employeeShift.findMany({
    where: { shiftStart: { gte: start, lte: end } },
    select: { employeeId: true },
  });
  const presentCount = new Set(shiftsToday.map((s) => s.employeeId)).size;
  const absentCount = Math.max(0, activeEmployees - presentCount);

  const staffRows = await prisma.order.groupBy({
    by: ["employeeId"],
    where: {
      createdAt: { gte: start, lte: end },
      paymentStatus: "PAID",
      employeeId: { not: null },
    },
    _count: { _all: true },
    _sum: { totalAmount: true },
  });
  const topEmployeeId = staffRows
    .sort((a, b) => (b._sum.totalAmount ?? 0) - (a._sum.totalAmount ?? 0))[0]?.employeeId;
  const topEmployee = topEmployeeId
    ? await prisma.employee.findUnique({
        where: { id: topEmployeeId },
        select: { name: true, employeeCode: true },
      })
    : null;
  const topStaff = topEmployee
    ? staffRows.find((r) => r.employeeId === topEmployeeId)
    : null;

  const alerts: string[] = [];
  if (dailySalesTarget > 0 && (targetAchievedPct ?? 0) < 70) {
    alerts.push(`Sales achieved only ${formatPct(targetAchievedPct ?? 0)} of target.`);
  }
  if (paymentCollectionRate < 80 && totalOrders >= 5) {
    alerts.push(`Payment collection is low at ${formatPct(paymentCollectionRate)}.`);
  }
  if (pendingCount >= 5 || (totalOrders > 0 && pendingCount / totalOrders >= 0.3)) {
    alerts.push(`Pending orders high: ${pendingCount} (${formatPct((pendingCount / Math.max(1, totalOrders)) * 100)}).`);
  }
  if (avgPrepMins > 25 && prepMinutes.length >= 5) {
    alerts.push(`Average prep time elevated: ${Math.round(avgPrepMins)} mins.`);
  }
  if (feedbackOpenCount >= 3) {
    alerts.push(`Open customer issues: ${feedbackOpenCount}.`);
  }
  if (lateToday.length >= 3) {
    alerts.push(`Staff punctuality issue: ${lateToday.length} late entries.`);
  }
  if (monthlyTargetSet && (monthPacePct ?? 100) < 90) {
    alerts.push(`Monthly pace below target at ${formatPct(monthPacePct ?? 0)}.`);
  }

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
        ["Partial Payments", String(partiallyPaidCount)],
        ["Payment Collection Rate", formatPct(paymentCollectionRate)],
        ...(dailySalesTarget > 0
          ? [
              ["Sales Target", formatINR(dailySalesTarget)],
              ["Target Achieved", formatPct(targetAchievedPct ?? 0)],
            ]
          : []),
        ["Net (Revenue - Removed-item Loss)", formatINR(netAfterLoss)],
        ["Removed-item Loss", formatINR(totalLoss)],
        ...(manualDailyExpenses > 0 ? [["Manual Daily Expenses", formatINR(manualDailyExpenses)]] : []),
      ])}
    </tbody>
  </table>

  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">📈 vs Yesterday</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Metric</th><th style="padding:8px 12px;text-align:right">Value</th></tr></thead>
    <tbody>
      ${rows([
        ["Sales Change", `${salesDeltaPct >= 0 ? "▲" : "▼"} ${formatPct(Math.abs(salesDeltaPct))}`],
        ["Orders Change", `${ordersDeltaPct >= 0 ? "▲" : "▼"} ${formatPct(Math.abs(ordersDeltaPct))}`],
        ["Sales vs Same Day Last Week", `${salesVsLastWeekPct >= 0 ? "▲" : "▼"} ${formatPct(Math.abs(salesVsLastWeekPct))}`],
        ["Orders vs Same Day Last Week", `${ordersVsLastWeekPct >= 0 ? "▲" : "▼"} ${formatPct(Math.abs(ordersVsLastWeekPct))}`],
        ...(monthlyTargetSet
          ? [["Month pace", `${formatPct(monthPacePct ?? 0)} of expected-to-date`]]
          : []),
      ])}
    </tbody>
  </table>

  ${
    monthlyTargetSet
      ? `
  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">📊 ${monthLabel.toUpperCase()} TARGET PROGRESS</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Metric</th><th style="padding:8px 12px;text-align:right">Value</th></tr></thead>
    <tbody>
      ${rows([
        ["Target", formatINR(monthlySalesTarget)],
        ["Achieved Till Today", formatINR(monthSoFarSales)],
        ["Complete", formatPct(monthlyAchievedPct ?? 0)],
        ["Status", monthlyTargetStatusLabel],
        ["Time Remaining", `${daysLeftInMonth} day(s) left in ${monthLabel}`],
      ])}
    </tbody>
  </table>
  `
      : `
  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">ℹ️ Monthly target not set for ${monthLabel}</h2>
  <p style="margin:0 0 24px 0;color:#64748b">Admin can set it in Dashboard.</p>
  `
  }

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
    peakHours.length > 0
      ? `
  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">📊 Peak Hours</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">Time Slot</th><th style="padding:8px 12px;text-align:right">Orders</th><th style="padding:8px 12px;text-align:right">Revenue</th></tr></thead>
    <tbody>
      ${rows(peakHours.map((h) => [h.hourLabel, String(h.orders), formatINR(h.revenue)]))}
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
        ["Staff Present", `${presentCount}/${activeEmployees}`],
        ["Staff Absent", String(absentCount)],
      ])}
    </tbody>
  </table>
  `
      : ""
  }

  ${
    customerFeedback.length > 0 || avgPrepMins > 0 || cancelledOrRejectedCount > 0
      ? `
  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">⚠️ Operations & Quality</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px">Metric</th><th style="padding:8px 12px">Value</th></tr></thead>
    <tbody>
      ${rows([
        ["Customer feedback/issues raised", String(customerFeedback.length)],
        ["Customer feedback open", String(feedbackOpenCount)],
        ["Avg order preparation time", avgPrepMins > 0 ? `${Math.round(avgPrepMins * 10) / 10} mins` : "N/A"],
        ["Fastest prep time", fastestPrepMins > 0 ? `${Math.round(fastestPrepMins * 10) / 10} mins` : "N/A"],
        ["Slowest prep time", slowestPrepMins > 0 ? `${Math.round(slowestPrepMins * 10) / 10} mins` : "N/A"],
        ["Cancelled/Rejected orders", String(cancelledOrRejectedCount)],
      ])}
    </tbody>
  </table>
  `
      : ""
  }

  ${
    topEmployee && topStaff
      ? `
  <h2 style="color:#0f172a;font-size:1.1em;margin-top:24px">👥 Staff Performance</h2>
  <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
    <thead><tr style="background:#f1f5f9"><th style="padding:8px 12px">Metric</th><th style="padding:8px 12px">Value</th></tr></thead>
    <tbody>
      ${rows([
        ["Top performer (by paid sales)", `${topEmployee.name}${topEmployee.employeeCode ? ` (${topEmployee.employeeCode})` : ""}`],
        ["Top performer paid orders", String(topStaff._count._all)],
        ["Top performer sales", formatINR(topStaff._sum.totalAmount ?? 0)],
      ])}
    </tbody>
  </table>
  `
      : ""
  }

  ${
    alerts.length > 0
      ? `
  <h2 style="color:#b91c1c;font-size:1.1em;margin-top:24px">🚨 Critical Alerts</h2>
  <ul style="margin:0 0 24px 0;padding-left:20px;color:#7f1d1d">
    ${alerts.map((a) => `<li style="margin:4px 0">${a}</li>`).join("")}
  </ul>
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
  <p style="color:#64748b;font-size:12px">Note: Full inventory alerts (out-of-stock/low-stock) and true accounting profit require inventory+expense masters; this email currently uses removed-item loss and optional manual daily expenses as cost proxy.</p>
</body>
</html>`;

  const text = [
    `Daily Business Report – ${dateStr}`,
    `Total Sales: ${formatINR(totalSales)}`,
    `Total Orders: ${totalOrders} | Completed: ${completedCount} | Pending: ${pendingCount}`,
    `Avg Order: ${formatINR(avgOrder)}`,
    `Payment collection: ${formatPct(paymentCollectionRate)}`,
    dailySalesTarget > 0 ? `Target achieved: ${formatPct(targetAchievedPct ?? 0)} of ${formatINR(dailySalesTarget)}` : "",
    `Net (cost proxy): ${formatINR(netAfterLoss)} (Removed-item loss: ${formatINR(totalLoss)}${manualDailyExpenses > 0 ? `, Manual expenses: ${formatINR(manualDailyExpenses)}` : ""})`,
    `Vs yesterday - Sales: ${salesDeltaPct >= 0 ? "+" : ""}${formatPct(salesDeltaPct)}, Orders: ${ordersDeltaPct >= 0 ? "+" : ""}${formatPct(ordersDeltaPct)}`,
    `Vs same day last week - Sales: ${salesVsLastWeekPct >= 0 ? "+" : ""}${formatPct(salesVsLastWeekPct)}, Orders: ${ordersVsLastWeekPct >= 0 ? "+" : ""}${formatPct(ordersVsLastWeekPct)}`,
    monthlyTargetSet
      ? `${monthLabel} target progress: Target ${formatINR(monthlySalesTarget)}, Achieved ${formatINR(monthSoFarSales)} (${formatPct(monthlyAchievedPct ?? 0)}), ${monthlyTargetStatusLabel}, ${daysLeftInMonth} day(s) left in ${monthLabel}`
      : `Monthly target not set for ${monthLabel}. Admin can set it in Dashboard.`,
    `Staffing: Present ${presentCount}/${activeEmployees}, Absent ${absentCount}, Late ${lateToday.length}, Overtime ${overtimeToday.length}`,
    `Customer issues: ${customerFeedback.length} (${feedbackOpenCount} open), Prep avg ${avgPrepMins > 0 ? `${Math.round(avgPrepMins * 10) / 10} mins` : "N/A"}, Fastest ${fastestPrepMins > 0 ? `${Math.round(fastestPrepMins * 10) / 10} mins` : "N/A"}, Rejected: ${cancelledOrRejectedCount}`,
    topEmployee && topStaff
      ? `Top staff: ${topEmployee.name} (${topStaff._count._all} paid orders, ${formatINR(topStaff._sum.totalAmount ?? 0)} sales)`
      : "",
    peakHours.length > 0
      ? `Peak hours: ${peakHours.map((h) => `${h.hourLabel} (${h.orders})`).join(", ")}`
      : "",
    alerts.length > 0 ? `Critical alerts: ${alerts.join(" | ")}` : "",
    pendingCount > 0 ? `Pending amount: ${formatINR(totalPending)}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    await sendEmail({ to: directorEmails, subject, text, html });
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
