/**
 * Shared filter options – same options everywhere for consistency.
 * Customize here to add/remove filter values across the app.
 */

export const EMPLOYEE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
  { value: "LEFT", label: "Left" },
] as const;

export const MENU_CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "live", label: "Live Only" },
  { value: "pending", label: "Pending Only" },
] as const;

export const MENU_SORT_OPTIONS = [
  { value: "name", label: "Alphabetical" },
  { value: "items-desc", label: "Most Items" },
  { value: "items-asc", label: "Least Items" },
  { value: "live-desc", label: "Most Live" },
] as const;
