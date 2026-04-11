import type { HappyHourApplyMode, HappyHourStatus } from '@prisma/client';

export const DEFAULT_MENU_TIMEZONE = process.env.BRANCH_TIMEZONE || 'Asia/Kolkata';

export type HappyHourRule = {
  id: number;
  name: string;
  discountPercent: number;
  dateStartYmd: string;
  dateEndYmd: string;
  timeStart: string;
  timeEnd: string;
  daysOfWeek: number[] | null | undefined;
  status: HappyHourStatus;
  applyMode: HappyHourApplyMode;
  categoryIds: number[];
  itemIds: number[];
  excludedItemIds: number[];
};

function ymdInTz(d: Date, tz: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

function weekdayInTz(d: Date, tz: string): number {
  const w = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(d);
  const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return map[String(w).slice(0, 3)] ?? 0;
}

function minutesInTz(d: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: tz,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? '0');
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? '0');
  return h * 60 + m;
}

export function parseClockToMinutes(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(t || '').trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isFinite(h) || !Number.isFinite(min) || h < 0 || h > 23 || min < 0 || min > 59)
    return null;
  return h * 60 + min;
}

function isTimeInWindow(curMin: number, startMin: number, endMin: number): boolean {
  if (startMin <= endMin) return curMin >= startMin && curMin <= endMin;
  return curMin >= startMin || curMin <= endMin;
}

function prismaDateToYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function normalizeDays(raw: unknown): number[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const nums = raw
    .map(x => Number(x))
    .filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
  return nums.length ? [...new Set(nums)].sort((a, b) => a - b) : null;
}

export function mapDbHappyHourToRule(row: {
  id: number;
  name: string;
  discountPercent: number;
  dateStart: Date;
  dateEnd: Date;
  timeStart: string;
  timeEnd: string;
  daysOfWeek: unknown;
  status: HappyHourStatus;
  applyMode: HappyHourApplyMode;
  categoryLinks: { categoryId: number }[];
  itemLinks: { menuItemId: number }[];
  excludedItemLinks: { menuItemId: number }[];
}): HappyHourRule {
  return {
    id: row.id,
    name: row.name,
    discountPercent: Number(row.discountPercent),
    dateStartYmd: prismaDateToYmd(row.dateStart),
    dateEndYmd: prismaDateToYmd(row.dateEnd),
    timeStart: row.timeStart,
    timeEnd: row.timeEnd,
    daysOfWeek: normalizeDays(row.daysOfWeek),
    status: row.status,
    applyMode: row.applyMode,
    categoryIds: row.categoryLinks.map(c => c.categoryId),
    itemIds: row.itemLinks.map(i => i.menuItemId),
    excludedItemIds: row.excludedItemLinks.map(i => i.menuItemId),
  };
}

export function isHappyHourActiveNow(rule: HappyHourRule, now: Date, tz: string): boolean {
  if (rule.status !== 'ACTIVE') return false;
  const today = ymdInTz(now, tz);
  if (today < rule.dateStartYmd || today > rule.dateEndYmd) return false;
  const days = rule.daysOfWeek;
  if (days && days.length > 0) {
    const wd = weekdayInTz(now, tz);
    if (!days.includes(wd)) return false;
  }
  const startMin = parseClockToMinutes(rule.timeStart);
  const endMin = parseClockToMinutes(rule.timeEnd);
  if (startMin == null || endMin == null) return false;
  const cur = minutesInTz(now, tz);
  return isTimeInWindow(cur, startMin, endMin);
}

export function itemMatchesRule(
  rule: HappyHourRule,
  menuItemId: number,
  categoryId: number | null | undefined
): boolean {
  if (rule.applyMode === 'ALL_ITEMS') return true;
  if (rule.applyMode === 'ITEMS') return rule.itemIds.includes(menuItemId);
  if (rule.applyMode === 'CATEGORIES') {
    const cid = categoryId ?? null;
    if (cid == null || !rule.categoryIds.includes(cid)) return false;
    if (rule.excludedItemIds.includes(menuItemId)) return false;
    return true;
  }
  return false;
}

/** Best discount among all rules that are active at `now` and match the item. */
export function bestActiveDiscountForItem(
  rules: HappyHourRule[],
  now: Date,
  tz: string,
  menuItemId: number,
  categoryId: number | null | undefined
): { discountPercent: number; offerName: string; offerId: number } | null {
  let bestPct = 0;
  let offerName = '';
  let offerId = 0;
  for (const r of rules) {
    if (!isHappyHourActiveNow(r, now, tz)) continue;
    if (!itemMatchesRule(r, menuItemId, categoryId)) continue;
    const p = Number(r.discountPercent);
    if (!Number.isFinite(p) || p <= 0) continue;
    if (p > bestPct) {
      bestPct = p;
      offerName = r.name;
      offerId = r.id;
    }
  }
  if (bestPct <= 0) return null;
  return { discountPercent: bestPct, offerName, offerId: offerId };
}

export function applyPercentDiscount(price: number, discountPercent: number): number {
  const p = Math.max(0, price * (1 - discountPercent / 100));
  return Math.round(p * 100) / 100;
}

export function resolveExpectedUnitPrice(params: {
  basePrice: number;
  halfPrice: number | null | undefined;
  hasHalf: boolean;
  variant: 'HALF' | 'FULL' | undefined;
  menuItemId: number;
  categoryId: number | null | undefined;
  rules: HappyHourRule[];
  now: Date;
  tz: string;
}): number {
  const useHalf = params.variant === 'HALF' && params.hasHalf && params.halfPrice != null;
  const base = useHalf ? Number(params.halfPrice) : Number(params.basePrice);
  const disc = bestActiveDiscountForItem(
    params.rules,
    params.now,
    params.tz,
    params.menuItemId,
    params.categoryId
  );
  if (!disc) return Math.round(base * 100) / 100;
  return applyPercentDiscount(base, disc.discountPercent);
}

export type HappyHourPublicBanner = {
  visible: boolean;
  headline: string;
  body: string;
  maxDiscountPercent: number;
  timeLabel: string;
  activeOfferIds: number[];
};

export function buildHappyHourBanner(rules: HappyHourRule[], now: Date, tz: string): HappyHourPublicBanner {
  const active = rules.filter(r => isHappyHourActiveNow(r, now, tz));
  if (active.length === 0) {
    return {
      visible: false,
      headline: '',
      body: '',
      maxDiscountPercent: 0,
      timeLabel: '',
      activeOfferIds: [],
    };
  }
  const maxPct = Math.max(...active.map(r => Number(r.discountPercent) || 0));
  const names = [...new Set(active.map(r => r.name))];
  const headline =
    names.length === 1
      ? `Happy Hours — ${names[0]}`
      : `Happy Hours — ${active.length} live offers`;
  const body =
    maxPct > 0
      ? `Save up to ${Math.round(maxPct)}% on eligible dishes. Offers apply automatically at checkout.`
      : 'Special pricing is live on selected dishes.';
  const timeLabel = active
    .map(r => `${r.timeStart}–${r.timeEnd}`)
    .filter((v, i, a) => a.indexOf(v) === i)
    .slice(0, 3)
    .join(' · ');
  return {
    visible: true,
    headline,
    body,
    maxDiscountPercent: maxPct,
    timeLabel,
    activeOfferIds: active.map(r => r.id),
  };
}
