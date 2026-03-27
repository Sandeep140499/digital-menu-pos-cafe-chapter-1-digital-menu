/**
 * Business day: restaurant cycle resets at 04:00 AM (not midnight).
 * "Today" = from 04:00 AM (current calendar day) until 03:59:59 (next calendar day).
 * This utility returns the calendar date (YYYY-MM-DD) that represents "today" for dashboard/reports.
 *
 * Example (Asia/Kolkata):
 * - 02:00 AM 16 Mar → business "today" is 15 Mar (yesterday)
 * - 05:00 AM 16 Mar → business "today" is 16 Mar
 *
 * Backend: For consistency, APIs that filter by date (e.g. GET /orders/all?date=YYYY-MM-DD and
 * /orders/live) should treat the day as [date 04:00, date+1 03:59] in branch timezone (e.g. Asia/Kolkata).
 */

const DEFAULT_TZ = 'Asia/Kolkata';
const BUSINESS_DAY_START_HOUR = 4;

/**
 * Get the current date-time parts in the given timezone (hour 0-23, date).
 * Uses Intl to avoid heavy dependencies.
 */
function getLocalPartsInTz(
  date: Date,
  timeZone: string
): { year: number; month: number; day: number; hour: number } {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '0';
  const rawHour = parseInt(get('hour'), 10);
  // en-CA uses 24 for 00:00–00:59 in some timezones; treat as 0 for business-day cutoff.
  const hour = rawHour === 24 ? 0 : rawHour;
  return {
    year: parseInt(get('year'), 10),
    month: parseInt(get('month'), 10),
    day: parseInt(get('day'), 10),
    hour,
  };
}

/**
 * Returns YYYY-MM-DD for "today" in the business sense: if local time is before
 * BUSINESS_DAY_START_HOUR (4 AM), returns yesterday's date; otherwise today's date.
 * Use this for dashboard "today" filter, today's revenue, item sales, etc.
 */
export function getBusinessDateString(timeZone: string = DEFAULT_TZ): string {
  const now = new Date();
  const { year, month, day, hour } = getLocalPartsInTz(now, timeZone);
  const beforeCutoff = hour < BUSINESS_DAY_START_HOUR;
  const d = new Date(year, month - 1, day);
  if (beforeCutoff) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}

/**
 * Same as getBusinessDateString but accepts an optional date (for tests or specific day).
 */
export function getBusinessDateStringFor(date: Date, timeZone: string = DEFAULT_TZ): string {
  const { year, month, day, hour } = getLocalPartsInTz(date, timeZone);
  const beforeCutoff = hour < BUSINESS_DAY_START_HOUR;
  const d = new Date(year, month - 1, day);
  if (beforeCutoff) d.setDate(d.getDate() - 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dy = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dy}`;
}
