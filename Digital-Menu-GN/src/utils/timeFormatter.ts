/**
 * Convert decimal hours to human-readable "X hr Y min" or "X min".
 * Use for shift hours, overtime, and late duration across Employee + Admin dashboards.
 */
export function formatHours(
  decimalHours: number | null | undefined,
  isLive = false,
): string {
  if (decimalHours == null || Number.isNaN(decimalHours)) return "0 min";
  const totalMinutes = Math.round(decimalHours * 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  let result = "";
  if (hours > 0) result += `${hours} hr `;
  if (minutes > 0) result += `${minutes} min`;
  const trimmed = result.trim();
  if (trimmed === "") return "0 min";
  if (isLive) return `${trimmed} (live)`;
  return trimmed;
}
