import { prisma } from '../config/prisma.js';
import { normalizeIndianMobile } from '../utils/indianMobile.js';
import { buildHappyHourBroadcast, getWaMeLink, type BranchInfo } from './whatsapp.js';

const MOBILE_SAFETY_CAP = 100_000;

/** Distinct customer mobiles from order history (same strategy as new-item broadcast). */
export async function collectAllCustomerMobiles(): Promise<string[]> {
  const orders = await prisma.order.findMany({
    where: { customerMobile: { not: null } },
    orderBy: { createdAt: 'desc' },
    distinct: ['customerMobile'],
    select: { customerMobile: true },
    take: MOBILE_SAFETY_CAP,
  });
  const seen = new Set<string>();
  const out: string[] = [];
  for (const o of orders) {
    const n = normalizeIndianMobile(String(o.customerMobile || ''));
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

/** Top customers by order count (leaders), for targeted WhatsApp lists. */
export async function collectLeaderMobiles(limit: number): Promise<string[]> {
  const limitNum = Math.min(Math.max(limit || 50, 1), 50_000);
  const grouped = await prisma.order.groupBy({
    by: ['customerMobile'],
    where: { customerMobile: { not: null } },
    _count: { _all: true },
  });
  const top = grouped
    .map(g => ({
      mobile: String(g.customerMobile || '').trim(),
      n: g._count?._all ?? 0,
    }))
    .filter(r => r.mobile.length > 0)
    .sort((a, b) => b.n - a.n)
    .slice(0, limitNum);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of top) {
    const n = normalizeIndianMobile(t.mobile);
    if (n && !seen.has(n)) {
      seen.add(n);
      out.push(n);
    }
  }
  return out;
}

export type HappyHourBroadcastResult = {
  message: string;
  mobileCount: number;
  mobiles: string[];
  /** First few wa.me links for admin to open (no paid WhatsApp API in this codebase). */
  waMeLinks: string[];
};

export async function buildHappyHourWaBroadcast(params: {
  discountPercent: number;
  timeStart: string;
  timeEnd: string;
  audience: 'ALL_CUSTOMERS' | 'LEADERS' | 'SELECTED';
  selectedMobiles?: string[] | null;
  leadersLimit?: number;
  branch?: BranchInfo | null;
}): Promise<HappyHourBroadcastResult> {
  let mobiles: string[] = [];
  if (params.audience === 'ALL_CUSTOMERS') {
    mobiles = await collectAllCustomerMobiles();
  } else if (params.audience === 'LEADERS') {
    mobiles = await collectLeaderMobiles(params.leadersLimit ?? 200);
  } else {
    const raw = params.selectedMobiles || [];
    const seen = new Set<string>();
    for (const m of raw) {
      const n = normalizeIndianMobile(String(m));
      if (n && !seen.has(n)) {
        seen.add(n);
        mobiles.push(n);
      }
    }
  }

  const sampleNames = await prisma.order.findMany({
    where: { customerMobile: { in: mobiles.slice(0, 200) } },
    orderBy: { createdAt: 'desc' },
    distinct: ['customerMobile'],
    select: { customerMobile: true, customerName: true },
    take: 200,
  });
  const nameByMobile = new Map(
    sampleNames.map(r => {
      const k = String(r.customerMobile || '').replace(/\D/g, '').slice(-10);
      return [k, r.customerName] as const;
    })
  );

  const menuLink = process.env.MENU_BASE_URL || '';
  const waMeLinks: string[] = [];
  const maxLinks = Math.min(5, mobiles.length);
  for (let i = 0; i < maxLinks; i++) {
    const mob = mobiles[i]!;
    const rawName = nameByMobile.get(mob);
    const customerName =
      rawName && String(rawName).trim() ? String(rawName).trim().split(/\s+/)[0]! : 'there';
    const message = buildHappyHourBroadcast({
      customerName,
      discountPercent: params.discountPercent,
      startTime: params.timeStart,
      endTime: params.timeEnd,
      menuLink,
      branch: params.branch ?? undefined,
    });
    waMeLinks.push(getWaMeLink(mob, message));
  }

  const templateMessage = buildHappyHourBroadcast({
    customerName: 'there',
    discountPercent: params.discountPercent,
    startTime: params.timeStart,
    endTime: params.timeEnd,
    menuLink,
    branch: params.branch ?? undefined,
  });

  return {
    message: templateMessage,
    mobileCount: mobiles.length,
    mobiles,
    waMeLinks,
  };
}
