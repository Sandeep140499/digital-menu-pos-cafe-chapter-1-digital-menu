import type { NextFunction, Request, Response } from "express";
import { httpRequestDurationMs, httpRequestsTotal } from "../services/metrics.js";

type Actor = "ADMIN" | "EMPLOYEE" | "CUSTOMER";

export type PerfEvent = {
  ts: number; // epoch ms
  actor: Actor;
  method: string;
  path: string; // normalized (no query string)
  status: number;
  durationMs: number;
  bytesSent: number;
};

type SummaryRow = {
  key: string; // `${method} ${path}`
  actor: Actor | "ALL";
  count: number;
  errorCount: number;
  avgMs: number;
  p50Ms: number;
  p95Ms: number;
  maxMs: number;
  bytesSentTotal: number;
};

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) return 0;
  const idx = Math.min(sortedAsc.length - 1, Math.max(0, Math.ceil(p * sortedAsc.length) - 1));
  return sortedAsc[idx] ?? 0;
}

function normalizePath(rawPath: string): string {
  // strip querystring if present
  const base = rawPath.split("?")[0] || rawPath;
  // normalize common ID segments so metrics group better
  return base
    .replace(/\/\d+(?=\/|$)/g, "/:id")
    .replace(
      /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi,
      "/:uuid",
    );
}

function getActor(req: Request): Actor {
  const role = (req as any).user?.role;
  if (role === "ADMIN" || role === "EMPLOYEE") return role;
  return "CUSTOMER";
}

export class PerformanceStore {
  private readonly maxEvents: number;
  private events: PerfEvent[] = [];

  constructor(opts?: { maxEvents?: number }) {
    this.maxEvents = Math.max(500, opts?.maxEvents ?? 5000);
  }

  add(e: PerfEvent) {
    this.events.push(e);
    if (this.events.length > this.maxEvents) {
      this.events.splice(0, this.events.length - this.maxEvents);
    }
  }

  snapshot(windowMs: number) {
    const now = Date.now();
    const minTs = now - windowMs;
    const inWindow = this.events.filter((e) => e.ts >= minTs && e.ts <= now);
    return { now, windowMs, events: inWindow };
  }

  summarize(params: { windowMs: number; actor?: Actor; top?: number }): {
    now: number;
    windowMs: number;
    totalCount: number;
    totalErrorCount: number;
    totalBytesSent: number;
    rows: SummaryRow[];
  } {
    const { now, windowMs, events } = this.snapshot(params.windowMs);
    const filtered = params.actor ? events.filter((e) => e.actor === params.actor) : events;

    const byKey = new Map<string, PerfEvent[]>();
    for (const e of filtered) {
      const key = `${e.method} ${e.path}`;
      const arr = byKey.get(key);
      if (arr) arr.push(e);
      else byKey.set(key, [e]);
    }

    const rows: SummaryRow[] = [];
    for (const [key, arr] of byKey.entries()) {
      const durations = arr.map((e) => e.durationMs).sort((a, b) => a - b);
      const count = arr.length;
      const errorCount = arr.filter((e) => e.status >= 500).length;
      const bytesSentTotal = arr.reduce((s, e) => s + (e.bytesSent || 0), 0);
      const sum = durations.reduce((s, v) => s + v, 0);
      const avgMs = count ? sum / count : 0;
      const p50Ms = percentile(durations, 0.5);
      const p95Ms = percentile(durations, 0.95);
      const maxMs = durations[durations.length - 1] ?? 0;
      rows.push({
        key,
        actor: params.actor ?? "ALL",
        count,
        errorCount,
        avgMs,
        p50Ms,
        p95Ms,
        maxMs,
        bytesSentTotal,
      });
    }

    rows.sort((a, b) => {
      // show slow + high traffic first
      const aScore = a.p95Ms * Math.log10(a.count + 1);
      const bScore = b.p95Ms * Math.log10(b.count + 1);
      return bScore - aScore;
    });

    const top = Math.min(Math.max(params.top ?? 30, 1), 200);
    const totalCount = filtered.length;
    const totalErrorCount = filtered.filter((e) => e.status >= 500).length;
    const totalBytesSent = filtered.reduce((s, e) => s + (e.bytesSent || 0), 0);
    return { now, windowMs, totalCount, totalErrorCount, totalBytesSent, rows: rows.slice(0, top) };
  }
}

export const perfStore = new PerformanceStore({
  maxEvents: Number(process.env.PERF_MAX_EVENTS) || 10000,
});

export function performanceMiddleware(req: Request, res: Response, next: NextFunction) {
  // high-resolution duration
  const start = process.hrtime.bigint();
  const ts = Date.now();
  let bytesSent = 0;

  // Track bytes written to response (rough network egress)
  const origWrite = res.write.bind(res) as any;
  const origEnd = res.end.bind(res) as any;
  (res as any).write = (chunk: any, encoding?: any, cb?: any) => {
    try {
      if (chunk) bytesSent += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), encoding);
    } catch {}
    return origWrite(chunk, encoding, cb);
  };
  (res as any).end = (chunk?: any, encoding?: any, cb?: any) => {
    try {
      if (chunk) bytesSent += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(String(chunk), encoding);
    } catch {}
    return origEnd(chunk, encoding, cb);
  };

  res.on("finish", () => {
    // don't self-measure the performance endpoints (avoids feedback loops)
    const original = req.originalUrl || req.url || "";
    if (original.startsWith("/api/performance")) return;

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;
    const path = normalizePath(original.replace(/^\/api/, "") || "/");
    const status = res.statusCode ?? 0;
    const actor = getActor(req);
    perfStore.add({
      ts,
      actor,
      method: (req.method || "GET").toUpperCase(),
      path,
      status,
      durationMs,
      bytesSent,
    });
    try {
      httpRequestsTotal.labels((req.method || "GET").toUpperCase(), path, String(status), actor).inc();
      httpRequestDurationMs.labels((req.method || "GET").toUpperCase(), path, String(status), actor).observe(durationMs);
    } catch {
      // metrics should never break request handling
    }
  });

  next();
}

