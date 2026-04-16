import { LeaveStatus } from '@prisma/client';
import { prisma } from '../config/prisma.js';

/** Customers whose first order (by mobile/session identity) is in [from, to]. */
export async function countNewCustomersFirstOrderInRange(from: Date, to: Date): Promise<number> {
  // Avoid raw SQL by relying on normalized `customerKey` (m:<last10> or s:<sessionToken>).
  // We only need keys whose first-ever order (min createdAt) falls in range.
  const grouped = await prisma.order.groupBy({
    by: ['customerKey'],
    where: {
      customerKey: { not: null },
      createdAt: { lte: to },
    },
    _min: { createdAt: true },
  });

  let count = 0;
  for (const g of grouped) {
    const first = g._min.createdAt;
    if (first && first >= from && first <= to) count += 1;
  }
  return count;
}

export type MonthlyMetrics = {
  totalOrders: number;
  totalSales: number;
  uniqueCustomers: number;
  newCustomersCount: number;
  avgOrdersPerDay: number;
  paidOrdersCount: number;
  totalLoss: number;
  overtimeHoursApproved: number;
  approvedLeavesCount: number;
  lateEntriesCount: number;
};

export async function computeMonthlyMetrics(
  from: Date,
  to: Date,
  daysInMonth: number
): Promise<MonthlyMetrics> {
  const [totalOrders, paidAgg, paidOrdersCount] = await Promise.all([
    prisma.order.count({ where: { createdAt: { gte: from, lte: to } } }),
    prisma.order.aggregate({
      where: {
        createdAt: { gte: from, lte: to },
        paymentStatus: 'PAID' as const,
      },
      _sum: { totalAmount: true },
    }),
    prisma.order.count({
      where: {
        createdAt: { gte: from, lte: to },
        paymentStatus: 'PAID' as const,
      },
    }),
  ]);

  const totalSales = Number(paidAgg._sum.totalAmount || 0);

  const customerRows = await prisma.order.findMany({
    where: { createdAt: { gte: from, lte: to } },
    select: { customerMobile: true, sessionToken: true },
  });
  const customerSet = new Set<string>();
  for (const r of customerRows) {
    const m = (r.customerMobile || '').replace(/\D/g, '').slice(-10);
    if (m.length === 10) customerSet.add(`m:${m}`);
    else if (r.sessionToken) customerSet.add(`s:${r.sessionToken}`);
  }
  const uniqueCustomers = customerSet.size;

  const newCustomersCount = await countNewCustomersFirstOrderInRange(from, to);

  const lossAgg = await prisma.removedItemsReport.aggregate({
    where: { createdAt: { gte: from, lte: to } },
    _sum: { totalLoss: true },
  });

  const otAgg = await prisma.employeeOvertime.aggregate({
    where: {
      shiftDate: { gte: from, lte: to },
      status: 'APPROVED',
    },
    _sum: { overtimeHours: true },
  });

  const approvedLeavesCount = await prisma.employeeLeave.count({
    where: {
      status: LeaveStatus.APPROVED,
      startDate: { lte: to },
      endDate: { gte: from },
    },
  });

  const lateEntriesCount = await prisma.lateEntry.count({
    where: {
      date: { gte: from, lte: to },
    },
  });

  const avgOrdersPerDay =
    daysInMonth > 0 ? Math.round((totalOrders / daysInMonth) * 1000) / 1000 : 0;

  return {
    totalOrders,
    totalSales,
    uniqueCustomers,
    newCustomersCount,
    avgOrdersPerDay,
    paidOrdersCount,
    totalLoss: Number(lossAgg._sum.totalLoss || 0),
    overtimeHoursApproved: Number(otAgg._sum.overtimeHours || 0),
    approvedLeavesCount,
    lateEntriesCount,
  };
}

export async function upsertMonthlyRevenueSnapshot(
  yearMonth: string,
  year: number,
  month: number,
  from: Date,
  to: Date,
  daysInMonth: number,
  /** When provided, skips a second full recompute (e.g. monthly job already computed metrics for PDF). */
  precomputed?: MonthlyMetrics
): Promise<MonthlyMetrics> {
  const metrics = precomputed ?? (await computeMonthlyMetrics(from, to, daysInMonth));
  await prisma.monthlyRevenueSnapshot.upsert({
    where: { yearMonth },
    create: {
      year,
      month,
      yearMonth,
      totalOrders: metrics.totalOrders,
      totalSales: metrics.totalSales,
      uniqueCustomers: metrics.uniqueCustomers,
      newCustomersCount: metrics.newCustomersCount,
      avgOrdersPerDay: metrics.avgOrdersPerDay,
      paidOrdersCount: metrics.paidOrdersCount,
      totalLoss: metrics.totalLoss,
      overtimeHoursApproved: metrics.overtimeHoursApproved,
      approvedLeavesCount: metrics.approvedLeavesCount,
      lateEntriesCount: metrics.lateEntriesCount,
    },
    update: {
      totalOrders: metrics.totalOrders,
      totalSales: metrics.totalSales,
      uniqueCustomers: metrics.uniqueCustomers,
      newCustomersCount: metrics.newCustomersCount,
      avgOrdersPerDay: metrics.avgOrdersPerDay,
      paidOrdersCount: metrics.paidOrdersCount,
      totalLoss: metrics.totalLoss,
      overtimeHoursApproved: metrics.overtimeHoursApproved,
      approvedLeavesCount: metrics.approvedLeavesCount,
      lateEntriesCount: metrics.lateEntriesCount,
    },
  });
  return metrics;
}
