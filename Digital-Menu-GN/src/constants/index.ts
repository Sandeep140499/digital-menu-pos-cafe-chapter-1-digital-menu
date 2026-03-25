export {
  API_BASE_URL,
  API_TIMEOUT_MS,
  describeFetchFailure,
  fetchWithTimeout,
  fetchWithTimeoutRetry,
  getFrontendUrl,
  readApiErrorMessage,
} from "./api";
export {
  APP_NAME,
  ORDER_STATUS_COLORS,
  STATUS_BUTTON_ACTIVE,
  STATUS_STYLES,
} from "./theme";
export {
  EMPLOYEE_STATUS_FILTER_OPTIONS,
  MENU_CATEGORY_FILTER_OPTIONS,
  MENU_SORT_OPTIONS,
} from "./filters";

/** Fixed break deduction: total minutes per shift (1.75 h = 105 min). Use for display via formatBreakTime(). */
export const BREAK_TIME_MINUTES = 105;

/** Format break time as "X hr Y min" (e.g. 105 → "1 hr 45 min"). Handles 0.5→30 min, 1→1 hr, 2→2 hrs. */
export function formatBreakTime(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  const hours = Math.floor(totalMinutes / 60);
  const minutes = Math.round(totalMinutes % 60);
  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return hours === 1 ? "1 hr" : `${hours} hrs`;
  return hours === 1 ? `1 hr ${minutes} min` : `${hours} hrs ${minutes} min`;
}
