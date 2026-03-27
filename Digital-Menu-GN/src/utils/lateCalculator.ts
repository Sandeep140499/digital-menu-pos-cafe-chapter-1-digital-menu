/**
 * Calculate late duration between scheduled start and actual login.
 * Returns "On Time" if actual <= scheduled, else "X hr Y min".
 */
export function calculateLate(
  scheduledStart: string | Date | null | undefined,
  actualLogin: string | Date | null | undefined
): string {
  if (scheduledStart == null || actualLogin == null) return '—';
  const start = new Date(scheduledStart);
  const login = new Date(actualLogin);
  if (login <= start) return 'On time';
  const diffMs = login.getTime() - start.getTime();
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let result = '';
  if (hours > 0) result += `${hours} hr `;
  if (minutes > 0) result += `${minutes} min`;
  return result.trim() || '0 min';
}
