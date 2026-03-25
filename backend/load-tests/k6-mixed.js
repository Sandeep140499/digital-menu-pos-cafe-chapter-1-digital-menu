import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "90s",
  thresholds: {
    http_req_failed: ["rate<0.02"],
    http_req_duration: ["p(95)<1200"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000/api";
const BRANCH_ID = Number(__ENV.BRANCH_ID || "1");

function randomTable() {
  return String(Math.floor(Math.random() * 40) + 1);
}

export default function () {
  const r1 = http.get(`${BASE_URL}/menu`, { tags: { name: "GET /menu" } });
  check(r1, { "menu ok": (r) => r.status === 200 || r.status === 304 || r.status === 503 });

  // 20% of users place an order
  if (Math.random() < 0.2) {
    const payload = {
      orderType: "DINE_IN",
      tableNumber: randomTable(),
      branchId: BRANCH_ID,
      sessionToken: `k6-${__VU}-${__ITER}`,
      packaging: false,
      customerName: "K6 CUSTOMER",
      customerMobile: null,
      items: [{ name: "Test Item", unitPrice: 10, quantity: 1, variant: "FULL" }],
    };
    const r2 = http.post(`${BASE_URL}/orders`, JSON.stringify(payload), {
      headers: { "Content-Type": "application/json" },
      tags: { name: "POST /orders" },
    });
    check(r2, { "order ok": (r) => r.status === 201 || r.status === 503 });
  }

  sleep(0.4);
}

