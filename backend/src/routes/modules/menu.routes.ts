import { Router } from 'express';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '../../config/prisma.js';
import { authenticate, requireRole } from '../../middleware/auth.js';
import { incrementPublicMenuViews } from '../../services/publicTraffic.js';
import { dedupePublicMenuCategories } from '../../utils/publicMenuDedupe.js';
import {
  applyPercentDiscount,
  bestActiveDiscountForItem,
  buildHappyHourBanner,
} from '../../services/happyHourEngine.js';
import { loadActiveHappyHourRules } from '../../services/happyHourRulesLoader.js';
import { getDefaultPublicBranchId } from '../../utils/defaultPublicBranch.js';

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

async function ensureUniqueCategorySlug(args: {
  branchId: number;
  desiredSlug: string;
  selfCategoryId?: number;
}): Promise<string> {
  const base = (args.desiredSlug || '').trim().toLowerCase();
  const normalized = base
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-+|-+$)/g, '');

  const root = normalized || `category-${args.selfCategoryId ?? Date.now()}`;

  const existing = await prisma.menuCategory.findFirst({
    where: {
      branchId: args.branchId,
      slug: root,
      ...(args.selfCategoryId ? { id: { not: args.selfCategoryId } } : {}),
    },
    select: { id: true },
  });
  if (!existing) return root;

  // Try slug-2, slug-3, ... then fall back to slug-<id>.
  for (let i = 2; i <= 50; i += 1) {
    const candidate = `${root}-${i}`;
    const hit = await prisma.menuCategory.findFirst({
      where: {
        branchId: args.branchId,
        slug: candidate,
        ...(args.selfCategoryId ? { id: { not: args.selfCategoryId } } : {}),
      },
      select: { id: true },
    });
    if (!hit) return candidate;
  }

  if (args.selfCategoryId) return `${root}-${args.selfCategoryId}`;
  return `${root}-${Date.now()}`;
}

const NEW_LAUNCH_DAYS = 7;

function highlightUntilFromNow(): Date {
  const d = new Date();
  d.setDate(d.getDate() + NEW_LAUNCH_DAYS);
  return d;
}

const upsertCategorySchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  slug: z.string().min(1).optional(),
  /** When true, sets highlight for 7 days from save; when false, clears highlight. Omit to leave unchanged (PATCH only). */
  highlightAsNewLaunch: z.boolean().optional(),
  /** When false, category is hidden from the public customer menu (admin only). */
  showOnMenu: z.boolean().optional(),
});

const createMenuCategorySchema = upsertCategorySchema.extend({
  branchId: z.number().int().positive(),
});

// Accept empty, or any reasonable-length string (avoids hard failures on partial/relative URLs).
const optionalUrl = z.preprocess(v => {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length === 0 ? undefined : t;
  }
  return v;
}, z.string().max(2048).optional());

const upsertMenuItemSchema = z
  .object({
    name: z.string().min(1),
    description: z.preprocess(
      v => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().optional()
    ),
    imageUrl: optionalUrl,
    basePrice: z.number().positive(),
    hasHalf: z.boolean().optional(),
    // UI may send 0 when "half" is not enabled; allow it and validate conditionally below.
    halfPrice: z.number().nonnegative().optional(),
    isActive: z.boolean().optional(),
    categoryId: z.number().int().optional(),
    notifyCustomers: z.boolean().optional(), // when true, prepare broadcast for new launch
    highlightAsNewLaunch: z.boolean().optional(),
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

/** PATCH body: all fields optional; coerces numeric strings from JSON/clients. */
const patchMenuItemSchema = z
  .object({
    name: z.preprocess(v => (typeof v === 'string' ? v.trim() : v), z.string().min(1).optional()),
    description: z.preprocess(
      v =>
        v === null || v === undefined
          ? undefined
          : typeof v === 'string' && v.trim() === ''
            ? null
            : v,
      z.union([z.string(), z.null()]).optional()
    ),
    imageUrl: optionalUrl,
    basePrice: z.coerce.number().positive().optional(),
    hasHalf: z.boolean().optional(),
    halfPrice: z.preprocess(
      v =>
        v === null || v === undefined || v === ''
          ? undefined
          : typeof v === 'string' && v.trim() === ''
            ? undefined
            : v,
      z.coerce.number().nonnegative().optional()
    ),
    isActive: z.boolean().optional(),
    categoryId: z.preprocess(
      v =>
        v === null || v === '' || v === undefined
          ? undefined
          : typeof v === 'string' && v.trim() === ''
            ? undefined
            : v,
      z.union([z.coerce.number().int().positive(), z.null()]).optional()
    ),
    notifyCustomers: z.boolean().optional(),
    highlightAsNewLaunch: z.boolean().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.hasHalf === true) {
      const hp = data.halfPrice;
      if (hp == null || hp <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['halfPrice'],
          message: 'Half price is required and must be > 0 when half is enabled',
        });
      }
    }
  });

