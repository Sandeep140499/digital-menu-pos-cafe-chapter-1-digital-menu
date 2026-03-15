# QA Task – Responsiveness, Notifications & Production Fix

**Status:** In progress  
**Last updated:** Per audit  
**Scope:** Full application – all pages, components, and modules. Includes production config (dashboard reset, env URLs, email links).

---

## 1. Full Responsive Design Validation

### Screen sizes to validate

| Breakpoint | Width | Notes |
|------------|--------|--------|
| Mobile | 320px – 480px | Single-column where applicable; no horizontal scroll |
| Tablet | 481px – 1024px | 2-column grids; readable tables |
| Laptop | 1025px – 1440px | Full layout |
| Large | 1441px+ | Max-width containers; no over-stretch |

### Components verified / fixed

| Component | Status | Notes |
|-----------|--------|--------|
| Menu cards (customer Index) | ✅ Fixed | `grid-cols-1 sm:grid-cols-2`; category panel `max-h-[80dvh]`; Half/Full buttons flexible on mobile |
| Order cards (employee) | ✅ Fixed | Empty state: "No Active Orders" / "New orders will appear here" |
| Dashboard KPI cards (admin) | ✅ Fixed | `grid-cols-1 sm:grid-cols-2 md:grid-cols-4`; `min-w-0 overflow-hidden` on cards |
| Buttons | ✅ | Touch targets ≥44px; flexible width where specified |
| Modals / dialogs | ✅ | `max-h-[80dvh]`; `overflow-x-hidden`; constrained width on mobile |
| Tables (admin/employee) | ✅ | Wrapped in `overflow-x-auto`; parent has `overflow-x-hidden` |
| Forms | ✅ | Full-width inputs on mobile; labels and spacing consistent |
| Navigation (DashboardShell) | ✅ | Header/sidebar responsive; main has `overflow-x-hidden` |
| Customer menu (Index) | ✅ | `min-h-[100dvh]`; fixed bottom cart bar spacing; category list scroll |

### Required fixes (checklist)

- [x] Remove UI overflow (main/content use `overflow-x-hidden` / `min-w-0` where needed)
- [x] Fix broken layouts (grid breakpoints and card flex)
- [x] Align buttons (touch targets; flexible width for Half/Full on mobile)
- [x] Consistent card spacing (`gap-2 sm:gap-3` / `p-2 sm:p-3`)
- [x] Images scale proportionally (`object-cover` / `max-w-full`)
- [x] Text does not overflow (`truncate` / `line-clamp` / `break-words` where needed)

---

## 2. Mobile device testing

### Devices to prioritize

- iPhone (Safari) – dynamic viewport, safe areas
- Android (Chrome)
- Small viewports (320px–480px) in DevTools

### Mobile validation checklist

- [x] Cards display correctly (no full-width overflow)
- [x] Buttons aligned and tappable (min 44px)
- [x] Text does not overflow containers
- [x] Images scale correctly
- [x] Modals fit viewport (`max-h-[80dvh]`, internal scroll)
- [x] Tables scroll horizontally when needed (`overflow-x-auto`)
- [x] No horizontal scrolling on page body
- [x] Navigation accessible (sidebar + header)
- [x] Interactive elements remain clickable

---

## 3. Order card stability (mobile)

### Requirement

When closing or completing an order card, the page must **not** become blank.

### Implementation

- **Employee – Live Orders:** When `liveOrders.length === 0`, the grid still renders and shows:
  - **"No Active Orders"**
  - **"New orders will appear here"**
- **Employee – Completed:** Empty state: "No orders in this section right now."
- **Employee – Shift overview:** When `orders.length === 0`: "No orders yet" + "Orders will appear here when you have an active shift."
- **Admin – Orders by table:** Empty state: "No orders found for the selected date" (card with icon).

Closing or completing an order only removes that card from the list; the container and empty state remain.

### Empty state requirement

- [x] No blank screen when no orders
- [x] Clear copy: e.g. "No Active Orders", "New orders will appear here"

---

## 4. Popup alerts removed

### Requirement

No use of:

- `alert()`
- `confirm()`
- `prompt()`

### Audit result

- **Grep:** No matches for `alert(`, `confirm(`, `prompt(` in `.tsx`/`.ts`/`.jsx`/`.js`.
- **Status:** ✅ No traditional popup alerts in codebase.

---

## 5. Notification standardization

### Requirement

All notifications must use a **consistent toast format**. Prefer **React Hot Toast** for global UX.

