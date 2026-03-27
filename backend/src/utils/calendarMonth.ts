/**
 * Calendar month bounds in the configured TZ (same convention as monthly director report).
 */
export const CALENDAR_TIMEZONE = process.env.TZ || 'Asia/Kolkata';

function tzOffsetHours(): number {
  if (CALENDAR_TIMEZONE === 'Asia/Kolkata') return 5.5;
  return 0;
}

export type CalendarMonthBounds = {
  year: number;
  month: number;
  yearMonth: string;
  from: Date;
  to: Date;
  daysInMonth: number;
};

/** The calendar month that contains `now` in TIMEZONE (e.g. IST). */
export function getCalendarMonthBoundsForNow(now: Date = new Date()): CalendarMonthBounds {
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: CALENDAR_TIMEZONE });
  const [y, m] = dateStr.split('-').map(Number);
  const month0 = m - 1;
  const offsetMs = tzOffsetHours() * 60 * 60 * 1000;
  const startUtc = Date.UTC(y, month0, 1, 0, 0, 0, 0) - offsetMs;
  const endUtc = Date.UTC(y, month0 + 1, 0, 23, 59, 59, 999) - offsetMs;
  const daysInMonth = new Date(Date.UTC(y, month0 + 1, 0)).getUTCDate();
  const yearMonth = `${y}-${String(m).padStart(2, '0')}`;
  return {
    year: y,
    month: m,
    yearMonth,
    from: new Date(startUtc),
    to: new Date(endUtc),
    daysInMonth,
  };
}

/** Calendar day-of-month (1–31) in TIMEZONE — used for in-progress month averages. */
export function getCalendarDayOfMonthInTz(now: Date = new Date()): number {
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: CALENDAR_TIMEZONE });
  const parts = dateStr.split('-').map(Number);
  const day = parts[2];
  return typeof day === 'number' && day >= 1 ? day : 1;
}

/**
 * For the current incomplete month: average orders per calendar day elapsed (not full month length).
 */
export function avgOrdersPerDayForIncompleteMonth(
  totalOrders: number,
  now: Date = new Date()
): number {
  const d = Math.max(1, getCalendarDayOfMonthInTz(now));
  return Math.round((totalOrders / d) * 1000) / 1000;
}

/** The calendar month immediately before the one containing `now` (used by month-close job). */
export type PreviousCalendarMonthBounds = {
  monthKey: string;
  monthLabel: string;
  from: Date;
  to: Date;
  fromLabel: string;
  toLabel: string;
  daysInMonth: number;
};

export function getPreviousCalendarMonthBounds(
  now: Date = new Date()
): PreviousCalendarMonthBounds {
  const offsetMs = tzOffsetHours() * 60 * 60 * 1000;
  const dateStr = now.toLocaleDateString('en-CA', { timeZone: CALENDAR_TIMEZONE });
  const [y, m] = dateStr.split('-').map(Number);
  const m0 = m - 1;
  const prevMonth0 = m0 - 1;
  const year = prevMonth0 < 0 ? y - 1 : y;
  const month0 = (prevMonth0 + 12) % 12;

  const monthKey = `${year}-${String(month0 + 1).padStart(2, '0')}`;
  const monthLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString('en-IN', {
    month: 'long',
    year: 'numeric',
    timeZone: CALENDAR_TIMEZONE,
  });

  const startUtc = Date.UTC(year, month0, 1, 0, 0, 0, 0) - offsetMs;
  const endUtc = Date.UTC(year, month0 + 1, 0, 23, 59, 59, 999) - offsetMs;
  const from = new Date(startUtc);
  const to = new Date(endUtc);
  const daysInMonth = new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();

  const fromLabel = new Date(Date.UTC(year, month0, 1)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: CALENDAR_TIMEZONE,
  });
  const toLabel = new Date(Date.UTC(year, month0 + 1, 0)).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: CALENDAR_TIMEZONE,
  });

  return {
    monthKey,
    monthLabel,
    from,
    to,
    fromLabel,
    toLabel,
    daysInMonth,
  };
}
