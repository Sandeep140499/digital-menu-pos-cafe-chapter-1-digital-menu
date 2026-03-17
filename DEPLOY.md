# Deploy options

**Recommended (free, stable):** Frontend on **Vercel**, backend on **Railway** or **Render**, database on **Railway**. Keep **Render** as a fallback: when Railway credits run out, make a small change, push, and use Render for the backend so the app keeps running.  
→ See **[DEPLOY-VERCEL-RENDER.md](./DEPLOY-VERCEL-RENDER.md)** for step-by-step (includes “Switch to Render when Railway credits run out”).

**Containers (SnapDeploy):** Push to GitHub and deploy backend + frontend as containers on [SnapDeploy](https://snapdeploy.dev/containers). Details below.

---

## 1. Push to GitHub

### Option A: One repo (monorepo) – recommended for SnapDeploy

Your project has two folders: `backend/` and `Digital-Menu-GN/`. Push the whole repo so SnapDeploy can build **two containers** from the same repo.

```powershell
cd d:\GN
git init
git add .
git add -f backend/.env.example Digital-Menu-GN/.env.example
# Don't commit secrets
echo ".env" >> .gitignore
echo "backend/.env" >> .gitignore
echo "Digital-Menu-GN/.env" >> .gitignore
git add .gitignore
git commit -m "Initial commit: Digital Menu & POS (backend + frontend)"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git push -u origin main
```

Replace `YOUR_USERNAME` and `YOUR_REPO_NAME` with your GitHub username and repo (e.g. `cafe-chapter-1-digital-menu`).

### Option B: Two separate repos

- Push `backend/` to one repo (e.g. `cafe-menu-api`).
- Push `Digital-Menu-GN/` to another (e.g. `cafe-menu-web`).
- In SnapDeploy you’ll create **two** container projects (one per repo).

---

## 2. Deploy with SnapDeploy

SnapDeploy is a container hosting platform (AWS): [https://snapdeploy.dev/containers](https://snapdeploy.dev/containers).

### Backend container

1. Log in at [SnapDeploy](https://snapdeploy.dev/containers).
2. **Create new container** (or “New project”).
3. Connect your GitHub account and select the repo (the one that contains `backend/`).
4. **Build settings:**
   - **Dockerfile path:** `backend/Dockerfile`  
     (or the path to the Dockerfile inside the repo, e.g. `./backend/Dockerfile` if SnapDeploy expects a path from repo root).
   - **Root/build context:** repo root (so `backend/` is available).
5. **Start command** (if prompted): `cd backend && PORT=4000 npm start` (so the app runs from the backend folder; use the port your platform assigns if it sets `PORT`).
6. **Environment variables** (set in SnapDeploy dashboard):
   - `DATABASE_URL` – PostgreSQL connection string.
   - `JWT_SECRET` – strong random string.
   - `JWT_EXPIRES_IN` – e.g. `7d`.
   - `PORT` – e.g. `4000` (if SnapDeploy doesn’t set it).
   - Optional: `EMAIL_*`, `FRONTEND_CUSTOMER_URL`, `FRONTEND_DASHBOARD_URL`, `GOOGLE_REVIEW_URL` (see `backend/.env.example`).
7. **Health check** (if configurable): path `/` or `/api/health`, port same as app (e.g. `4000` or the `PORT` you set). Backend listens on `0.0.0.0`.
8. Deploy. Note the backend URL (e.g. `https://your-api.snapdeploy.app`).
9. **If health check still fails:** Check deploy logs. Often the app exits before listening because (a) `prisma migrate deploy` fails (wrong or unreachable `DATABASE_URL`), or (b) build didn’t run so `dist/` is missing. Ensure `DATABASE_URL` is set and that your DB allows connections from the deployment platform’s IP. The Dockerfile now starts the server even if migrate fails so the container stays up; fix DB and re-run migrations if needed.

### Frontend container

1. In SnapDeploy, create **another** container project.
2. Select the **same** GitHub repo (monorepo) or the frontend-only repo.
3. **Build settings:**
   - **Dockerfile path:** `Digital-Menu-GN/Dockerfile` (or `./Digital-Menu-GN/Dockerfile`).
   - **Build context:** repo root.
   - **Build args** (if SnapDeploy supports them):  
     `VITE_API_BASE_URL` = your backend API URL (e.g. `https://your-api.snapdeploy.app/api`).
4. If SnapDeploy doesn’t support build args, set `VITE_API_BASE_URL` in the frontend app (e.g. in a `.env.production` or in the build config) so the built app points to your backend.
5. Deploy. Note the frontend URL (e.g. `https://your-app.snapdeploy.app`).

### Routing (if both on same domain)

If SnapDeploy gives you one domain and you want:

- `https://your-app.snapdeploy.app` → frontend  
- `https://your-app.snapdeploy.app/api` → backend  

you need to configure that in SnapDeploy (reverse proxy / routing). If instead you get two URLs (one for frontend, one for backend), set:

- **Frontend:** `VITE_API_BASE_URL=https://your-backend-url.snapdeploy.app/api`  
so the app calls the backend by its real URL.

---

## 3. Deploy backend anywhere

The backend is set up to run on **any** host: use **root directory** = `backend` (or deploy from a repo that contains only the `backend/` folder).

| Platform | Root dir | Build | Start | Config |
|----------|----------|-------|--------|--------|
| **Docker** (SnapDeploy, Fly, ECS, etc.) | Repo root, Dockerfile path `backend/Dockerfile` | Image build | `node dist/index.js` (in container) | `backend/Dockerfile` |
| **Render** | `backend` | Uses `render.yaml` or: `npm ci && npx prisma generate && npm run build` | `npx prisma migrate deploy \|\| true; npm start` | `backend/render.yaml` |
| **Railway** | `backend` | Uses `railway.toml` or: `npm ci && npx prisma generate && npm run build` | `npx prisma migrate deploy \|\| true; npm start` | `backend/railway.toml` |
| **Heroku** | `backend` | `npm ci && npm run build` | From `Procfile`: `node dist/index.js` | `backend/Procfile` |
| **Generic (VPS, etc.)** | `backend` | `npm ci && npm run build` | `npm start` (uses `PORT` from env, default 4000) | — |

**Required env vars:** `DATABASE_URL`, `JWT_SECRET`. Optional: `PORT`, `JWT_EXPIRES_IN`, `EMAIL_*`, `FRONTEND_*_URL`, `GOOGLE_REVIEW_URL` (see `backend/.env.example`).

**Health:** App listens on `0.0.0.0` and exposes `GET /` and `GET /api/health`. Set your platform’s health check to one of these and the same port the app uses (`PORT` or 4000).

---

## 4. After first deploy

1. **Backend:** Ensure the database is reachable from SnapDeploy (e.g. Railway, Neon, or any PostgreSQL with a public or allowed IP). Run migrations via the container’s start command (`prisma migrate deploy` is already in the Dockerfile).
2. **Frontend:** Open the frontend URL; login and menu should use the backend URL you set in `VITE_API_BASE_URL`.
3. Create an admin user (e.g. via backend seed or a one-off script) if you don’t have one yet.

---

## 5. Change and redeploy

To deploy again after code or config changes:

1. **Commit and push to `main`:**
   ```powershell
   cd d:\GN
   git add .
   git commit -m "Your change message"
   git push origin main
   ```
2. If SnapDeploy is connected to this repo, it will usually **auto-redeploy** on push. Otherwise use the **Redeploy** (or “Deploy”) button in the SnapDeploy dashboard for each container (backend and frontend).
3. To change **environment variables** only (no code change), update them in the SnapDeploy project settings and trigger a redeploy from the dashboard.

---

## 6. Files added for deployment

| File | Purpose |
|------|--------|
| `backend/Dockerfile` | Container build; runs `prisma migrate deploy` then `node dist/index.js`. Use with any Docker host. |
| `backend/Procfile` | Heroku/Render: `web: node dist/index.js`. |
| `backend/render.yaml` | Render Blueprint: build + start + health for Node. |
| `backend/railway.toml` | Railway: build command, start command, health path. |
| `backend/.dockerignore` | Keeps node_modules, .env, tests out of the build context. |
| `Digital-Menu-GN/Dockerfile` | Builds Vite app (with optional `VITE_API_BASE_URL`), serves static files with nginx. |
| `Digital-Menu-GN/.dockerignore` | Keeps node_modules and env files out of the build context. |

---

## 7. Useful commands (local check)

```powershell
# Backend – build and run locally (set DATABASE_URL etc. in env)
cd d:\GN\backend
docker build -t cafe-menu-api .
docker run -p 4000:4000 --env-file .env cafe-menu-api

# Frontend – build and run locally
cd d:\GN\Digital-Menu-GN
docker build -t cafe-menu-web .
docker run -p 80:80 cafe-menu-web
```

Then open `http://localhost` for the app; ensure the frontend is built with the correct API URL if you’re not using a proxy.
