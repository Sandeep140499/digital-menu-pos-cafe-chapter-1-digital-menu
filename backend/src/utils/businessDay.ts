export function getBusinessDayRange(params: {
  date: Date;
  boundaryHour: number; // e.g. 4 => day is 04:00..03:59
  timeZone?: string;
}): { start: Date; end: Date; dateKey: string } {
  const { date, boundaryHour, timeZone = 'Asia/Kolkata' } = params;
  // Convert to timezone parts.
  const dateStr = date.toLocaleDateString('en-CA', { timeZone }); // YYYY-MM-DD
  const [y0, m0, d0] = dateStr.split('-').map(Number);
  const timeParts = new Intl.DateTimeFormat('en-IN', {
    timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  }).formatToParts(date);
  const hh = Number(timeParts.find(p => p.type === 'hour')?.value ?? 0);

  // Business day key: if local time is before boundaryHour (e.g. 02:00), it belongs to previous business day.
  const businessDate = new Date(Date.UTC(y0, m0 - 1, d0));
  if (hh < boundaryHour) {
    businessDate.setUTCDate(businessDate.getUTCDate() - 1);
  }
  const dateKey = businessDate.toISOString().slice(0, 10);
  const y = businessDate.getUTCFullYear();
  const m = businessDate.getUTCMonth() + 1;
  const d = businessDate.getUTCDate();

  // We represent the business day as [boundaryHour, boundaryHour+24) in that timezone.
  // For IST, we can map to UTC by subtracting offset (5:30) for start.
  // To keep it simple and consistent with existing code, we compute:
  // - timezone midnight UTC approximation for IST and then add boundary hours.
  // NOTE: This repo already assumes Asia/Kolkata in order routes.
  const utcPrevDay = Date.UTC(y, m - 1, d - 1);
  const istOffsetMs = 18.5 * 60 * 60 * 1000; // 18h30 in ms (00:00 IST = 18:30 UTC prev day)
  const startOfDayIstInUtc = new Date(utcPrevDay + istOffsetMs);

  const start = new Date(startOfDayIstInUtc.getTime() + boundaryHour * 60 * 60 * 1000);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);
  return { start, end, dateKey };
}
