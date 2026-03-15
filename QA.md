# QA Workflow — Automated Testing & Cursor as QA

This project uses **Cursor as an AI QA engineer** plus **automated tests** that you can run locally and re-run on every code change.

---

## 1. Use Cursor as QA Reviewer

- Select a **folder or file** in the project.
- Press **`Ctrl + K`** (Ask AI) and use prompts like:

```
Act as a senior QA engineer.

Review this project and identify:
- bugs
- security issues
- performance issues
- missing validations
- edge cases

Also suggest automated tests.
```

The project has a **Cursor rule** (`.cursor/rules/qa-engineer.mdc`) so that when you ask for QA review, test cases, or bug hunting, Cursor will act as a senior QA focused on auth, employees, orders, and salary flows.

---

## 2. Automated Tests

### Backend (API) — Vitest + Supertest

- **Location**: `backend/src/__tests__/api/`
- **Run once**:  
  `cd backend && npm run test`
- **Run on every change**:  
  `cd backend && npm run test:watch`  
  Or from repo root:  
  `npm run test:watch:api`

Covers:

- Auth: login validation, invalid credentials, logout.
- Orders: validation (missing/invalid body, mobile, items).

**Note**: Some tests (e.g. successful login) expect a seeded DB. Run `npm run seed` in `backend` if needed.

### Frontend (E2E) — Playwright

- **Location**: `Digital-Menu-GN/e2e/`
- **Run**:  
  `cd Digital-Menu-GN && npm run test:e2e`  
  Or from repo root:  
  `npm run test:e2e`

**Requirement**: Backend must be running on **port 4000** (e.g. `cd backend && npm run dev`). Frontend is started automatically by Playwright unless already running.

Covers:

- Login page load and form.
- Invalid credentials error.
- Admin login and redirect to admin dashboard.

### Run All Tests (API + E2E)

From repo root:

```bash
npm run test
```

This runs `test:api` then `test:e2e`. Ensure backend is up for E2E.

---

## 3. “Full QA Bot” — Run Tests on Every Change

- **API (backend)**  
  In one terminal:  
  `npm run test:watch:api`  
  Vitest will re-run API tests whenever you change backend code.

- **E2E**  
  Playwright does not re-run automatically on file change. Run when you want a full UI check:  
  `npm run test:e2e`

---

## 4. Useful Cursor Prompts for QA

- **Test cases**:  
  “Act as a QA engineer. Generate detailed test cases for this project: functional, API, edge cases, negative testing, user roles, mobile responsiveness.”

- **E2E automation**:  
  “Generate Playwright end-to-end tests for login, add employee, create order, complete order, generate salary slip.”

- **API tests**:  
  “Generate API tests for the Node.js backend: authentication, order creation, employee creation, salary generation.”

- **Full audit**:  
  “Act as a senior QA automation engineer. Analyze the project and simulate end-to-end flows: Admin login → Add employee → Start shift → Complete order → Generate salary → Download salary slip. Identify logic issues and missing validations.”

- **Bug hunt**:  
  “Act as a QA engineer. Search for race conditions, incorrect async handling, missing try/catch, API validation errors, incorrect salary calculations.”

- **UI**:  
  “Review the frontend for UI bugs: responsive issues, overlapping elements, mobile layout, inconsistent spacing, flashing popups.”

- **Production checklist**:  
  “Create a QA checklist for production deployment (API security, role permissions, database validation, performance/load testing).”

---

## 5. Summary

| What              | Command / Action                                      |
|-------------------|--------------------------------------------------------|
| API tests         | `cd backend && npm run test`                          |
| API tests (watch) | `npm run test:watch:api` (from root)                  |
| E2E tests         | `npm run test:e2e` (backend must be on :4000)        |
| All tests         | `npm run test`                                        |
| QA with Cursor    | Select code → `Ctrl+K` → use prompts above + QA rule  |

Result: **Cursor acts as your AI QA** (review, test cases, bug hunting), and **automated API + E2E tests** run on demand or continuously (API via watch mode).
