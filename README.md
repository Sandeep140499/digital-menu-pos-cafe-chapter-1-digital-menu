# Digital Menu & POS — Cafe Chapter 1

Monorepo: **React (Vite) customer menu + admin/employee dashboards** and **Node.js (Express) API** with **PostgreSQL** (Prisma). Deploy the API and database on **Railway**, **Render**, **AWS EC2 + RDS**, or any host that provides Node 20+ and a Postgres connection string.

**Repository:** [digital-menu-pos-cafe-chapter-1-digital-menu](https://github.com/Sandeep140499/digital-menu-pos-cafe-chapter-1-digital-menu)

---

## What the system does

| Audience | Capabilities |
|----------|----------------|
| **Customers** | Browse menu (categories, half/full portions), cart, checkout with optional mobile for WhatsApp-style links, branch-aware landing. |
| **Employees** | Live orders, accept → prepare → serve → complete, mark paid, shifts, verification flows. |
| **Admins** | Orders by table/date, menu & categories, customer leaderboard, work hours, overtime, late entries, salary slips, monthly **sales target** (set under Revenue; progress on **Overview**), branch settings, raised requests. |

**Stack:** TypeScript, React 19, Tailwind, Radix UI, TanStack Query (where used), Express, Prisma 6, JWT + refresh cookies, optional SMTP (Brevo).

---

## Repository layout

| Path | Role |
|------|------|
| `Digital-Menu-GN/` | Frontend SPA (Vite). `npm run dev` → dev server (often `:5173`). |
| `backend/` | REST API + Socket.IO. `npm run dev` → API (default `:4000`). |
| `backend/prisma/` | Schema & SQL migrations. |
| `backend/.env.example` | **Authoritative list** of backend environment variables (copy to `.env`). |
| `Digital-Menu-GN/.env.example` | Frontend build-time variables (`VITE_*`). |

---

## Local development

1. **PostgreSQL** — Install locally or use a cloud dev DB; note the connection URL.
2. **Backend**
   ```bash
   cd backend
   npm install
   cp .env.example .env
   # Set DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SALT at minimum
   npx prisma migrate dev
   npm run dev
   ```
3. **Frontend**
   ```bash
   cd Digital-Menu-GN
   npm install
   cp .env.example .env   # optional in dev if using Vite proxy to /api
   npm run dev
   ```
4. Open the URL Vite prints (e.g. `http://localhost:5173`). Sign-in routes: `/login` (admin/employee). Ensure `VITE_API_BASE_URL` (production) or Vite proxy points at your API **`/api`** prefix.

**Health check:** `GET /api/health` → `{ "ok": true }` (for load balancers and uptime monitors).

---

## Configuration is environment-driven (portable hosts)

Nothing in application code is hard‑wired to Railway, Render, or AWS. You switch platforms by changing **environment variables** and redeploying.

### Backend (copy from `backend/.env.example`)

| Variable | Purpose |
|----------|---------|
| `NODE_ENV` | `development` / `production`. |
| `PORT` | HTTP port (Render/Railway inject this; EC2: set explicitly or use reverse proxy). |
| `DATABASE_URL` | **PostgreSQL** connection string. Works for local Postgres, **AWS RDS**, Railway Postgres, Render Postgres, Neon, etc. Add Prisma‑friendly params (`sslmode=require`, `connection_limit`, `pool_timeout`) as recommended in `.env.example`. |
| `JWT_SECRET`, `REFRESH_TOKEN_SALT` | Auth tokens — use strong random values in production. |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_EMPLOYEE_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | Token lifetimes. |
| `TRUST_PROXY` | Set `true` behind reverse proxy / load balancer (EC2 Nginx, Render, Railway) so `req.ip` and secure cookies behave. |
| `CORS_ORIGIN`, `FRONTEND_URL`, `FRONTEND_CUSTOMER_URL`, `FRONTEND_DASHBOARD_URL` | Comma‑separated allowed browser origins + link targets for emails. **Set all deployed frontend origins** in production. |
| `EMAIL_*`, `BREVO_API_KEY` | Optional transactional email (verification, salary slips, monthly target notices). |
| `ENABLE_MONTHLY_TARGETS` | `true` / `false` — toggles monthly target APIs used by admin Revenue / Overview. |

### Frontend (`Digital-Menu-GN/.env`)

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | Full API base including `/api`, e.g. `https://api.yourdomain.com/api`. **Required in production** unless the static host rewrites `/api` to your backend. |
| `VITE_FRONTEND_URL` | Public site URL for links in emails / redirects. |

---

## Database (Prisma + PostgreSQL)

- **Migrations:** `cd backend && npx prisma migrate deploy` (production) or `npx prisma migrate dev` (development).
- **AWS RDS:** Create a PostgreSQL instance, allow inbound from your app (security group), use the RDS endpoint in `DATABASE_URL` with `sslmode=require`.
- **Connection pooling:** On small instances use a low `connection_limit` (see `.env.example`). Prefer the provider’s **pooler URL** (e.g. PgBouncer) when available.

---

## Deployment patterns

### A. Railway (API + Postgres)

This repo is a **monorepo** (`backend/` + `Digital-Menu-GN/`). Railway must build the **API service from `backend`**, not from the repository root.

1. **Postgres:** create the plugin → copy `DATABASE_URL` into the **backend** service variables.
2. **Service root directory (critical):** in the Railway service → **Settings** → **Root Directory** set to **`backend`**. If this is empty or `.`, builds can fail or never pick up `backend/package.json` and `backend/railway.toml`.
3. **GitHub connection:** **Settings** → **Source** → connect the correct repo and branch (usually **`main`**). After connecting, pushes to that branch should create a new **Deployment** (see the **Deployments** tab).
4. **If pushes do not trigger a deploy:** open **Deployments** → confirm the latest run is from your latest commit SHA. Use **Deploy** → **Redeploy** once to verify. In **Settings**, turn off **“Wait for CI”** unless you intentionally use a GitHub Action that Railway waits for (otherwise deploys can appear stuck or skipped).
5. **If deploy runs but the API looks old:** open the failed/successful deploy **Build logs** and **Deploy logs** — fix env or build errors (e.g. `prisma migrate` against wrong `DATABASE_URL`).
6. **Config as code:** this repo includes **`backend/railway.toml`** (Nixpacks build + `npm start` + `/api/health` healthcheck). It is only used when the service root is **`backend`**.
7. Deploy the frontend separately (Vercel, etc.) with `VITE_API_BASE_URL` pointing at your Railway URL + **`/api`**.

### B. Render (Web service + Postgres)

1. New **PostgreSQL** → internal `DATABASE_URL`.
2. New **Web Service**, root `backend`, build `npm install && npm run build`, start `npm run start`.
3. Under **Environment**, paste variables; enable **Trust proxy** if Render recommends it (`TRUST_PROXY=true`).
4. Frontend: static site or Web service from `Digital-Menu-GN` with `npm run build` / `vite preview` or host `dist/` on CDN.

### C. AWS EC2 (API) + AWS RDS (PostgreSQL)

1. **RDS:** PostgreSQL, note endpoint, user, password, DB name → build `DATABASE_URL`.
2. **EC2:** Amazon Linux / Ubuntu, install Node 20 LTS, clone repo, `cd backend && npm ci && npm run build`.
3. Process manager: **systemd** or **PM2** to run `npm run start` (or `node dist/index.js` after `npx prisma migrate deploy` in UserData / deploy script).
4. **Nginx** (or ALB) as reverse proxy: TLS termination, `proxy_pass` to `127.0.0.1:PORT`, forward `X-Forwarded-*` headers; set `TRUST_PROXY=true`.
5. **Security groups:** RDS allows Postgres **only** from EC2 (or ALB) SG; EC2 allows 443 from internet if public API.
6. **Frontend:** Build `Digital-Menu-GN` locally or in CI (`npm run build`), upload `dist/` to **S3** + **CloudFront**, or host on Vercel; set `VITE_API_BASE_URL` to your public API URL.

### D. Vercel / Netlify (frontend only)

These hosts serve static files. Point `VITE_API_BASE_URL` at your API (Railway, Render, EC2, etc.). Configure **CORS** on the backend for the exact frontend origin.

---

## Beginner walkthrough: Vercel (UI) + AWS RDS (DB) + AWS EC2 (API) + auto-deploy on git push

Use this if you are **new to AWS** and want: **frontend on Vercel**, **Node API + PostgreSQL on AWS**, and **GitHub Actions** to update the backend when you push to `main`.

### 0) Understand billing and your $10 alert

1. In AWS Console open **Billing and Cost Management** → **Budgets** → **Create budget**.
2. Choose **Cost budget** (or **Usage** if you prefer), period **Monthly**, amount **10 USD**.
3. Add **alert thresholds** (e.g. **80%** and **100%**) and your **email** under notifications.
4. Optional: **AWS Cost Anomaly Detection** in the same billing area.

Promotional credits (e.g. $140 for a few months) and the **Free Tier** are separate concepts; a budget still emails you as spend approaches **$10** so you can pause or resize resources.

**Cost control tips:** use **one** small EC2 (e.g. `t3.micro` where free tier applies for new accounts) and **one** small RDS (`db.t3.micro` / `db.t4g.micro` in free tier where eligible). Turn off unused regions and delete experiments when done.

---

### 1) Pick names and URLs (write them down)

| Item | Example | You fill |
|------|---------|----------|
| API public URL | `https://api.yourdomain.com` | Your domain or EC2 public DNS for testing |
| Vercel app URL | `https://your-app.vercel.app` | From Vercel after first deploy |
| AWS region | `ap-south-1` | Closest to your users |

You will point **Vercel** at `VITE_API_BASE_URL=https://api.yourdomain.com/api` (must include `/api`).

---

### 2) Create the database (RDS PostgreSQL)

1. AWS Console → **RDS** → **Create database**.
2. Engine: **PostgreSQL** (recent minor version supported by Prisma in this repo).
3. Template: **Free tier** if offered; otherwise smallest **Production** size you accept.
4. DB identifier, master username/password: **save the password** in a password manager.
5. **VPC / subnets:** default VPC is fine to start. **Public access:** for learning only you may enable it; stricter setup keeps RDS private and reachable only from EC2 in the same VPC (recommended later).
6. **VPC security group:** create or select one — **inbound rule: PostgreSQL 5432 from the EC2 security group only** (after EC2 exists you attach the same SG or reference EC2’s SG). For a quick lab only, some teams temporarily allow **My IP** — remove that when done.
7. After status **Available**, copy the **endpoint** host (not `https`), e.g. `mydb.xxxxx.ap-south-1.rds.amazonaws.com`.
8. Build **`DATABASE_URL`** (adjust user/db/ssl):

   `postgresql://USER:PASSWORD@HOST:5432/postgres?sslmode=require`

   Put this in the backend `.env` on EC2 (never commit it to git).

---

### 3) Create the API server (EC2)

1. **EC2** → **Launch instance**.
2. OS: **Ubuntu Server 24.04 LTS** (or latest LTS).
3. Instance type: **t3.micro** (or free-tier eligible type shown in console).
4. **Key pair:** create new `.pem`, download it — you need it for SSH and for GitHub Actions.
5. **Network:** same **VPC** as RDS (simplest). **Security group inbound:**
   - **SSH 22** from **My IP** (for you to log in).
   - **HTTP 80** and/or **HTTPS 443** from **0.0.0.0/0** if the API will be reached directly on the instance (or only from a load balancer later).
6. **Storage:** 20–30 GiB gp3 is enough to start.
7. Launch, wait **Running**, note the **Public IPv4** (or assign an **Elastic IP** so the address does not change when you stop/start).

**First SSH (from your PC, WSL or PowerShell with OpenSSH):**

`ssh -i path/to/your.pem ubuntu@EC2_PUBLIC_IP`

(Username may be `ubuntu` for Ubuntu AMI; Amazon Linux is often `ec2-user`.)

---

### 4) Install Node, PM2, Nginx, and clone the app (on EC2)

Run as the default user (e.g. `ubuntu`):

```bash
sudo apt update && sudo apt install -y git nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm i -g pm2
```

Clone **your** GitHub repo (HTTPS works for public repos; for **private** repos set up a [Deploy key](https://docs.github.com/en/authentication/connecting-to-github-with-ssh/managing-deploy-keys) read-only on the repo and add the private key on the EC2 `~/.ssh`):

```bash
mkdir -p ~/app && cd ~/app
git clone https://github.com/YOUR_ORG/YOUR_REPO.git gn
cd gn/backend
cp .env.example .env
nano .env   # set DATABASE_URL, JWT_SECRET, REFRESH_TOKEN_SALT, PORT=4000, TRUST_PROXY=true, CORS / FRONTEND URLs (see below)
```

**Minimum backend `.env` for this architecture:**

- `DATABASE_URL` — from step 2.
- `JWT_SECRET`, `REFRESH_TOKEN_SALT` — long random strings.
- `PORT=4000`
- `TRUST_PROXY=true` — because Nginx will sit in front.
- `NODE_ENV=production`
- `CORS_ORIGIN` — your Vercel URL, e.g. `https://your-app.vercel.app`
- `FRONTEND_URL`, `FRONTEND_CUSTOMER_URL`, `FRONTEND_DASHBOARD_URL` — same Vercel URL (or customer vs admin if you split later).

One-time DB setup:

```bash
cd ~/app/gn/backend
npm ci
npx prisma migrate deploy
npm run build
pm2 start npm --name pos-backend -- run start
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

Check: `curl -s http://127.0.0.1:4000/api/health` should return JSON with `"ok":true`.

---

### 5) Put Nginx in front (TLS + reverse proxy to Node)

**Option A — quickest test (HTTP only):** open port **4000** in the EC2 security group and set Vercel to `http://EC2_PUBLIC_IP:4000/api` (not ideal for production; browsers may block mixed content if the site is HTTPS).

**Option B — recommended:** Nginx listens on **443**, terminates TLS with a certificate from **Let’s Encrypt** (use your domain’s `api` A record pointing to the EC2 Elastic IP), and proxies to `http://127.0.0.1:4000`.

Example Nginx site (replace `api.yourdomain.com`); obtain cert with **certbot** (`sudo apt install certbot python3-certbot-nginx`):

```nginx
server {
  listen 80;
  server_name api.yourdomain.com;
  location /api/ {
    proxy_pass http://127.0.0.1:4000/api/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
  location /socket.io/ {
    proxy_pass http://127.0.0.1:4000/socket.io/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
  }
}
```

After HTTPS works, use **`VITE_API_BASE_URL=https://api.yourdomain.com/api`** on Vercel.

---

### 6) Deploy the frontend on Vercel

1. Push your repo to **GitHub** (if not already).
2. [vercel.com](https://vercel.com) → **Add New** → **Project** → import the repo.
3. **Root Directory:** `Digital-Menu-GN` (important — not the monorepo root).
4. **Framework:** Vite (auto-detected). **Build command:** `npm run build`. **Output:** `dist`.
5. **Environment variables** (Production):  
   `VITE_API_BASE_URL` = `https://api.yourdomain.com/api` (your real API URL + `/api`).  
   Optionally `VITE_FRONTEND_URL` = your Vercel URL.
6. Deploy. Open the Vercel URL and test login and menu.

Whenever you change only the **frontend**, push to `main` — Vercel rebuilds automatically.

---

### 7) Auto-update the backend when you push (GitHub Actions → EC2)

This repo includes **`.github/workflows/deploy-backend-ec2.yml`**. It SSHs into EC2, runs `git pull`, installs dependencies, builds, runs migrations, and **restarts PM2** `pos-backend`.

**One-time setup**

1. On EC2, the repo path should match what you will store in GitHub secrets, e.g. `/home/ubuntu/app/gn` (contains `backend/`).
2. GitHub repo → **Settings** → **Secrets and variables** → **Actions** → add:

   | Secret | Value |
   |--------|--------|
   | `EC2_HOST` | EC2 public IP or DNS |
   | `EC2_USER` | e.g. `ubuntu` |
   | `EC2_SSH_PRIVATE_KEY` | Full contents of the **`.pem`** key (including `BEGIN`/`END` lines) |
   | `EC2_APP_DIR` | Absolute path to repo root on the server, e.g. `/home/ubuntu/app/gn` |

3. Ensure the same key’s **public** side is in `~/.ssh/authorized_keys` on the EC2 user.

**Behaviour:** any push to **`main`** that changes files under **`backend/`** (or the workflow file) runs the deploy. You can also run it manually: **Actions** tab → **Deploy backend to EC2** → **Run workflow**.

**Private GitHub repo:** on EC2, use a **deploy key** with read access so `git pull` works without storing a password.

---

### 8) After each deploy — quick checks

- `https://api.yourdomain.com/api/health`
- Vercel site: customer menu + admin login
- If Socket.IO fails behind Nginx, confirm the **`/socket.io/`** block above

---

## Production checklist

- [ ] `DATABASE_URL` on managed Postgres with TLS.
- [ ] Strong `JWT_SECRET` and `REFRESH_TOKEN_SALT`.
- [ ] All frontend origins in `CORS_ORIGIN` / `FRONTEND_*`.
- [ ] `FRONTEND_URL` for password reset / verification links.
- [ ] `npm run build` in `backend`; `prestart` runs migrations on deploy.
- [ ] `GET /api/health` wired for monitoring.
- [ ] Optional: SMTP for email flows.

---

## Monthly sales target (admin)

- **Set:** Admin → **Revenue** → enter amount (plain digits, commas stripped) → **Set target** (`POST /api/monthly-targets/set`). Requires `ENABLE_MONTHLY_TARGETS=true`.
- **Progress:** Admin → **Overview** card “This month’s sales target” shows paid revenue vs target and a progress bar. Data comes from `GET /api/monthly-targets/branch/:branchId` (branch id is taken from the selected branch in dashboard; progress itself is calendar‑month global revenue).

---

## Scripts (root `package.json`)

- `npm run build` — builds frontend then backend.
- `npm run lint` — ESLint on both packages.
- `npm run test:api` — backend Vitest only (from repo root). Use `npm test` to include Playwright E2E (needs API running).

---

## QA status (automated)

Last run: **2026-04-11** (local workspace).

| Check | Result |
|--------|--------|
| `npm run lint` (root) | **Pass** — 0 errors; backend/frontend report existing `@typescript-eslint/no-explicit-any` warnings (technical debt, non-blocking). |
| `npm run test:api` (root → `backend` Vitest) | **Pass** — 10 tests (`auth`, `orders` API contracts). |
| `npm run build` | **Frontend:** `vite build` succeeds. **Backend:** `prisma generate` can fail on **Windows** with `EPERM` if another Node process holds `query_engine-windows.dll.node` — stop `npm run dev` / other API processes, retry, or rely on **CI/Linux** where this does not occur. `npx tsc` in `backend/` compiles when Prisma client is already generated. |
| Playwright E2E (`Digital-Menu-GN`) | Not run in this pass — requires app URLs and seeded credentials; run with `cd Digital-Menu-GN && npx playwright test` when the API is up. |

**Manual smoke (recommended after deploy):** `/login` → admin dashboard Overview loads; **Revenue** monthly target save; **Menu** edit item; **Customer menu** (public `/`) loads categories; employee flow accept → paid on a test order.

---

## How the project works (flow map)

High-level architecture: one **SPA** talks to one **HTTP + WebSocket API**; the API owns **Postgres** via Prisma. Public menu routes are mostly unauthenticated; admin/employee routes require **JWT** (Bearer header and/or refresh cookie, depending on route).

### System context

```mermaid
flowchart LR
  subgraph Browser["Browser"]
    CUST["Customer UI\n(Index / menu)"]
    STAFF["Admin + Employee UI\n(/admin /employee)"]
  end
  subgraph API["Node API :4000 /api"]
    EXP["Express routers"]
    IO["Socket.IO"]
    PR["Prisma → PostgreSQL"]
  end
  CUST -->|HTTPS JSON| EXP
  STAFF -->|HTTPS JSON + JWT| EXP
  STAFF <-->|realtime orders| IO
  EXP --> PR
  IO --> PR
```

### Request path (typical authenticated call)

```mermaid
sequenceDiagram
  participant UI as React SPA
  participant API as Express /api
  participant Auth as JWT middleware
  participant DB as Prisma / Postgres
  UI->>API: fetch + Authorization Bearer
  API->>Auth: verify token + role
  Auth->>DB: query / mutation
  DB-->>API: rows
  API-->>UI: JSON
```

### Customer journey (browse → order)

```mermaid
flowchart TD
  A[Landing / menu URL] --> B[GET /api/menu public]
  B --> C[Render categories + items]
  C --> D[Cart local state]
  D --> E[Checkout: POST /api/orders or flow in app]
  E --> F[Order stored branch + table + items]
  F --> G[Optional WhatsApp / invoice links]
```

Exact checkout endpoints depend on the current customer page implementation; orders are always tied to **branch**, **table**, and line items in the database.

### Employee order lifecycle

```mermaid
stateDiagram-v2
  [*] --> NEW_ORDER: customer places order
  NEW_ORDER --> ACCEPTED: employee accepts
  ACCEPTED --> PREPARING: status update
  PREPARING --> SERVED: status update
  SERVED --> COMPLETED: complete
  COMPLETED --> PAID: mark paid
  note right of NEW_ORDER
    Socket.IO may broadcast updates
    to admin + other employees
  end note
```

### Admin dashboard data flow

```mermaid
flowchart LR
  subgraph Admin["AdminDashboard.tsx"]
    SEC["Section: overview menu orders …"]
    STATE["React state + loadDashboardData"]
  end
  subgraph Endpoints["Representative /api routes"]
    M["GET /menu/admin"]
    O["GET /orders/all"]
    T["GET /monthly-targets/branch/:id"]
    R["GET /reports/…"]
  end
  SEC --> STATE
  STATE --> M
  STATE --> O
  STATE --> T
  STATE --> R
```

Admin sections call batched `fetch` helpers on load and after mutations (e.g. menu PATCH, monthly target POST), then merge results into local state so the UI stays consistent even if one request in a batch fails.

### Auth roles (simplified)

```mermaid
flowchart TB
  LOGIN["POST /api/auth/login"] --> ROLE{role in JWT}
  ROLE -->|ADMIN| AD["/admin/* routes in SPA\n+ requireRole ADMIN on API"]
  ROLE -->|EMPLOYEE| EM["/employee/* routes\n+ requireRole EMPLOYEE"]
  ROLE -->|none| PU["Public menu only"]
```

---

## Support & customization

Business rules (business day cutoff, reports, archiving) live in `backend/src` services and cron jobs. UI copy and branding live in `Digital-Menu-GN/src`. Keep secrets out of git; use platform env UIs or AWS Parameter Store / Secrets Manager on EC2.
