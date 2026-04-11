import { prisma } from '../config/prisma.js';

export type TargetStatus = 'ON_TRACK' | 'NEED_TO_PUSH' | 'CRITICAL';

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1, 1).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
  });
}

/** Pace-based status: compare actual % of monthly target to expected % by “day N of month”. */
export function evaluatePacedStatus(achievedPct: number, expectedPct: number): TargetStatus {
  if (achievedPct >= expectedPct) return 'ON_TRACK';
  if (achievedPct >= expectedPct * 0.8) return 'NEED_TO_PUSH';
  return 'CRITICAL';
}

export async function setMonthlyTarget(
  year: number,
  month: number,
  targetAmount: number,
  createdBy?: number | null
) {
  const yearMonth = monthKey(year, month);
  return prisma.monthlyTarget.upsert({
    where: { yearMonth },
    create: {
      year,
      month,
      yearMonth,
      targetAmount,
      createdBy: createdBy ?? null,
    },
    update: { targetAmount },
  });
}

export async function getTargetForMonth(year: number, month: number) {
  return prisma.monthlyTarget.findUnique({
    where: { yearMonth: monthKey(year, month) },
  });
}

export async function getCurrentMonthTargetProgress(now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const yearMonth = monthKey(year, month);
  const target = await getTargetForMonth(year, month);
  if (!target || target.targetAmount <= 0) {
    return {
      year,
      month,
      yearMonth,
      monthLabel: monthLabel(year, month),
      targetSet: false as const,
    };
  }

  const monthStart = new Date(year, month - 1, 1, 0, 0, 0, 0);
  const agg = await prisma.order.aggregate({
    where: {
      createdAt: { gte: monthStart, lte: now },
      paymentStatus: 'PAID',
    },
    _sum: { totalAmount: true },
  });
  const achievedAmount = Number(agg._sum.totalAmount ?? 0);
  const achievedPct = target.targetAmount > 0 ? (achievedAmount / target.targetAmount) * 100 : 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  const elapsedDays = Math.max(1, Math.min(daysInMonth, now.getDate()));
  const expectedPct = (elapsedDays / daysInMonth) * 100;
  const status = evaluatePacedStatus(achievedPct, expectedPct);
  const daysLeft = Math.max(0, daysInMonth - now.getDate());

  return {
    year,
    month,
    yearMonth,
    monthLabel: monthLabel(year, month),
    targetSet: true as const,
    targetAmount: target.targetAmount,
    achievedAmount,
    achievedPct,
    expectedPct,
    status,
    daysLeft,
    updatedAt: target.updatedAt,
  };
}

export async function upsertDailyRevenueEntry(params: {
  businessDate: Date;
  totalOrders: number;
  paidOrders: number;
  totalRevenue: number;
}) {
  const businessDate = new Date(params.businessDate);
  businessDate.setHours(0, 0, 0, 0);
  return prisma.dailyRevenueEntry.upsert({
    where: { businessDate },
    create: {
      businessDate,
      totalOrders: params.totalOrders,
      paidOrders: params.paidOrders,
      totalRevenue: params.totalRevenue,
    },
    update: {
      totalOrders: params.totalOrders,
      paidOrders: params.paidOrders,
      totalRevenue: params.totalRevenue,
    },
  });
}
