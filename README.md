# Cafe Chapter 1 – Digital Menu & POS

**Repository:** [digital-menu-pos-cafe-chapter-1-digital-menu](https://github.com/Sandeep140499/digital-menu-pos-cafe-chapter-1-digital-menu)

---

## Description (for GitHub repo description field)

**Short (≤ 350 chars):**
> Digital menu and POS for restaurants. Customer menu (browse, order, optional WhatsApp invoice), employee order flow (accept → prepare → serve → pay), admin dashboard (orders, menu, staff, customer leaderboard, work hours, settings). React + Node/Prisma.

**One-liner:**
> Restaurant digital menu, ordering, and back-office — customer menu, employee POS, admin dashboard. React, Node.js, Prisma.

---

## What this project does

- **Customers** – Browse menu (lazy-loaded), add to cart, checkout with optional mobile for WhatsApp invoice; splash with time-based greeting and branch (e.g. Gautam Nagar).
- **Employees** – Live orders, accept → preparing → served → complete, mark paid, optional WhatsApp receipt; shift start/end; stable order popups.
- **Admins** – Orders by table/date, menu & categories, customer leaderboard (top by orders/spent, loyalty tags), staff, work hours, overtime, late entries, salary slips, certificates, branch settings, raised requests.

**Stack:** Frontend (React, Vite, TypeScript, Tailwind, Radix, Framer Motion), Backend (Node.js, Express, Prisma, PostgreSQL), JWT auth, optional WhatsApp links for invoice/receipt.

---

## Repo structure

- `Digital-Menu-GN/` – Frontend (Vite + React).
- `backend/` – API (Express, Prisma, auth, orders, menu, config, etc.).

---

## Quick start

1. **Backend:** `cd backend && npm install && cp .env.example .env` (set `DATABASE_URL`), `npx prisma migrate dev`, `npm run dev`.
2. **Frontend:** `cd Digital-Menu-GN && npm install && npm run dev`.
3. Open app (e.g. `http://localhost:5173`), use `/login` for admin/employee.

Use the **Description** block above in your GitHub repository **About** → **Description**.

---

## Deploy

- **Vercel (frontend) + Render (backend) + Railway (DB)** – free and stable: see **[DEPLOY-VERCEL-RENDER.md](./DEPLOY-VERCEL-RENDER.md)**.
- **SnapDeploy (containers)** – see **[DEPLOY.md](./DEPLOY.md)** (Dockerfiles, push steps, and SnapDeploy setup).
