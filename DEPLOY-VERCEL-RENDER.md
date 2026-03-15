# Deploy: Vercel (frontend) + Render (backend) + Railway (database)

Free, stable setup for your restaurant app:

```
Frontend (React/Vite)  →  Vercel
Backend (Node.js API)  →  Render
Database (PostgreSQL)  →  Railway
```

---

## Prerequisites

- GitHub repo pushed (this project).
- **Railway** database: create a PostgreSQL database and copy the **connection URL** (e.g. `postgresql://...`).

---

## 1. Deploy backend on Render

1. Go to [Render](https://render.com) and sign in (e.g. with GitHub).
2. **New** → **Web Service**.
3. Connect your **GitHub** account and select the repo that contains this project (e.g. `digital-menu-pos-cafe-chapter-1-digital-menu`).
4. Configure:
   - **Name:** `digital-menu-api` (or any name).
   - **Region:** Choose one close to you.
   - **Root Directory:** `backend`  
     (so Render builds and runs only the backend folder).
   - **Runtime:** Node.
   - **Build Command:**  
     `npm ci && npx prisma generate && npm run build`
   - **Start Command:**  
     `npx prisma migrate deploy || true && npm start`
   - **Instance type:** Free (or paid if you prefer).
5. **Environment variables** (Add environment variable):
   - `NODE_ENV` = `production`
   - `DATABASE_URL` = *(paste your Railway PostgreSQL connection URL)*
   - `JWT_SECRET` = *(generate a long random string, e.g. 32+ chars)*
   - `JWT_EXPIRES_IN` = `7d`
   - Optional: `FRONTEND_CUSTOMER_URL`, `FRONTEND_DASHBOARD_URL`, `EMAIL_*`, `GOOGLE_REVIEW_URL` (see `backend/.env.example`).
6. Click **Create Web Service**. Wait for the first deploy to finish.
7. Copy your backend URL, e.g. `https://digital-menu-api.onrender.com`.  
   The API base URL for the frontend is: **`https://digital-menu-api.onrender.com/api`** (with `/api`).

**Optional:** If your repo has a **root-level `render.yaml`** (this project does), you can use **Blueprint** instead: **New** → **Blueprint**, connect the repo, and Render will create the web service from the YAML (still set `DATABASE_URL` and `JWT_SECRET` in the dashboard).

---

## 2. Deploy frontend on Vercel

1. Go to [Vercel](https://vercel.com) and sign in (e.g. with GitHub).
2. **Add New** → **Project**.
3. **Import** the same GitHub repo.
4. Configure:
   - **Root Directory:** Click **Edit**, set to `Digital-Menu-GN` (so Vercel builds only the frontend).
   - **Framework Preset:** Vite (should be auto-detected).
   - **Build Command:** `npm run build` (default).
   - **Output Directory:** `dist` (default for Vite).
   - **Install Command:** `npm install` (default).
5. **Environment variables** (before first deploy):
   - **Name:** `VITE_API_BASE_URL`  
   - **Value:** `https://YOUR-RENDER-URL.onrender.com/api`  
     (use the backend URL from step 1, with `/api` at the end; no trailing slash.)
6. Click **Deploy**. Wait for the build to finish.
7. Your app will be at e.g. `https://your-project.vercel.app`.

**After first deploy:** You can add a custom domain in Vercel (Project → Settings → Domains).

---

## 3. Connect frontend and backend

- **Frontend (Vercel):** Already points to the backend via `VITE_API_BASE_URL` (built at deploy time).
- **Backend (Render):** Optionally set:
  - `FRONTEND_CUSTOMER_URL` = `https://your-project.vercel.app`
  - `FRONTEND_DASHBOARD_URL` = `https://your-project.vercel.app`  
  so CORS and emails (e.g. password reset) use the correct frontend URL.

---

## 4. Summary

| What        | Where   | URL / Note                                      |
|------------|---------|--------------------------------------------------|
| Frontend   | Vercel  | `https://your-project.vercel.app`               |
| Backend API| Render  | `https://digital-menu-api.onrender.com` → `/api`|
| Database   | Railway | Use `DATABASE_URL` in Render env                 |

**Flow:** Browser → Vercel (React) → API calls → Render (Node) → Railway (PostgreSQL).

---

## 5. Migrations and redeploys

- **Backend:** Start command already runs `npx prisma migrate deploy`. On every deploy, Render runs build then this start command, so migrations run automatically.
- **Redeploy:** Push to `main`; Vercel and Render will auto-deploy if you enabled that when connecting the repo.
- **Env changes:** Update env vars in Vercel or Render dashboard, then trigger a redeploy (or push a small commit).

---

## 6. Free tier notes

- **Render free:** Service may spin down after inactivity; first request can be slow (cold start).
- **Vercel:** Free tier is generous; no sleep.
- **Railway:** Free tier has a monthly limit; check [Railway pricing](https://railway.app/pricing).

If you want, we can add a **“keep-alive”** ping (e.g. from a cron or frontend) to reduce Render cold starts.
