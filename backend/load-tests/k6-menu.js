import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 50,
  duration: "60s",
  thresholds: {
    http_req_failed: ["rate<0.01"],
    http_req_duration: ["p(95)<800"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:4000/api";

export default function () {
  const res = http.get(`${BASE_URL}/menu`, { tags: { name: "GET /menu" } });
  check(res, { "menu status 200": (r) => r.status === 200 || r.status === 304 });
  sleep(0.3);
}