### Current implementation

| Location | Mechanism | Notes |
|----------|------------|--------|
| Login | `react-hot-toast` | `toast.success("Logged in as ...")`, `toast.error(...)` |
| Employee dashboard | `react-hot-toast` | `toast.success`, `toast.error`, `toast.info` |
| Admin dashboard | `useToast` (shadcn) | Compact toast; auto-dismiss 4s; max 3 toasts |
| Customer menu (Index) | `useToast` (shadcn) | Cart/order messages |
| ResetPassword | `useToast` (shadcn) | |
| QRCodeGenerator | `useToast` (shadcn) | |

### Toast usage

- **Success:** `toast.success("Action completed successfully")` (or shadcn `toast({ title: "Success", description: "..." })`)
- **Error:** `toast.error("Something went wrong")` (or shadcn `variant: "destructive"`)
- **Info:** `toast("New order received")` (or shadcn with title/description)

### Cases where toast is used

- [x] Order creation / new order notification (employee: react-hot-toast)
- [x] Order completion / status updates
- [x] Payment confirmation
- [x] API success/error (login, admin actions, reset password, etc.)
- [x] Admin actions (category, menu item, branch, employee, etc.)
- [x] Customer (empty cart, place order, etc.)

### Optional next step

- Migrate remaining shadcn `useToast` call sites to `react-hot-toast` for a single global style (e.g. Admin, Index, ResetPassword, QRCodeGenerator). Current shadcn toasts are already compact and auto-dismiss.

---

## 6. Dashboard reset time (04:00 AM)

### Requirement

The dashboard must **reset at 04:00 AM** instead of midnight to match the restaurant business cycle.

### Implementation (frontend)

- **`src/utils/businessDate.ts`** added:
  - `getBusinessDateString(timeZone?)` – returns `YYYY-MM-DD` for “today” with 4 AM cutoff in `Asia/Kolkata`.
  - Before 4 AM → yesterday’s date; from 4 AM → today’s date.
- **Admin dashboard:** Default **Orders by Table** date and **Removed items** date use `getBusinessDateString()` so the default filter is the current business day.
- **Backend (for full consistency):** APIs that filter by date (e.g. `GET /orders/all?date=`, `/orders/live`) should treat the day as **[date 04:00, date+1 03:59]** in branch timezone. Frontend sends the same business date; backend should use 4 AM boundary when filtering.

### Affected data (when backend aligns)

- Today’s orders
- Today’s revenue
- Today’s item sales
- Top selling items
- Daily statistics (reports, analytics, director reports)

---

## 7. Email verification & employee login (production URL)

### Requirement

- Email verification links must use the **deployed domain**, not localhost.
- Employee login / verification links must redirect to the **hosted application URL**.

### Frontend

- **`getFrontendUrl()`** in `src/constants/api.ts`: returns `VITE_FRONTEND_URL` when set, else `window.location.origin` (so in browser it’s always correct). Use for any client-side redirect or link.
- Set **`VITE_FRONTEND_URL=https://yourdomain.com`** in production build so server-rendered or client links use the right origin when needed.

### Backend (required for email links)

Verification and password-reset links in **emails** are built by the **backend**. The backend must:

- Use an env variable (e.g. **`FRONTEND_URL`** or **`APP_URL`**) set to the deployed frontend URL in production.
- Build links like: `https://yourdomain.com/verify-email?token=...`, `https://yourdomain.com/reset-password?token=...`, not `http://localhost:3000/...`.

---

## 8. Environment-based URL handling

### Requirement

- **Local:** e.g. `http://localhost:3000` (frontend), `/api` or `http://localhost:4000/api` (backend).
- **Production:** `https://yourdomain.com` (frontend), `https://your-api.example.com/api` (backend).

### Implementation

- **Frontend**
  - **`VITE_API_BASE_URL`** – backend API base (see `src/constants/api.ts`). Set in production to your API origin.
  - **`VITE_FRONTEND_URL`** – deployed frontend URL (optional). Used by `getFrontendUrl()`; falls back to `window.location.origin` in the browser.
- **`.env.example`** – documents both variables. Copy to `.env` and set for production.
- Use **`API_BASE_URL`** for all API calls; use **`getFrontendUrl()`** for redirects or links that must point to the app.

### Backend

- Backend should use **`FRONTEND_URL`** (or equivalent) for:
  - Email verification links
  - Password reset links
  - Employee invite / login links
  - Any webhook or callback that returns a frontend URL

