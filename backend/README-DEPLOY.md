# Deploy this backend anywhere

Use **this folder** as the project/root directory when deploying.

## One-time setup

1. Set **environment variables** (see `.env.example`):
   - **Required:** `DATABASE_URL`, `JWT_SECRET`
   - **Optional:** `PORT` (default 4000), `JWT_EXPIRES_IN`, `EMAIL_*`, `FRONTEND_*_URL`, `GOOGLE_REVIEW_URL`
   - **Performance (recommended for Railway free DB):** keep Prisma pool small per instance:
     - `connection_limit=5`
     - `pool_timeout=30`
     
     Example:
     
     `postgresql://USER:PASS@HOST:PORT/DB?sslmode=require&connection_limit=5&pool_timeout=30`
     
     If your Postgres provider offers a **pooler / PgBouncer URL**, prefer using that URL as `DATABASE_URL`
     (this is the most stable setup when 50+ users hit the server together).

2. **Build:** `npm ci && npm run build`  
   (`npm run build` runs `prisma generate && tsc`.)

3. **Start:** `npx prisma migrate deploy || true && npm start`  
   (Or just `npm start` if you run migrations separately.)

## Realtime / Socket.IO scaling (important)

- **Single instance (recommended without Redis):** everything works out of the box.
- **Multiple instances:** Socket.IO events only reach clients connected to the same instance unless you use:
  - **Sticky sessions** at the load balancer (no extra infra), or
  - A shared Socket.IO adapter (requires Redis).

## Handling many requests (recommended)

### Option A: Cluster mode (one machine, multiple CPU cores)

Enable multiple Node workers behind one port (helps prevent one busy request from stalling the whole app).

- Set `ENABLE_CLUSTER=true`
- Set `WEB_CONCURRENCY` to number of workers (e.g. `WEB_CONCURRENCY=4`)

Notes:
- Background jobs/crons run **only once** (first worker) to avoid duplicate emails/reports.
- For realtime: WebSocket connections stay on the same worker after upgrade, but if your platform/load balancer does anything unusual, enable **sticky sessions**.

### Option B: Platform load balancer (multiple instances)

Run multiple instances/containers and let the platform load balance (Railway/Render/etc).
If you do this and use Socket.IO without Redis, ensure **sticky sessions**.

## Platform config in this folder

| File | For |
|------|-----|
| `Dockerfile` | Any Docker host (SnapDeploy, Fly.io, ECS, etc.) |
| `Procfile` | Heroku, Render (native Node) |
| `render.yaml` | Render Blueprint |
| `railway.toml` | Railway |

Health check: **GET /** or **GET /api/health**. App listens on **0.0.0.0** and uses **PORT** from env (default 4000).

## Director emails & monthly order archive (optional)

- **Daily business summary** to directors: cron in `src/cron/dailyDirectorReport.ts` (after shift auto-close time). Requires SMTP/Brevo and director emails on branches.
- **Monthly PDF report** to directors: `src/cron/monthlyDirectorReport.ts` (1st of month, branch timezone).

To **clear only the reported month’s orders** after the monthly PDF email succeeds (same date range as the PDF — the **previous calendar month**; older orders remain; **menu, employees, shifts, branches** unchanged; **next `Order.id` continues** because PostgreSQL keeps the sequence after `DELETE`):

1. Set **`ORDER_PURGE_AFTER_MONTHLY_REPORT=true`** in Railway env.
2. If the monthly email fails, **no purge runs**.

Child rows for those orders (`OrderItem`, `PaymentRecord`, etc.) are removed in the same transaction; optional `orderId` on notifications/queries for those ids is nulled.
