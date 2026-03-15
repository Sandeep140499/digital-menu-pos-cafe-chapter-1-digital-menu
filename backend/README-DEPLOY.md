# Deploy this backend anywhere

Use **this folder** as the project/root directory when deploying.

## One-time setup

1. Set **environment variables** (see `.env.example`):
   - **Required:** `DATABASE_URL`, `JWT_SECRET`
   - **Optional:** `PORT` (default 4000), `JWT_EXPIRES_IN`, `EMAIL_*`, `FRONTEND_*_URL`, `GOOGLE_REVIEW_URL`

2. **Build:** `npm ci && npm run build`  
   (`npm run build` runs `prisma generate && tsc`.)

3. **Start:** `npx prisma migrate deploy || true && npm start`  
   (Or just `npm start` if you run migrations separately.)

## Platform config in this folder

| File | For |
|------|-----|
| `Dockerfile` | Any Docker host (SnapDeploy, Fly.io, ECS, etc.) |
| `Procfile` | Heroku, Render (native Node) |
| `render.yaml` | Render Blueprint |
| `railway.toml` | Railway |

Health check: **GET /** or **GET /api/health**. App listens on **0.0.0.0** and uses **PORT** from env (default 4000).
