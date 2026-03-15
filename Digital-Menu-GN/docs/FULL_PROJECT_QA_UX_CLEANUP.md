# Full Project QA & UX Cleanup Task

Complete review of all pages and components. Goal: **clean, responsive UI with only necessary elements** and practical UX improvements.

---

## 1. Global Layout & Responsiveness

### Rules

- No page should **scroll left–right** (except tables/lists inside a wrapper).
- Responsive breakpoints: **Mobile 320–480px**, **Tablet 481–1024px**, **Laptop/Desktop 1025px+**.
- Page width must never exceed `100%`.
- Only **tables or large lists** may have horizontal scroll (inside `.overflow-x-auto`).

### Implementation status

| Check | Status |
|-------|--------|
| `html`, `body`, `#root` have `overflow-x: hidden` | ✅ `index.css` |
| Main content areas use `min-w-0` / `max-w-full` | ✅ DashboardShell, main, Index |
| Table wrappers use `overflow-x-auto` | ✅ Admin & Employee tables |
| No full-page horizontal scroll | ✅ Verified |

### CSS reference

```css
/* index.css – already applied */
html { width: 100%; overflow-x: hidden; }
body { max-width: 100vw; overflow-x: hidden; }
#root { max-width: 100%; overflow-x: hidden; }

/* Table wrapper (used across admin/employee) */
.table-wrapper { overflow-x: auto; }
```

---

## 2. Forms & Inputs

### Requirements

- Mobile keyboards and pickers open correctly.
- Date fields show **calendar picker** (`type="date"`).
- Inputs **full width on mobile**.
- Labels visible; required fields marked.
- No duplicate or unused fields; clear placeholders.

### Reviewed forms

| Form | Status | Notes |
|------|--------|--------|
| Login | ✅ | Full width, labels, no duplicate fields |
| Employee (Add/Edit) | ✅ | Joining Date: `w-full min-h-[44px]` for mobile touch |
| Menu item creation | ✅ | Full width inputs, date N/A |
| Category creation | ✅ | Name, image URL |
| Order (customer) | ✅ | Table number, name, mobile, packaging |
| Reset password | ✅ | Email, token, new password |
| Date filters (Orders, Overtime, Late) | ✅ | `type="date"`, wrapped where needed |

---

## 3. Buttons & Actions

### Requirements

- Buttons respond promptly.
- Clear spacing; clear labels.
- No duplicate actions.

### Examples (current)

| Action | Label | Status |
|--------|--------|--------|
| Add menu item | "+ Add Item" | ✅ |
| Add category | "+ Add Category" | ✅ |
| Add employee | "+ Add Employee" | ✅ |
| Create employee | "Create" (in dialog) | ✅ |
| Accept / Complete order | Status-based labels | ✅ |
| Mark Paid | "Mark Paid" | ✅ |
| Save branch | "Save" / "Saved successfully" | ✅ |

---

## 4. Card UI Cleanup

### Requirements

- Consistent padding (`p-2 sm:p-3` or `p-3 sm:p-4`).
- Same button style; same font sizes.
- No overflowing text (truncate / line-clamp where needed).
- Only necessary information.

### Cards reviewed

| Card type | Status |
|-----------|--------|
| Menu cards (customer) | ✅ Responsive, image, price, Half/Full or Add |
| Order cards (employee) | ✅ Status, payment badge, actions |
| Dashboard KPI cards | ✅ 1/2/4 col grid, min-w-0, truncate |
| Customer leaderboard cards | ✅ Rank, name, mobile, orders, spent |
| Employee list card | ✅ Table in overflow-x-auto |

---

## 5. Notifications & Feedback

### Standard

- **Single notification system**: React Hot Toast (login, employee) + compact shadcn toast (admin, customer).
- Clear messages: "Order accepted", "Order completed", "Payment received", "Employee created", "Menu item added".
- No multiple popups, flashing cards, or repeated alerts.