export const menuRouter = Router();

type PublicMenuResponse = {
  categories: any[];
  bestSellerItemIds: number[];
  happyHourBanner?: unknown;
};

// Simple in-memory cache to protect DB under high traffic (one entry per branch).
// - categories change rarely; best-sellers can lag a little.
// - If DB temporarily fails, we serve last known good menu instead of crashing customer UX.
const publicMenuCacheByBranch = new Map<
  number,
  { data: PublicMenuResponse; ts: number; bestTs: number }
>();
const MENU_CACHE_MS = 15_000;
const BEST_SELLER_CACHE_MS = 5 * 60_000;

export function invalidatePublicMenuCache() {
  publicMenuCacheByBranch.clear();
}

type MenuBranchResolve =
  | { type: 'branch'; branchId: number }
  | { type: 'error'; status: 400 | 404; message: string }
  | { type: 'empty' };

/** Public + admin: `?branchId=` / `?branch=` or default lowest-id branch. */
async function resolveMenuBranchIdFromRequest(
  query: Record<string, unknown>
): Promise<MenuBranchResolve> {
  const raw = query.branchId ?? query.branch;
  if (raw !== undefined && raw !== '') {
    const n = Number.parseInt(String(raw), 10);
    if (!Number.isFinite(n) || n < 1) {
      return { type: 'error', status: 400, message: 'Invalid branchId' };
    }
    const b = await prisma.branch.findUnique({ where: { id: n }, select: { id: true } });
    if (!b) {
      return { type: 'error', status: 404, message: 'Branch not found' };
    }
    return { type: 'branch', branchId: n };
  }
  const id = await getDefaultPublicBranchId();
  if (id == null) return { type: 'empty' };
  return { type: 'branch', branchId: id };
}

// Rolling 7 days for best-seller ranking (weekly demand)
function getRolling7DayRange(): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

