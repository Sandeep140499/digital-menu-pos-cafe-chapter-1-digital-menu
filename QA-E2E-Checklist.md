# End-to-End QA Checklist

**Last run:** Build + code trace. Frontend build ✅ | Backend tsc ✅

---

## 1. Initial Load & Refresh (No White Screen)

| Check | Expected | Status |
|-------|----------|--------|
| Hard refresh (F5) on any route | HTML loader (spinner + "Loading...") shows immediately, then app replaces it | ✅ Implemented |
| `/` (landing) | Loader → landing/splash | ✅ |
| `/login` | Loader → login form | ✅ |
| `/admin` | Loader → auth check → login redirect if no token, else skeleton → dashboard | ✅ |
| `/employee` | Loader → auth check → login redirect if no token, else skeleton → dashboard | ✅ |

**Note:** Initial loader is in `index.html` inside `#root`; React replaces it on mount.

---

## 2. Admin Dashboard

| Check | Expected | Status |
|-------|----------|--------|
| Login as admin | Redirect to `/admin`, dashboard loads | ✅ |
| First paint after auth | Skeleton (header + sidebar + cards), then real content | ✅ |
| **Orders** section | Orders by table load; date/table filters and Refresh work | ✅ |
| **Order card click** | Order details dialog opens (top-level dialog); table, time, items, total, Mark Complete shown | ✅ |
| **Customer Leaderboard** (Operations) | Section loads; Top 5/10/20/50, Sort by Orders/Amount, Refresh; cards show rank, name, mobile, orders, spent, last order, loyalty badge (VIP/Regular/New) | ✅ |
| Leaderboard empty state | "No customer data yet" when no orders with mobile | ✅ |
| Order dialog close | Clears selection and closes | ✅ |
| Orders refresh while dialog open | Paused (no refetch) so dialog stays stable | ✅ |

---

## 3. Employee Dashboard

| Check | Expected | Status |
|-------|----------|--------|
| Login as employee | Redirect to `/employee`, dashboard loads | ✅ |
| First paint | Skeleton then content | ✅ |
| **Order row click** | Order popup opens with snapshot; no flicker when list updates | ✅ |
| Popup stability | Polling paused while popup open; memoized dialog; same order ref while open | ✅ |
| Accept / Preparing / Served / Complete / Cancel | Actions work; customer name/mobile editable; Mark Paid works | ✅ |

---

## 4. Customer Menu & Checkout

| Check | Expected | Status |
|-------|----------|--------|
| Open menu (public) | Categories and items load (skeleton then cards) | ✅ |
| Add to cart, View & Checkout | Cart dialog opens; name required, **mobile optional** (labeled for WhatsApp invoice) | ✅ |
| Place order without mobile | Order succeeds; toast suggests adding mobile next time | ✅ |
| Place order with valid mobile | Order succeeds; WhatsApp invoice link when provided by backend | ✅ |
| Cart dialog key | Stable `key="order-cart-dialog"` to avoid remount | ✅ |

---

## 5. Backend APIs

| Check | Expected | Status |
|-------|----------|--------|
| `POST /orders` | Accepts `customerMobile` optional; creates order; returns `waMeLink` only when mobile+name present | ✅ |
| `GET /orders/all` | Admin; returns `orders` + `byTable`; orders include `items` | ✅ |
| `GET /orders/customer-leaderboard` | Admin; query `limit`, `sortBy=orders|amount`; returns `leaderboard[]` (customerName, customerMobile, totalOrders, totalSpent, lastOrderDate) | ✅ |

---

## 6. Quick Manual Test Order

1. **Refresh** on `/admin` → see loader, then dashboard (or login).
2. **Admin → Orders** → pick a date with orders → click an order row → dialog opens with details.
3. **Admin → Customer Leaderboard** → see list (or empty state); change Top 10 / Sort by Amount / Refresh.
4. **Employee** → open an order popup → leave it open a few seconds → no flicker; close and reopen.
5. **Customer menu** → add items → Checkout → leave mobile blank → Place Order → success and toast.

---

## 7. Known / Optional Follow-ups

- **Leaderboard**: No branch filter (all branches). Add `branchId` filter if multi-branch.
- **Chunk size**: Frontend build reports main chunk >500 KB; consider code-splitting later.
- **401 on leaderboard**: Frontend sets list to `[]`; no redirect (other admin calls may redirect on 401).

---

**Summary:** Critical paths (load, auth, admin orders + leaderboard, employee popup, customer checkout) are wired and guarded. Run the manual steps above in the browser to confirm in your environment.