| Scenario | Implementation |
|----------|-----------------|
| Success | `toast.success("...")` or `toast({ title: "Success", description: "..." })` |
| Error | `toast.error("...")` or `variant: "destructive"` |
| Info | `toast("...")` |

---

## 6. Dashboard

### Keep

- Today’s Orders
- Revenue (today)
- Top Selling Items
- Pending Orders
- Paid Orders
- Employees summary
- Orders by Table (with date filter)

### Removed / simplified

- No unnecessary widgets; KPI grid is 1/2/4 columns, responsive.

### Mobile

- Cards aligned; single column on mobile; no overflow.

---

## 7. Order Card Stability

### Requirements

- No flashing animations.
- Stable UI; clear order status.
- Buttons only when needed.

### Flow

```
New Order → Accept → Preparing → Completed → Paid
```

### Implementation

- Live orders section memoized to avoid re-render on clock tick.
- Empty state: "No Active Orders" / "New orders will appear here".
- Status and payment badges clear; actions per status.

---

## 8. Leaderboard Page

### Requirements

- Columns: **Customer Name**, **Mobile Number**, **Total Orders**, **Rank** (and Total Spent).
- **Top 5 (or N) in card format**.

### Implementation

- **Table** (scrollable on mobile): Rank, Customer Name, Mobile Number, Total Orders, Total Spent.
- **Cards** below: same data in card format with rank (🥇🥈🥉), name, mobile, orders, total spent, last order.
- Limit selector: Top 5, 10, 20, 50.

---

## 9. Menu Page (Customer)

### Requirements

- Responsive cards.
- Image visible; price aligned.
- Add / Half / Full visible.

### Implementation

- Grid: 1 col mobile, 2+ on larger.
- Category panel: max-h-[80dvh], scroll; Half/Full flexible width on mobile.
- Item name, price, buttons; no extra clutter.

---

## 10. Employee Page (Admin)

### Requirements

- Joining date calendar opens on mobile (touch-friendly).
- Create Employee button works.
- Table scrolls horizontally on mobile.

### Implementation

- Joining Date input: `className="w-full min-h-[44px] sm:min-h-0"` for touch target.
- Add Employee button opens dialog; Create submits.
- Employee table wrapped in `overflow-x-auto`; min-width on table for horizontal scroll on small screens.

---

## 11. Performance

### Applied

- Memoized sections (live orders, menu categories) to avoid unnecessary re-renders.
- No full-page reload on toast or modal close.
- Internal state updates for order status; API only when needed.
- Polling/refresh at reasonable intervals (e.g. 10s for orders).

---

## 12. Final QA Checklist

Before release, verify:

| # | Check | Done |
|---|--------|------|
| 1 | No horizontal scroll on any page (except table wrappers) | ☐ |
| 2 | Forms work: labels, full-width inputs, date pickers on mobile | ☐ |
| 3 | All primary buttons clickable and clearly labeled | ☐ |
| 4 | Cards responsive; consistent padding and typography | ☐ |
| 5 | Orders stable (no flashing); empty state when no orders | ☐ |
| 6 | Notifications consistent (toast only; no alert/confirm) | ☐ |
| 7 | Mobile UI clean; touch targets ≥44px where needed | ☐ |
| 8 | Dashboard readable; KPI and tables aligned | ☐ |
| 9 | Tables scroll horizontally only when needed | ☐ |
| 10 | Leaderboard: table + cards; Rank, Name, Mobile, Orders | ☐ |
| 11 | Menu cards: image, price, Half/Full or Add visible | ☐ |
| 12 | Employee: joining date picker works on mobile; table scrolls | ☐ |

---

## Goal

- **Clean** – Only necessary elements; consistent spacing and style.
- **Professional** – Clear labels, stable behaviour, no layout jumps.
- **Fast** – Minimal re-renders; no unnecessary reloads.
- **Mobile-friendly** – Touch targets, full-width inputs, scroll only where needed.
- **Simple for restaurant staff** – Obvious actions and feedback.