// Public: get menu for QR customer (only active items) + bestSellerItemIds (top 5 by last-7-days demand)
menuRouter.get('/', async (req, res) => {
  incrementPublicMenuViews();
  const requestTs = Date.now();

  const resolved = await resolveMenuBranchIdFromRequest(req.query as Record<string, unknown>);
  if (resolved.type === 'error') {
    return res.status(resolved.status).json({
      message: resolved.message,
      categories: [],
      bestSellerItemIds: [],
    });
  }
  if (resolved.type === 'empty') {
    const { rules, tz } = await loadActiveHappyHourRules();
    const hhNow = new Date();
    const happyHourBanner = buildHappyHourBanner(rules, hhNow, tz);
    return res.json({ categories: [], bestSellerItemIds: [], happyHourBanner });
  }
  const menuBranchId = resolved.branchId;

  const branchCache = publicMenuCacheByBranch.get(menuBranchId) ?? null;
  if (
    branchCache &&
    requestTs - branchCache.ts < MENU_CACHE_MS &&
    branchCache.data &&
    (branchCache.data as { happyHourBanner?: unknown }).happyHourBanner !== undefined
  ) {
    res.setHeader('Cache-Control', 'public, max-age=5, stale-while-revalidate=30');
    const d = branchCache.data;
    return res.json({
      ...d,
      bestSellerItemIds: [...new Set(d.bestSellerItemIds ?? [])].slice(0, 5),
    });
  }
  try {
    const categoriesRaw = await prisma.menuCategory.findMany({
      where: { branchId: menuBranchId, showOnMenu: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        createdAt: true,
        highlightNewUntil: true,
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
            highlightNewUntil: true,
          },
        },
      },
    });

    const nowDate = new Date();
    const categories = dedupePublicMenuCategories(
      categoriesRaw
        .map(cat => {
          const catNew = cat.highlightNewUntil != null && new Date(cat.highlightNewUntil) > nowDate;
          const itemNew = cat.items.some(
            it => it.highlightNewUntil != null && new Date(it.highlightNewUntil) > nowDate
          );
          const isNewLaunch = catNew || itemNew;
          return {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            imageUrl: cat.imageUrl,
            createdAt: cat.createdAt,
            isNewLaunch,
            items: cat.items.map(it => {
              const itemLaunch =
                it.highlightNewUntil != null && new Date(it.highlightNewUntil) > nowDate;
              const { highlightNewUntil: _omit, ...rest } = it;
              return { ...rest, isNewLaunch: itemLaunch };
            }),
          };
        })
        // Customer menu: omit categories with no active items (avoids empty "Rice" / ghost sections).
        .filter(cat => Array.isArray(cat.items) && cat.items.length > 0)
    );

    const { rules, tz } = await loadActiveHappyHourRules();
    const hhNow = new Date();
    const happyHourBanner = buildHappyHourBanner(rules, hhNow, tz);

    const categoriesWithHappyHour = categories.map(cat => ({
      ...cat,
      items: cat.items.map((it: any) => {
        const disc = bestActiveDiscountForItem(rules, hhNow, tz, it.id, it.categoryId);
        if (!disc) return { ...it, happyHour: null };
        const originalFull = Number(it.basePrice);
        const discountedFull = applyPercentDiscount(originalFull, disc.discountPercent);
        const hh: Record<string, unknown> = {
          discountPercent: disc.discountPercent,
          offerName: disc.offerName,
          offerId: disc.offerId,
          originalFullPrice: originalFull,
          discountedFullPrice: discountedFull,
        };
        if (it.hasHalf && it.halfPrice != null) {
          const hp = Number(it.halfPrice);
          hh.originalHalfPrice = hp;
          hh.discountedHalfPrice = applyPercentDiscount(hp, disc.discountPercent);
        }
        return { ...it, happyHour: hh };
      }),
    }));

    let bestSellerItemIds: number[] = branchCache?.data.bestSellerItemIds ?? [];
    const bestStale = !branchCache || requestTs - branchCache.bestTs > BEST_SELLER_CACHE_MS;
    if (bestStale) {
      const { start, end } = getRolling7DayRange();
      const lastWeekOrderItems = await prisma.orderItem.groupBy({
        by: ['menuItemId'],
        where: {
          menuItemId: { not: null },
          order: {
            branchId: menuBranchId,
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
          where: {
            isActive: true,
            id: { notIn: bestSellerItemIds },
            category: { branchId: menuBranchId },
          },
          orderBy: { createdAt: 'desc' },
          select: { id: true },
          take: 5 - bestSellerItemIds.length,
        });
        bestSellerItemIds = bestSellerItemIds.concat(fillers.map(f => f.id));
      }
    }

    // At most 5 unique IDs for the customer "Best Sellers" row (fresh or cached).
    bestSellerItemIds = [...new Set(bestSellerItemIds)].slice(0, 5);

    const data: PublicMenuResponse = {
      categories: categoriesWithHappyHour,
      bestSellerItemIds,
      happyHourBanner,
    };
    const prev = publicMenuCacheByBranch.get(menuBranchId);
    publicMenuCacheByBranch.set(menuBranchId, {
      data,
      ts: requestTs,
      bestTs: bestStale ? requestTs : (prev?.bestTs ?? requestTs),
    });
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
    const staleEntry = publicMenuCacheByBranch.get(menuBranchId);
    if (staleEntry?.data) {
      res.setHeader('X-Menu-Cache', 'stale');
      res.setHeader('Cache-Control', 'public, max-age=2, stale-while-revalidate=30');
      return res.json(staleEntry.data);
    }
    for (const v of publicMenuCacheByBranch.values()) {
      if (v?.data) {
        res.setHeader('X-Menu-Cache', 'stale');
        res.setHeader('Cache-Control', 'public, max-age=2, stale-while-revalidate=30');
        return res.json(v.data);
      }
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
menuRouter.get('/admin', authenticate, requireRole('ADMIN'), async (req, res) => {
  const resolved = await resolveMenuBranchIdFromRequest(req.query as Record<string, unknown>);
  if (resolved.type === 'error') {
    return res.status(resolved.status).json({ message: resolved.message });
  }
  if (resolved.type === 'empty') {
    return res.json([]);
  }
  const menuBranchId = resolved.branchId;

  const categories = await prisma.menuCategory.findMany({
    where: { branchId: menuBranchId },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      branchId: true,
      name: true,
      slug: true,
      imageUrl: true,
      createdAt: true,
      highlightNewUntil: true,
      showOnMenu: true,
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
          highlightNewUntil: true,
        },
      },
    },
  });
  return res.json(categories);
});

