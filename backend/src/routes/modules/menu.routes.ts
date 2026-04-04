import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { incrementPublicMenuViews } from '../../services/publicTraffic.js';

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

const upsertCategorySchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  slug: z.string().min(1).optional(),
});

const optionalUrl = z.preprocess(v => {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? undefined : t;
  }
  return v;
}, z.string().url().optional());

const upsertMenuItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.preprocess(v => (typeof v === 'string' && v.trim() === '' ? undefined : v), z.string().optional()),
    imageUrl: optionalUrl,
    basePrice: z.number().positive(),
    hasHalf: z.boolean().optional(),
    // UI may send 0 when "half" is not enabled; allow it and validate conditionally below.
    halfPrice: z.number().nonnegative().optional(),
    isActive: z.boolean().optional(),
    categoryId: z.number().int().optional(),
    notifyCustomers: z.boolean().optional(), // when true, prepare broadcast for new launch
  })
  .superRefine((data, ctx) => {
    if (data.hasHalf) {
      if (!data.halfPrice || data.halfPrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['halfPrice'],
          message: 'Half price is required and must be > 0 when half is enabled',
        });
      }
    }
  });

export const menuRouter = Router();

type PublicMenuResponse = { categories: any[]; bestSellerItemIds: number[] };

// Simple in-memory cache to protect DB under high traffic.
// - categories change rarely; best-sellers can lag a little.
// - If DB temporarily fails, we serve last known good menu instead of crashing customer UX.
let publicMenuCache: { data: PublicMenuResponse; ts: number; bestTs: number } | null = null;
const MENU_CACHE_MS = 15_000;
const BEST_SELLER_CACHE_MS = 5 * 60_000;

// Rolling 7 days for best-seller ranking (weekly demand)
function getRolling7DayRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// Public: get menu for QR customer (only active items) + bestSellerItemIds (top 5 by last-7-days demand)
menuRouter.get('/', async (_req, res) => {
  incrementPublicMenuViews();
  const now = Date.now();
  if (publicMenuCache && now - publicMenuCache.ts < MENU_CACHE_MS) {
    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    const d = publicMenuCache.data;
    return res.json({
      ...d,
      bestSellerItemIds: [...new Set(d.bestSellerItemIds ?? [])].slice(0, 5),
    });
  }
  try {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        createdAt: true,
        items: {
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
          select: {
            id: true,
            name: true,
            description: true,
            imageUrl: true,
            basePrice: true,
            hasHalf: true,
            halfPrice: true,
            isActive: true,
            categoryId: true,
            createdAt: true,
          },
        },
      },
    });

    let bestSellerItemIds: number[] = publicMenuCache?.data.bestSellerItemIds ?? [];
    const bestStale = !publicMenuCache || now - publicMenuCache.bestTs > BEST_SELLER_CACHE_MS;
    if (bestStale) {
      const { start, end } = getRolling7DayRange();
      const lastWeekOrderItems = await prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          menuItemId: { not: null },
          order: {
            createdAt: { gte: start, lte: end },
          },
        },
        _sum: { quantity: true },
      });
      const sorted = lastWeekOrderItems
        .filter(r => r.menuItemId != null)
        .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
        .slice(0, 5);
      bestSellerItemIds = sorted.map(r => r.menuItemId as number);

      // If there isn't enough order history in the window, fill remaining slots
      // with active items so UI still has a consistent "top 5" section.
      if (bestSellerItemIds.length < 5) {
        const fillers = await prisma.menuItem.findMany({
          where: { isActive: true, id: { notIn: bestSellerItemIds } },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
          take: 5 - bestSellerItemIds.length,
        });
        bestSellerItemIds = bestSellerItemIds.concat(fillers.map(f => f.id));
      }
    }

    // At most 5 unique IDs for the customer "Best Sellers" row (fresh or cached).
    bestSellerItemIds = [...new Set(bestSellerItemIds)].slice(0, 5);

    const data: PublicMenuResponse = { categories, bestSellerItemIds };
    publicMenuCache = {
      data,
      ts: now,
      bestTs: bestStale ? now : (publicMenuCache?.bestTs ?? now),
    };
    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    return res.json(data);
  } catch (err) {
    const e = err as any;
    const msg = String(e?.message || '');
    const isDbDown =
      msg.includes("Can't reach database server") ||
      e?.code === 'P1001' ||
      e?.name === 'PrismaClientInitializationError';
    console.error('Menu API error:', err);
    // Serve last known good menu to avoid customer-facing crash.
    if (publicMenuCache?.data) {
      res.setHeader('X-Menu-Cache', 'stale');
      res.setHeader('Cache-Control', 'public, max-age=2, stale-while-revalidate=30');
      return res.json(publicMenuCache.data);
    }
    return res.status(isDbDown ? 503 : 500).json({
      message: isDbDown
        ? 'Menu is temporarily unavailable (database offline). Please try again in a moment.'
        : 'Failed to load menu',
      categories: [],
      bestSellerItemIds: [],
    });
  }
});

