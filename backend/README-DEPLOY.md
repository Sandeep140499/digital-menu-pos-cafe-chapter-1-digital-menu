# Deploy this backend anywhere

Use **this folder** as the project/root directory when deploying.

## One-time setup

1. Set **environment variables** (see `.env.example`):
   - **Required:** `DATABASE_URL`, `JWT_SECRET`
   - **Optional:** `PORT` (default 4000), `JWT_EXPIRES_IN`, `EMAIL_*`, `FRONTEND_*_URL`, `GOOGLE_REVIEW_URL`
   - **Performance (recommended):** add Prisma pool params to `DATABASE_URL`:
     - `connection_limit=20`
     - `pool_timeout=20`
     
     Example:
     
     `postgresql://USER:PASS@HOST:PORT/DB?sslmode=require&connection_limit=20&pool_timeout=20`
     
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

## Platform config in this folder

| File | For |
|------|-----|
| `Dockerfile` | Any Docker host (SnapDeploy, Fly.io, ECS, etc.) |
| `Procfile` | Heroku, Render (native Node) |
| `render.yaml` | Render Blueprint |
| `railway.toml` | Railway |

Health check: **GET /** or **GET /api/health**. App listens on **0.0.0.0** and uses **PORT** from env (default 4000).