// Admin: create category
menuRouter.post('/categories', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = createMenuCategorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const branchOk = await prisma.branch.findUnique({
    where: { id: parsed.data.branchId },
    select: { id: true },
  });
  if (!branchOk) {
    return res.status(400).json({ message: 'Invalid branchId' });
  }

  const desiredSlug = parsed.data.slug?.trim() || createSlug(parsed.data.name);
  const slug = await ensureUniqueCategorySlug({
    branchId: parsed.data.branchId,
    desiredSlug,
  });
  try {
    const category = await prisma.menuCategory.create({
      data: {
        branchId: parsed.data.branchId,
        name: parsed.data.name,
        slug,
        imageUrl: parsed.data.imageUrl ?? undefined,
        highlightNewUntil: parsed.data.highlightAsNewLaunch ? highlightUntilFromNow() : null,
        showOnMenu: parsed.data.showOnMenu ?? true,
      },
    });

    invalidatePublicMenuCache();
    return res.status(201).json(category);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === 'P2002') {
      return res.status(409).json({
        message: 'A category with this slug already exists for this branch. Rename or change slug.',
      });
    }
    throw err;
  }
});

// Admin: update category (PATCH or PUT)
async function updateCategory(req: import('express').Request, res: import('express').Response) {
  const parsed = upsertCategorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const id = Number(req.params.id);
  const existing = await prisma.menuCategory.findUnique({
    where: { id },
    select: { id: true, branchId: true, slug: true },
  });
  if (!existing) {
    return res.status(404).json({ message: 'Category not found' });
  }
  const data: {
    name?: string;
    imageUrl?: string | null;
    slug?: string;
    highlightNewUntil?: Date | null;
    showOnMenu?: boolean;
  } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.imageUrl !== undefined)
    data.imageUrl = parsed.data.imageUrl === '' ? null : parsed.data.imageUrl;
  if (parsed.data.slug !== undefined) {
    const next = await ensureUniqueCategorySlug({
      branchId: existing.branchId,
      desiredSlug: parsed.data.slug,
      selfCategoryId: existing.id,
    });
    data.slug = next;
  }
  if (parsed.data.name !== undefined && parsed.data.slug === undefined) {
    const desired = createSlug(parsed.data.name);
    // Keep slug stable unless it would collide.
    if (desired && desired !== existing.slug) {
      const next = await ensureUniqueCategorySlug({
        branchId: existing.branchId,
        desiredSlug: desired,
        selfCategoryId: existing.id,
      });
      data.slug = next;
    }
  }
  if (parsed.data.highlightAsNewLaunch === true) data.highlightNewUntil = highlightUntilFromNow();
  if (parsed.data.highlightAsNewLaunch === false) data.highlightNewUntil = null;
  if (parsed.data.showOnMenu !== undefined) data.showOnMenu = parsed.data.showOnMenu;

  const category = await prisma.menuCategory.update({
    where: { id },
    data,
  });

  invalidatePublicMenuCache();
  return res.json(category);
}

menuRouter.patch('/categories/:id', authenticate, requireRole('ADMIN'), updateCategory);

menuRouter.put('/categories/:id', authenticate, requireRole('ADMIN'), updateCategory);

