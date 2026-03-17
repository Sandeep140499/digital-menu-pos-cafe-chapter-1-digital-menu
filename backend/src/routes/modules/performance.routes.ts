import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { perfStore } from "../../middleware/performance.js";
import os from "node:os";
import { promises as fs } from "node:fs";

export const performanceRouter = Router();

// Admin + Employee: API performance dashboard data
performanceRouter.get(
  "/summary",
  authenticate,
  async (req, res) => {
    const role = (req as any).user?.role;
    if (role !== "ADMIN" && role !== "EMPLOYEE") {
      return res.status(403).json({ message: "Forbidden" });
    }
    const windowMinutes = Math.min(
      Math.max(Number(req.query.windowMinutes) || 60, 1),
      24 * 60,
    );
    const actorRaw = typeof req.query.actor === "string" ? req.query.actor : undefined;
    const actor =
      actorRaw === "ADMIN" || actorRaw === "EMPLOYEE" || actorRaw === "CUSTOMER"
        ? actorRaw
        : undefined;
    const top = Math.min(Math.max(Number(req.query.top) || 30, 1), 200);

    const data = perfStore.summarize({
      windowMs: windowMinutes * 60 * 1000,
      actor,
      top,
    });

    const rpm = data.windowMs > 0 ? (data.totalCount / data.windowMs) * 60_000 : 0;
    return res.json({
      now: data.now,
      windowMinutes,
      actor: actor ?? "ALL",
      totalCount: data.totalCount,
      totalErrorCount: data.totalErrorCount,
      totalBytesSent: data.totalBytesSent,
      rpm,
      rows: data.rows.map((r) => ({
        ...r,
        avgMs: Math.round(r.avgMs * 10) / 10,
        p50Ms: Math.round(r.p50Ms * 10) / 10,
        p95Ms: Math.round(r.p95Ms * 10) / 10,
        maxMs: Math.round(r.maxMs * 10) / 10,
      })),
    });
  },
);

// Admin-only: system metrics cards (CPU, disk, network egress estimate)
performanceRouter.get("/system", authenticate, async (req, res) => {
  const role = (req as any).user?.role;
  if (role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });

  const cpuCount = os.cpus()?.length || 1;
  const load1 = os.loadavg?.()[0] ?? 0;
  const cpuUsagePct = Math.min(100, Math.max(0, (load1 / cpuCount) * 100));

  // Disk usage for current filesystem
  let diskTotalBytes = 0;
  let diskFreeBytes = 0;
  try {
    const stat = await fs.statfs(process.cwd());
    diskTotalBytes = Number(stat.bsize) * Number(stat.blocks);
    diskFreeBytes = Number(stat.bsize) * Number(stat.bavail);
  } catch {
    diskTotalBytes = 0;
    diskFreeBytes = 0;
  }
  const diskUsedBytes = Math.max(0, diskTotalBytes - diskFreeBytes);
  const diskUsagePct =
    diskTotalBytes > 0 ? (diskUsedBytes / diskTotalBytes) * 100 : 0;

  // Network egress: last 24h based on perfStore bytesSent
  const snap24h = perfStore.snapshot(24 * 60 * 60 * 1000);
  const networkEgressBytes = snap24h.events.reduce(
    (s, e) => s + ((e as any).bytesSent || 0),
    0,
  );

  return res.json({
    now: Date.now(),
    cpuUsagePct: Math.round(cpuUsagePct * 10) / 10,
    diskUsagePct: Math.round(diskUsagePct * 10) / 10,
    diskTotalBytes,
    diskUsedBytes,
    diskFreeBytes,
    networkEgressBytes,
    window: { hours: 24 },
  });
});

// Admin-only: raw recent events for debugging (last N within window)
performanceRouter.get(
  "/events",
  authenticate,
  async (req, res) => {
    const role = (req as any).user?.role;
    if (role !== "ADMIN") return res.status(403).json({ message: "Forbidden" });
    const windowMinutes = Math.min(
      Math.max(Number(req.query.windowMinutes) || 15, 1),
      24 * 60,
    );
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 2000);
    const snap = perfStore.snapshot(windowMinutes * 60 * 1000);
    const events = snap.events
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .slice(0, limit);
    return res.json({ now: snap.now, windowMinutes, count: events.length, events });
  },
);