// Admin: get full menu with all items (for live/pending counts)
menuRouter.get('/admin', authenticate, requireRole('ADMIN'), async (_req, res) => {
  const categories = await prisma.menuCategory.findMany({
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      name: true,
      slug: true,
      imageUrl: true,
      createdAt: true,
      items: {
        orderBy: { createdAt: 'asc' },
        select: {
          id: true,
          name: true,
          description: true,
          imageUrl: true,
          basePrice: true,
          hasHalf: true,
          halfPrice: true,
          isActive: true,
          categoryId: true,
          createdAt: true,
        },
      },
    },
  });
  return res.json(categories);
});

// Admin: create category
menuRouter.post('/categories', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = upsertCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const slug = parsed.data.slug?.trim() || createSlug(parsed.data.name);
  const category = await prisma.menuCategory.create({
    data: {
      name: parsed.data.name,
      slug,
      imageUrl: parsed.data.imageUrl ?? undefined,
    },
  });

  return res.status(201).json(category);
});

// Admin: update category (PATCH or PUT)
async function updateCategory(req: import('express').Request, res: import('express').Response) {
  const parsed = upsertCategorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const id = Number(req.params.id);
  const data: { name?: string; imageUrl?: string | null; slug?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.imageUrl !== undefined)
    data.imageUrl = parsed.data.imageUrl === '' ? null : parsed.data.imageUrl;
  if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
  if (parsed.data.name !== undefined && parsed.data.slug === undefined)
    data.slug = createSlug(parsed.data.name);

  const category = await prisma.menuCategory.update({
    where: { id },
    data,
  });

  return res.json(category);
}

menuRouter.patch('/categories/:id', authenticate, requireRole('ADMIN'), updateCategory);

menuRouter.put('/categories/:id', authenticate, requireRole('ADMIN'), updateCategory);

// Admin: delete category
menuRouter.delete('/categories/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.menuCategory.delete({ where: { id } });
  return res.status(204).send();
});

// Admin: create menu item (optional notifyCustomers → prepare broadcast for new launch)
menuRouter.post('/items', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = upsertMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const { notifyCustomers, ...itemData } = parsed.data;

  const item = await prisma.menuItem.create({
    data: {
      ...itemData,
      hasHalf: itemData.hasHalf ?? false,
      halfPrice: (itemData.hasHalf ?? false) ? (itemData.halfPrice ?? null) : null,
      imageUrl: itemData.imageUrl ?? undefined,
      isActive: itemData.isActive ?? true,
    },
  });

  let broadcast: { message: string; mobileCount: number; mobiles: string[] } | undefined;
  if (notifyCustomers) {
    const { buildNewItemBroadcast } = await import('../../services/whatsapp.js');
    const branch = await prisma.branch.findFirst({
      select: { name: true, location: true, phone: true, googleReviewUrl: true },
    });
    const message = buildNewItemBroadcast({
      itemNames: [item.name],
      itemDetails: item.description ?? undefined,
      branch: branch || undefined,
    });
    // IMPORTANT: do not load all orders into memory.
    // We only need distinct mobiles for broadcast.
    const orders = await prisma.order.findMany({
      where: { customerMobile: { not: null } },
      orderBy: { createdAt: 'desc' },
      distinct: ['customerMobile'],
      select: { customerMobile: true },
      take: 100_000, // safety cap; distinct keeps this far smaller in practice
    });
    const seen = new Set<string>();
    const mobiles: string[] = [];
    for (const o of orders) {
      const m = o.customerMobile!.replace(/\D/g, '').slice(-10);
      if (m.length === 10 && !seen.has(m)) {
        seen.add(m);
        mobiles.push(m);
      }
    }
    broadcast = { message, mobileCount: mobiles.length, mobiles };
  }

  return res.status(201).json({ item, ...(broadcast ? { broadcast } : {}) });
});

// Admin: update menu item
menuRouter.patch('/items/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = upsertMenuItemSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const id = Number(req.params.id);
  const data: Record<string, unknown> = { ...parsed.data };
  // Normalize optional URL / blank strings.
  if (data.imageUrl === '') data.imageUrl = undefined;
  if (data.description === '') data.description = undefined;

  // Normalize half-price rules:
  // - if hasHalf is explicitly false -> clear halfPrice
  // - if halfPrice is provided (>0) but hasHalf is missing -> auto-enable hasHalf
  if (data.hasHalf === false) data.halfPrice = null;
  if (typeof data.halfPrice === 'number' && data.halfPrice > 0 && data.hasHalf === undefined) data.hasHalf = true;

  const item = await prisma.menuItem.update({
    where: { id },
    data,
  });

  return res.json(item);
});

// Admin: delete (soft) menu item
menuRouter.delete('/items/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.menuItem.update({
    where: { id },
    data: { isActive: false },
  });

  return res.json(item);
});
