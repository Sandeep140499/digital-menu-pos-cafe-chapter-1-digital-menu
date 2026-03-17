# Deploy: Vercel (frontend) + Render or Railway (backend) + Railway (database)

Free, stable setup for your restaurant app. You can run the **backend** on either **Railway** or **Render**; keep both as options.

- **Railway backend:** Fast, no cold start; uses monthly credits.
- **Render backend:** Free tier can sleep (cold start); runs continuously when you use it. Good fallback when Railway credits run out.

```
Frontend (React/Vite)  →  Vercel
Backend (Node.js API)  →  Railway or Render  (same DB)
Database (PostgreSQL)  →  Railway
```

---

## Prerequisites

- GitHub repo pushed (this project).
- **Railway** database: in [Railway](https://railway.app) create a PostgreSQL database and copy the **connection URL** (e.g. `postgresql://...`). Use this same `DATABASE_URL` for either Railway or Render backend.

---

## 1. Deploy backend (choose Railway or Render)

### Option A — Backend on Railway

1. Go to [Railway](https://railway.app/dashboard) and ensure you have a **workspace** (create one if prompted).
2. **New** → **Project** → **Deploy from GitHub repo**, and select this project’s repo.
3. In the new service, open **Settings**:
   - Set **Root Directory** to **`backend`** (required so Prisma finds `prisma/schema.prisma`).
   - Build and start commands are read from `backend/railway.toml` (or set **Build Command:** `npm ci && npx prisma generate && npm run build`, **Start Command:** `npx prisma migrate deploy || true; npm start`).
4. **Variables:** Add `DATABASE_URL` (Railway PostgreSQL URL), `JWT_SECRET`, `JWT_EXPIRES_IN` (e.g. `7d`). Optional: `NODE_ENV=production`, `FRONTEND_CUSTOMER_URL`, `FRONTEND_DASHBOARD_URL`, etc. (see `backend/.env.example`).
5. **Deploy.** Copy the generated backend URL (e.g. `https://your-app.up.railway.app`). The API base for the frontend is **`https://your-app.up.railway.app/api`**.

Railway backend: no cold start; uses monthly credits. When credits run out, use **Section 7** to switch to Render.

### Option B — Backend on Render

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
    `npx prisma migrate deploy || true; npm start`
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
   - **Value:** Your backend API URL + `/api`  
     (e.g. `https://your-app.up.railway.app/api` or `https://digital-menu-api.onrender.com/api` — no trailing slash.)
6. Click **Deploy**. Wait for the build to finish.
7. Your app will be at e.g. `https://your-project.vercel.app`.

**After first deploy:** You can add a custom domain in Vercel (Project → Settings → Domains).

---

## 3. Connect frontend and backend

- **Frontend (Vercel):** Points to the backend via `VITE_API_BASE_URL` (built at deploy time). Use your Railway or Render backend URL + `/api`.
- **Backend (Railway or Render):** Optionally set:
  - `FRONTEND_CUSTOMER_URL` = `https://your-project.vercel.app`
  - `FRONTEND_DASHBOARD_URL` = `https://your-project.vercel.app`  
  so CORS and emails (e.g. password reset) use the correct frontend URL.

---

## 4. Summary

| What        | Where            | URL / Note                                                |
|------------|------------------|------------------------------------------------------------|
| Frontend   | Vercel           | `https://your-project.vercel.app`                         |
| Backend API| Railway or Render| e.g. `https://your-app.up.railway.app/api` or `...onrender.com/api` |
| Database   | Railway          | Use `DATABASE_URL` in your backend (Railway or Render)     |

**Flow:** Browser → Vercel (React) → API calls → Railway or Render (Node) → Railway (PostgreSQL).

---

## 5. Migrations and redeploys

- **Backend:** Start command runs `npx prisma migrate deploy`. On every deploy, Railway or Render runs build then this start command, so migrations run automatically.
- **Redeploy:** Push to `main`; Vercel and your backend (Railway or Render) will auto-deploy if you enabled that when connecting the repo.
- **Env changes:** Update env vars in Vercel or Railway/Render dashboard, then trigger a redeploy (or push a small commit).

---

## 6. Free tier notes

- **Railway:** Backend and database use monthly credits; no cold start. See [Railway pricing](https://railway.app/pricing). Database + backend can use credits quickly; use Render for backend when you need to preserve credits.
- **Render free:** Backend may spin down after inactivity; first request can be slow (cold start). Good fallback when Railway credits run out.
- **Vercel:** Free tier is generous; no sleep.

If you want, we can add a **“keep-alive”** ping (e.g. from a cron or frontend) to reduce Render cold starts.

---

## 7. Switch to Render when Railway credits run out

If your backend is on Railway and you run out of credits, you can switch to Render in a few minutes so the app keeps working:

1. **Create the Render backend** (if you haven't already): follow **Section 1** above to create a Web Service with **Root Directory:** `backend`, same build/start commands and env vars (`DATABASE_URL`, `JWT_SECRET`, etc. — same as Railway).
2. **Trigger a deploy:** Make a tiny change in the repo (e.g. add a comment in `backend/README-DEPLOY.md` or bump a version), push to `main`. Render will deploy (or use **Manual Deploy** in the Render dashboard).
3. **Point the frontend to Render:** In **Vercel** → your project → **Settings** → **Environment Variables**, set `VITE_API_BASE_URL` to your **Render** backend URL + `/api` (e.g. `https://digital-menu-api.onrender.com/api`). Redeploy the frontend (push a small change or use **Redeploy** in Vercel).
4. **Optional:** Pause or delete the Railway backend service to avoid extra usage. Keep the Railway **database** running; both Railway and Render backends can use the same `DATABASE_URL`.

After this, the app runs on **Vercel (frontend) + Render (backend) + Railway (database)** and works continuously.

**To use Railway for the backend again:** In Vercel, set `VITE_API_BASE_URL` back to your Railway backend URL + `/api` (e.g. `https://your-app.up.railway.app/api`), redeploy, and optionally start or redeploy the Railway backend service (Section 1, Option A).
