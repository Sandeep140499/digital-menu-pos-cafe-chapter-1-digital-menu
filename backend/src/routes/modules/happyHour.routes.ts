import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { invalidatePublicMenuCache } from './menu.routes.js';
import { buildHappyHourWaBroadcast } from '../../services/happyHourBroadcast.js';
import { getDefaultPublicBranchId } from '../../utils/defaultPublicBranch.js';

export const happyHourRouter = Router();

const ymdRe = /^\d{4}-\d{2}-\d{2}$/;

const createHappyHourSchema = z
  .object({
    name: z.string().min(1).max(200),
    discountPercent: z.number().min(0).max(100),
    dateStart: z.string().regex(ymdRe),
    dateEnd: z.string().regex(ymdRe),
    timeStart: z.string().min(4).max(8),
    timeEnd: z.string().min(4).max(8),
    daysOfWeek: z.array(z.number().int().min(0).max(6)).optional().nullable(),
    status: z.enum(['ACTIVE', 'INACTIVE']).optional().default('ACTIVE'),
    applyMode: z.enum(['ALL_ITEMS', 'CATEGORIES', 'ITEMS']),
    categoryIds: z.array(z.number().int().positive()).optional().default([]),
    itemIds: z.array(z.number().int().positive()).optional().default([]),
    excludedItemIds: z.array(z.number().int().positive()).optional().default([]),
    notificationPref: z.enum(['NONE', 'SEND_ON_CREATE', 'SEND_MANUAL']).default('NONE'),
    notifyAudience: z.enum(['ALL_CUSTOMERS', 'LEADERS', 'SELECTED']).optional().nullable(),
    selectedMobiles: z.array(z.string()).optional().default([]),
    leadersLimit: z.number().int().min(1).max(50_000).optional().default(200),
  })
  .superRefine((data, ctx) => {
    if (data.dateEnd < data.dateStart) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['dateEnd'],
        message: 'End date must be on or after start date',
      });
    }
    if (data.applyMode === 'CATEGORIES' && (!data.categoryIds || data.categoryIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['categoryIds'],
        message: 'Select at least one category',
      });
    }
    if (data.applyMode === 'ITEMS' && (!data.itemIds || data.itemIds.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['itemIds'],
        message: 'Select at least one item',
      });
    }
    if (data.notificationPref !== 'NONE') {
      if (!data.notifyAudience) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['notifyAudience'],
          message: 'Choose who should receive the WhatsApp message',
        });
      }
      if (data.notifyAudience === 'SELECTED' && (!data.selectedMobiles || data.selectedMobiles.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['selectedMobiles'],
          message: 'Add at least one mobile number',
        });
      }
    }
  });

function parseYmdToDateUtc(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12, 0, 0, 0));
}

happyHourRouter.get('/', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const rows = await prisma.happyHour.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      categoryLinks: true,
      itemLinks: true,
      excludedItemLinks: true,
    },
  });
  return res.json({ happyHours: rows });
});

