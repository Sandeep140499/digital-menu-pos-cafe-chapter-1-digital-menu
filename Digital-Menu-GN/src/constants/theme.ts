/**
 * Theme & status colors – use these everywhere for consistent look.
 * Customize here to change colors across the whole app.
 */

/** Tailwind class sets for status badges (same look everywhere) */
export const STATUS_STYLES = {
  ACTIVE: {
    variant: "default" as const,
    className: "bg-green-100 text-green-800 border-green-200",
  },
  INACTIVE: {
    variant: "secondary" as const,
    className: "bg-amber-100 text-amber-800 border-amber-200",
  },
  LEFT: {
    variant: "secondary" as const,
    className: "bg-slate-100 text-slate-700 border-slate-200",
  },
} as const;

/** Button styles when status is selected (e.g. Edit Employee status buttons) */
export const STATUS_BUTTON_ACTIVE = {
  ACTIVE: "bg-green-600 hover:bg-green-700",
  INACTIVE: "bg-amber-600 hover:bg-amber-700",
  LEFT: "bg-slate-600 hover:bg-slate-700",
} as const;

/** Order/entity status badge colors */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  NEW_ORDER: "bg-blue-100 text-blue-800",
  ACCEPTED: "bg-indigo-100 text-indigo-800",
  PREPARING: "bg-amber-100 text-amber-800",
  SERVED: "bg-green-100 text-green-800",
  ORDER_COMPLETE: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-800",
  PAYMENT_PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-green-100 text-green-700",
  DELAYED: "bg-red-100 text-red-800 border border-red-300",
};

export const APP_NAME = "Digital Menu";