---

## 9. UI stability

### Requirement

- No flashing cards
- No layout shifting
- No component jumping
- No sudden page refresh
- No unstable animations

### Measures taken

- **Employee – Live orders:** Section content memoized so clock updates don’t re-render cards (avoids flashing).
- **Customer menu:** Categories section memoized so cart/dialog updates don’t re-render menu.
- **Viewport:** `min-h-[100dvh]` used where full-height is needed to avoid Safari layout jumps.
- **Fixed bar:** Main content has fixed bottom padding so cart bar doesn’t overlap or shift layout.

### Checklist

- [x] No flashing cards (memoization where needed)
- [x] Layout stable (dvh, fixed padding, overflow control)
- [x] No unintended full-page refresh from toast/notifications

---

## 10. Admin dashboard QA

### Components verified

| Component | Responsive | Stable on mobile |
|-----------|------------|------------------|
| Today’s sales / KPI cards | ✅ 1/2/4 col grid | ✅ |
| Order statistics | ✅ | ✅ |
| Top selling items | ✅ ScrollArea + truncate | ✅ |
| Orders by table | ✅ ScrollArea + empty state | ✅ |
| Order tables | ✅ `overflow-x-auto` | ✅ |
| Payment status cards | ✅ In KPI grid | ✅ |
| Leaderboard / staff sections | ✅ Tables scroll | ✅ |

---

## 11. Final validation before deployment

### Pre-deployment checklist

- [ ] All pages tested at 320px, 480px, 768px, 1024px, 1440px
- [ ] No horizontal scrolling on any page (except intentional table scroll)
- [ ] All UI elements aligned and readable
- [ ] No blank screens (empty states in place for orders)
- [ ] All notifications use toast (React Hot Toast or shadcn compact toast)
- [ ] Cards and lists behave consistently across devices
- [ ] UI remains stable during actions (no flash/jump)
- [ ] Real device check: iPhone Safari + Android Chrome (recommended)
- [ ] Dashboard default date uses 04:00 AM business day (Orders by Table, Removed items)
- [ ] Backend: date filters use 4 AM boundary; email links use production FRONTEND_URL
- [ ] Environment: VITE_API_BASE_URL and VITE_FRONTEND_URL set for production
- [ ] Employee login and email verification work from production links

---

## Deliverables

### List of responsive issues found (addressed)

- Menu category panel and Half/Full row overflow on small viewports → fixed with flexible layout and `max-h-[80dvh]`.
- iPhone Safari layout jump (100vh / safe area) → fixed with `100dvh` and fixed bottom padding for cart bar.
- Login toast too large on mobile → fixed by using react-hot-toast for login.
- Admin KPI cards tight on mobile → fixed with 1-column grid and compact cards.
- Order list could show blank when no orders → fixed with explicit empty states ("No Active Orders", "New orders will appear here").

### List of fixed components

- **Customer menu (Index):** Page wrapper (dvh), main padding, category grid (1 col mobile), category panel (scroll + flexible Half/Full), cart bar spacing.
- **Toast (shadcn):** Viewport (compact, top-center mobile), card (small padding), auto-dismiss 4s, limit 3.
- **Login:** Switched to react-hot-toast for success/error.
- **Admin dashboard:** KPI grid (1/2/4 cols), card overflow/min-w-0, Employees Summary line-clamp.
- **Employee dashboard:** Live Orders empty state ("No Active Orders" / "New orders will appear here"), shift overview empty state copy.
- **DashboardShell:** Main area already had `overflow-x-hidden` and `min-w-0`.

### Summary table

| Deliverable | Status |
|-------------|--------|
| List of responsive issues found | ✅ Above |
| List of fixed components | ✅ Above |
| Screenshots for mobile validation | To be added by QA (e.g. 320px, 375px, 414px) |
| Confirmation alert popups removed | ✅ No `alert`/`confirm`/`prompt` in codebase |
| Confirmation React Hot Toast / toast implemented | ✅ Login + Employee use react-hot-toast; rest use compact shadcn toast |

---

## 12. Future / backend checklist (not in this audit)

For production hardening, consider separate tasks:

- Security fixes (auth, headers, CSP)
- API protection and rate limiting
- Order fraud protection
- WhatsApp notification stability
- Auto backups and server monitoring

---

## Related docs

- `docs/MOBILE_VIEWPORT_QA.md` – Why layout breaks on real iPhone and how it was fixed (dvh, safe area, cart bar).
