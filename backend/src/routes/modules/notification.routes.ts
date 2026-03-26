import { Router } from "express";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";

export const notificationRouter = Router();

/** GET /api/notifications – admin: list notifications (newest first), optional ?unreadOnly=1 */
notificationRouter.get(
  "/",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const unreadOnly = req.query.unreadOnly === "1" || req.query.unreadOnly === "true";
    const limit = Math.min(Number(req.query.limit) || 50, 100);
    const notifications = await prisma.adminNotification.findMany({
      where: unreadOnly ? { isRead: false } : undefined,
      orderBy: { createdAt: "desc" },
      take: limit,
    });
    const unreadCount = await prisma.adminNotification.count({ where: { isRead: false } });
    return res.json({ notifications, unreadCount });
  },
);

/** PATCH /api/notifications/:id/read – admin: mark as read */
notificationRouter.patch(
  "/:id/read",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ message: "Invalid id" });
    await prisma.adminNotification.update({
      where: { id },
      data: { isRead: true },
    });
    return res.json({ ok: true });
  },
);

/** POST /api/notifications/mark-all-read – admin: mark all as read */
notificationRouter.post(
  "/mark-all-read",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    // Persist "clear all" across devices for this admin
    try {
      await prisma.admin.update({
        where: { id: _req.user!.id },
        data: { notificationsClearedAt: new Date() },
      });
    } catch {
      // ignore
    }
    await prisma.adminNotification.updateMany({
      data: { isRead: true },
    });
    return res.json({ ok: true });
  },
);
