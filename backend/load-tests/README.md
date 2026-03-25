# Load tests (k6)

These scripts simulate **50+ concurrent customers** browsing the menu and placing orders.

## Install k6

- Windows: install k6 from official package (recommended)
- Or run via Docker: `grafana/k6`

## Run (local backend)

1. Start backend on `http://localhost:4000`
2. Run one of:

```bash
k6 run load-tests/k6-menu.js
k6 run load-tests/k6-order.js
k6 run load-tests/k6-mixed.js
```

## Target a deployed backend

Set `BASE_URL` (should include `/api`):

```bash
set BASE_URL=https://your-backend-domain/api
k6 run load-tests/k6-mixed.js
```

## Targets (recommended SLOs)

- Menu browsing: **p95 < 800ms**
- Order create: **p95 < 1200ms**

