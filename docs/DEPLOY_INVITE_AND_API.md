# Deploy: Employee Invite Links & API Performance

## Employee invite links (production)

For **employee invite** and **email verification** to work when the app is deployed:

### Backend

1. Set **`FRONTEND_URL`** in your backend `.env` to your **deployed frontend URL** (no trailing slash).
   - Example: `FRONTEND_URL=https://your-app.vercel.app`
2. Invite emails will then contain links like:  
   `https://your-app.vercel.app/employee/verify-email?token=...`
3. When the employee clicks the link, they open your frontend; the app redirects to the backend to verify, then shows the success page with login link.

### Frontend

1. Set **`VITE_FRONTEND_URL`** in the frontend `.env` (optional) to the same deployed URL if you need it for redirects or links built on the client.
2. Set **`VITE_API_BASE_URL`** to your **deployed backend API base** (e.g. `https://your-api.railway.app/api`) so that:
   - The verify-email page can redirect to the correct backend.
   - All API calls (menu, dashboard, etc.) hit the deployed server.

### Summary

| Env (backend)   | Purpose |
|-----------------|--------|
| `FRONTEND_URL`  | Base URL used in invite and verification emails (must be deployed URL). |

| Env (frontend)       | Purpose |
|----------------------|--------|
| `VITE_API_BASE_URL` | Backend API base for all requests and for verify redirect. |
| `VITE_FRONTEND_URL` | Optional; used by `getFrontendUrl()` for client-side links. |

---

## API slowness (deployed)

If the deployed site feels slow when loading pages or submitting:

1. **Timeouts**  
   The frontend uses `fetchWithTimeout` (25s default) for dashboard and menu loads. If the server doesn’t respond in time, the user sees a “Request timed out” message instead of hanging.

2. **Backend**  
   - Ensure the backend is in the same region as the DB (e.g. Railway in same region as PostgreSQL).
   - Add DB indexes for frequent queries (e.g. orders by date, employee by email).
   - Use connection pooling (e.g. Prisma connection pool) so each request doesn’t open a new DB connection.

3. **Frontend**  
   - Dashboard loads 7 endpoints in parallel (`Promise.all` + `fetchWithTimeout`).
   - Customer menu and employee dashboard also use `fetchWithTimeout` so slow APIs fail fast with a clear message.

4. **Optional**  
   - Put a CDN in front of the frontend.
   - Enable compression (gzip) on the backend if not already.