happyHourRouter.post('/', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = createHappyHourSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const d = parsed.data;
  const daysJson =
    d.daysOfWeek && d.daysOfWeek.length > 0 ? (d.daysOfWeek as unknown as object) : undefined;

  let notificationStatus: 'NOT_APPLICABLE' | 'PENDING' | 'SENT' | 'FAILED' = 'NOT_APPLICABLE';
  let sentAt: Date | null = null;
  if (d.notificationPref === 'NONE') {
    notificationStatus = 'NOT_APPLICABLE';
  } else if (d.notificationPref === 'SEND_MANUAL') {
    notificationStatus = 'PENDING';
  } else {
    notificationStatus = 'NOT_APPLICABLE';
  }

  const created = await prisma.happyHour.create({
    data: {
      name: d.name.trim(),
      discountPercent: d.discountPercent,
      dateStart: parseYmdToDateUtc(d.dateStart),
      dateEnd: parseYmdToDateUtc(d.dateEnd),
      timeStart: d.timeStart.trim(),
      timeEnd: d.timeEnd.trim(),
      daysOfWeek: daysJson,
      status: d.status,
      applyMode: d.applyMode,
      notificationPref: d.notificationPref,
      notificationStatus,
      notifyAudience: d.notificationPref === 'NONE' ? null : d.notifyAudience,
      selectedMobiles:
        d.notifyAudience === 'SELECTED' && d.selectedMobiles?.length
          ? (d.selectedMobiles as unknown as object)
          : undefined,
      categoryLinks: {
        create: (d.categoryIds || []).map(categoryId => ({ categoryId })),
      },
      itemLinks: {
        create: (d.itemIds || []).map(menuItemId => ({ menuItemId })),
      },
      excludedItemLinks: {
        create: (d.excludedItemIds || []).map(menuItemId => ({ menuItemId })),
      },
    },
    include: {
      categoryLinks: true,
      itemLinks: true,
      excludedItemLinks: true,
    },
  });

  invalidatePublicMenuCache();

  let broadcast: Awaited<ReturnType<typeof buildHappyHourWaBroadcast>> | undefined;
  if (d.notificationPref === 'SEND_ON_CREATE' && d.notifyAudience) {
    try {
      const defaultId = await getDefaultPublicBranchId();
      const branch = defaultId
        ? await prisma.branch.findUnique({
            where: { id: defaultId },
            select: { name: true, location: true, phone: true, googleReviewUrl: true },
          })
        : null;
      broadcast = await buildHappyHourWaBroadcast({
        discountPercent: d.discountPercent,
        timeStart: d.timeStart.trim(),
        timeEnd: d.timeEnd.trim(),
        audience: d.notifyAudience,
        selectedMobiles: d.notifyAudience === 'SELECTED' ? d.selectedMobiles : undefined,
        leadersLimit: d.leadersLimit,
        branch: branch || undefined,
      });
      sentAt = new Date();
      await prisma.happyHour.update({
        where: { id: created.id },
        data: {
          notificationStatus: 'SENT',
          sentAt,
        },
      });
    } catch (e) {
      console.error('Happy hour WhatsApp broadcast failed:', e);
      await prisma.happyHour.update({
        where: { id: created.id },
        data: { notificationStatus: 'FAILED' },
      });
    }
  }

  const fresh = await prisma.happyHour.findUnique({
    where: { id: created.id },
    include: { categoryLinks: true, itemLinks: true, excludedItemLinks: true },
  });

  return res.status(201).json({
    happyHour: fresh,
    ...(broadcast ? { broadcast } : {}),
  });
});

const patchHappyHourSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
});

happyHourRouter.patch('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Invalid id' });
  const parsed = patchHappyHourSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }
  const row = await prisma.happyHour.update({
    where: { id },
    data: parsed.data,
    include: { categoryLinks: true, itemLinks: true, excludedItemLinks: true },
  });
  invalidatePublicMenuCache();
  return res.json({ happyHour: row });
});

happyHourRouter.delete('/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Invalid id' });
  await prisma.happyHour.delete({ where: { id } });
  invalidatePublicMenuCache();
  return res.status(204).send();
});

const sendNotificationSchema = z.object({
  leadersLimit: z.number().int().min(1).max(50_000).optional().default(200),
});

/** Send (prepare) WhatsApp broadcast for offers created with SEND_MANUAL while PENDING. */
happyHourRouter.post('/:id/send-notification', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) return res.status(400).json({ message: 'Invalid id' });
  const parsed = sendNotificationSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const hh = await prisma.happyHour.findUnique({
    where: { id },
    include: { categoryLinks: true, itemLinks: true, excludedItemLinks: true },
  });
  if (!hh) return res.status(404).json({ message: 'Offer not found' });
  if (hh.notificationPref !== 'SEND_MANUAL') {
    return res.status(400).json({ message: 'This offer is not set for manual WhatsApp send.' });
  }
  if (hh.notificationStatus === 'SENT') {
    return res.status(400).json({ message: 'Notifications were already marked as sent for this offer.' });
  }
  if (!hh.notifyAudience) {
    return res.status(400).json({ message: 'Missing audience on this offer; recreate the offer with an audience.' });
  }

  try {
    const defaultId = await getDefaultPublicBranchId();
    const branch = defaultId
      ? await prisma.branch.findUnique({
          where: { id: defaultId },
          select: { name: true, location: true, phone: true, googleReviewUrl: true },
        })
      : null;
    const selected =
      hh.notifyAudience === 'SELECTED' && Array.isArray(hh.selectedMobiles)
        ? (hh.selectedMobiles as string[])
        : undefined;
    const broadcast = await buildHappyHourWaBroadcast({
      discountPercent: Number(hh.discountPercent),
      timeStart: hh.timeStart,
      timeEnd: hh.timeEnd,
      audience: hh.notifyAudience,
      selectedMobiles: selected,
      leadersLimit: parsed.data.leadersLimit,
      branch: branch || undefined,
    });
    await prisma.happyHour.update({
      where: { id },
      data: { notificationStatus: 'SENT', sentAt: new Date() },
    });
    return res.json({ ok: true, broadcast });
  } catch (e) {
    console.error('Happy hour manual send failed:', e);
    await prisma.happyHour.update({
      where: { id },
      data: { notificationStatus: 'FAILED' },
    });
    return res.status(500).json({ message: 'Failed to prepare WhatsApp broadcast' });
  }
});
