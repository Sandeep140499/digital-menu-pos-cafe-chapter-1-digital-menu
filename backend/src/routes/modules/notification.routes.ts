import { Router } from 'express';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { OrderNotificationService } from '../../services/orderNotifications.js';
import { logger } from '../../utils/logger.js';

export const notificationRouter = Router();

/** GET /api/notifications – admin: list notifications (newest first), optional ?unreadOnly=1 */
notificationRouter.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const unreadOnly = req.query.unreadOnly === '1' || req.query.unreadOnly === 'true';
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const notifications = await prisma.adminNotification.findMany({
    where: unreadOnly ? { isRead: false } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  const unreadCount = await prisma.adminNotification.count({ where: { isRead: false } });
  return res.json({ notifications, unreadCount });
});

/** POST /api/notifications/test – test notification system */
notificationRouter.post('/test', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const { branchId, employeeId, type } = req.body;

    if (!branchId) {
      return res.status(400).json({ message: 'Branch ID is required' });
    }

    const notificationService = new OrderNotificationService(req.app.locals.io);

    if (type === 'order') {
      // Test order notification
      await notificationService.sendNewOrderNotification({
        orderId: 999999, // Test ID
        branchId,
        tableNumber: '1',
        customerName: 'Test Customer',
        orderType: 'DINE_IN',
        orderSource: 'CUSTOMER',
        priority: 'HIGH',
        totalAmount: 299.99,
        items: [
          { name: 'Test Item 1', quantity: 2 },
          { name: 'Test Item 2', quantity: 1 },
        ],
      });
    } else {
      // Test general notification
      await notificationService.testNotification(branchId, employeeId);
    }

    logger.info('Test notification sent', { branchId, employeeId, type });

    return res.json({
      success: true,
      message: 'Test notification sent successfully',
      branchId,
      employeeId,
      type,
    });
  } catch (error) {
    logger.error('Failed to send test notification', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return res.status(500).json({ message: 'Failed to send test notification' });
  }
});

/** PATCH /api/notifications/:id/read – admin: mark as read */
notificationRouter.patch('/:id/read', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ message: 'Invalid id' });
  await prisma.adminNotification.update({
    where: { id },
    data: { isRead: true },
  });
  return res.json({ ok: true });
});

/** POST /api/notifications/mark-all-read – admin: mark all as read */
notificationRouter.post('/mark-all-read', authenticate, requireRole('ADMIN'), async (_req, res) => {
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
});
