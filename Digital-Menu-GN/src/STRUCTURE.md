# Frontend structure (multi-tenant / many restaurants ready)

## Folders

- **`constants/`** – Single source for API URL, theme (status colors, badge styles), and filter options. Change colors or labels here and they apply everywhere.
- **`hooks/`** – `useAuth`, `useApi`, `useToast`. Use these for auth, API calls, and toasts so behavior is consistent.
- **`components/shared/`** – Reusable UI: `LoaderButton`, `StatusBadge`. Use for all action buttons and status display.
- **`components/ui/`** – Base UI (Button, Card, Dialog, etc.).
- **`components/dashboard/`** – Layout (e.g. DashboardShell).
- **`lib/`** – `utils.ts` (cn), `format.ts` (formatINR). Shared helpers and formatters.
- **`pages/`** – Route-level screens, organized by role:
  - **`pages/admin/`** – Admin-only screens (e.g. AdminDashboard).
  - **`pages/employee/`** – Employee-only screens (e.g. EmployeeDashboard).
  - **`pages/common/`** – Shared screens: Login, ResetPassword, NotFound, Index (visiting/customer menu).

## Customization

- **API base URL:** Set `VITE_API_BASE_URL` in `.env` or edit `constants/api.ts`.
- **Colors / status look:** Edit `constants/theme.ts` (STATUS_STYLES, STATUS_BUTTON_ACTIVE, ORDER_STATUS_COLORS).
- **Filter options:** Edit `constants/filters.ts` (employee status, menu category filter, sort options).
- **App name:** `constants/theme.ts` → `APP_NAME`.

All of this is used across admin and employee dashboards so the app stays consistent and easy to customize per deployment.