// Admin: delete category
menuRouter.delete('/categories/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  await prisma.menuCategory.delete({ where: { id } });
  invalidatePublicMenuCache();
  return res.status(204).send();
});

// Admin: create menu item (optional notifyCustomers → prepare broadcast for new launch)
menuRouter.post('/items', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = upsertMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const { notifyCustomers, highlightAsNewLaunch, ...itemData } = parsed.data;

  const item = await prisma.menuItem.create({
    data: {
      ...itemData,
      hasHalf: itemData.hasHalf ?? false,
      halfPrice: (itemData.hasHalf ?? false) ? (itemData.halfPrice ?? null) : null,
      imageUrl: itemData.imageUrl ?? undefined,
      isActive: itemData.isActive ?? true,
      highlightNewUntil: highlightAsNewLaunch ? highlightUntilFromNow() : null,
    },
  });

  let broadcast: { message: string; mobileCount: number; mobiles: string[] } | undefined;
  if (notifyCustomers) {
    const { buildNewItemBroadcast } = await import('../../services/whatsapp.js');
    let broadcastBranchId: number | null = null;
    if (itemData.categoryId) {
      const cat = await prisma.menuCategory.findUnique({
        where: { id: itemData.categoryId },
        select: { branchId: true },
      });
      broadcastBranchId = cat?.branchId ?? null;
    }
    let branch = broadcastBranchId
      ? await prisma.branch.findUnique({
          where: { id: broadcastBranchId },
          select: { name: true, location: true, phone: true, googleReviewUrl: true },
        })
      : null;
    if (!branch) {
      const defaultId = await getDefaultPublicBranchId();
      branch = defaultId
        ? await prisma.branch.findUnique({
            where: { id: defaultId },
            select: { name: true, location: true, phone: true, googleReviewUrl: true },
          })
        : null;
    }
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

  invalidatePublicMenuCache();
  return res.status(201).json({ item, ...(broadcast ? { broadcast } : {}) });
});

// Admin: update menu item
menuRouter.patch('/items/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const parsed = patchMenuItemSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid input', errors: parsed.error.issues });
  }

  const id = Number(req.params.id);
  if (!Number.isFinite(id) || id <= 0) {
    return res.status(400).json({ message: 'Invalid item id' });
  }

  const {
    notifyCustomers: _notify,
    highlightAsNewLaunch,
    name,
    description,
    imageUrl,
    basePrice,
    hasHalf,
    halfPrice,
    isActive,
    categoryId,
  } = parsed.data;

  const data: Prisma.MenuItemUpdateInput = {};

  if (name !== undefined) data.name = name;
  if (description !== undefined) data.description = description;
  if (imageUrl !== undefined) {
    data.imageUrl = imageUrl ?? null;
  }
  if (basePrice !== undefined) data.basePrice = basePrice;
  if (isActive !== undefined) data.isActive = isActive;
  if (categoryId !== undefined) {
    if (categoryId === null) {
      data.category = { disconnect: true };
    } else {
      data.category = { connect: { id: categoryId } };
    }
  }

  if (hasHalf === false) {
    data.hasHalf = false;
    data.halfPrice = null;
  } else if (hasHalf === true) {
    data.hasHalf = true;
    if (halfPrice !== undefined && halfPrice > 0) data.halfPrice = halfPrice;
  } else if (halfPrice !== undefined) {
    if (halfPrice <= 0) {
      data.halfPrice = null;
      data.hasHalf = false;
    } else {
      data.halfPrice = halfPrice;
      data.hasHalf = true;
    }
  }

  if (highlightAsNewLaunch === true) data.highlightNewUntil = highlightUntilFromNow();
  if (highlightAsNewLaunch === false) data.highlightNewUntil = null;

  const item = await prisma.menuItem.update({
    where: { id },
    data,
  });

  invalidatePublicMenuCache();
  return res.json(item);
});

// Admin: delete (soft) menu item
menuRouter.delete('/items/:id', authenticate, requireRole('ADMIN'), async (req, res) => {
  const id = Number(req.params.id);
  const item = await prisma.menuItem.update({
    where: { id },
    data: { isActive: false },
  });

  invalidatePublicMenuCache();
  return res.json(item);
});
