import { Router } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';

export const errorLogRouter = Router();

// Admin: list error logs with optional branch and status filter
errorLogRouter.get('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  try {
    const branchId = req.query.branchId ? Number(req.query.branchId) : undefined;
    const status = (req.query.status as string) || undefined;
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const logs = await prisma.errorLog.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    const unresolvedCount = await prisma.errorLog.count({
      where: { status: 'UNRESOLVED' },
    });
    return res.json({ logs, unresolvedCount });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2021') {
      return res.status(503).json({
        success: false,
        message:
          'Error logs table is missing in the database. Deploy backend migrations (prisma migrate deploy) and retry.',
      });
    }
    throw e;
  }
});

const resolveSchema = z.object({ status: z.enum(['RESOLVED', 'UNRESOLVED']) });

// Admin: mark error as resolved/unresolved
errorLogRouter.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const id = Number(req.params.id);
  const log = await prisma.errorLog.update({
    where: { id },
    data: {
      status: parsed.data.status,
      ...(parsed.data.status === 'RESOLVED' ? { resolvedAt: new Date() } : { resolvedAt: null }),
    },
  });
  return res.json(log);
});
