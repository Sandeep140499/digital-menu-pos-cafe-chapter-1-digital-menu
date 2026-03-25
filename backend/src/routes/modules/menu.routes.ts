import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requireRole } from "../../middleware/auth.js";
import { incrementPublicMenuViews } from "../../services/publicTraffic.js";

function createSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .trim();
}

const upsertCategorySchema = z.object({
  name: z.string().min(1),
  imageUrl: z.string().optional().nullable(),
  slug: z.string().min(1).optional(),
});

const upsertMenuItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
  basePrice: z.number().positive(),
  hasHalf: z.boolean().optional(),
  halfPrice: z.number().positive().optional(),
  isActive: z.boolean().optional(),
  categoryId: z.number().int().optional(),
  notifyCustomers: z.boolean().optional(), // when true, prepare broadcast for new launch
});

export const menuRouter = Router();

type PublicMenuResponse = { categories: any[]; bestSellerItemIds: number[] };

// Simple in-memory cache to protect DB under high traffic.
// - categories change rarely; best-sellers can lag a little.
// - If DB temporarily fails, we serve last known good menu instead of crashing customer UX.
let publicMenuCache:
  | { data: PublicMenuResponse; ts: number; bestTs: number }
  | null = null;
const MENU_CACHE_MS = 15_000;
const BEST_SELLER_CACHE_MS = 5 * 60_000;

// Last week (Monday 00:00 to Sunday 23:59) for best-seller calculation
function getLastWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const day = now.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const thisMonday = new Date(now);
  thisMonday.setDate(now.getDate() + diffToMonday);
  thisMonday.setHours(0, 0, 0, 0);
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);
  return { start: lastMonday, end: lastSunday };
}

// Public: get menu for QR customer (only active items) + bestSellerItemIds (top 5 from last week)
menuRouter.get("/", async (_req, res) => {
  incrementPublicMenuViews();
  const now = Date.now();
  if (publicMenuCache && now - publicMenuCache.ts < MENU_CACHE_MS) {
    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
    return res.json(publicMenuCache.data);
  }
  try {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        createdAt: true,
        items: {
          where: { isActive: true },
          orderBy: { createdAt: "asc" },
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
      const { start, end } = getLastWeekRange();
      const lastWeekOrderItems = await prisma.orderItem.groupBy({
        by: ["menuItemId"],
        where: {
          menuItemId: { not: null },
          order: {
            createdAt: { gte: start, lte: end },
          },
        },
        _sum: { quantity: true },
      });
      const sorted = lastWeekOrderItems
        .filter((r) => r.menuItemId != null)
        .sort((a, b) => (b._sum.quantity ?? 0) - (a._sum.quantity ?? 0))
        .slice(0, 5);
      bestSellerItemIds = sorted.map((r) => r.menuItemId as number);
    }

    const data: PublicMenuResponse = { categories, bestSellerItemIds };
    publicMenuCache = {
      data,
      ts: now,
      bestTs: bestStale ? now : publicMenuCache?.bestTs ?? now,
    };
    res.setHeader("Cache-Control", "public, max-age=5, stale-while-revalidate=30");
    return res.json(data);
  } catch (err) {
    const e = err as any;
    const msg = String(e?.message || "");
    const isDbDown =
      msg.includes("Can't reach database server") ||
      e?.code === "P1001" ||
      e?.name === "PrismaClientInitializationError";
    console.error("Menu API error:", err);
    // Serve last known good menu to avoid customer-facing crash.
    if (publicMenuCache?.data) {
      res.setHeader("X-Menu-Cache", "stale");
      res.setHeader("Cache-Control", "public, max-age=2, stale-while-revalidate=30");
      return res.json(publicMenuCache.data);
    }
    return res.status(isDbDown ? 503 : 500).json({
      message: isDbDown
        ? "Menu is temporarily unavailable (database offline). Please try again in a moment."
        : "Failed to load menu",
      categories: [],
      bestSellerItemIds: [],
    });
  }
});

// Admin: get full menu with all items (for live/pending counts)
menuRouter.get(
  "/admin",
  authenticate,
  requireRole("ADMIN"),
  async (_req, res) => {
    const categories = await prisma.menuCategory.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        slug: true,
        imageUrl: true,
        createdAt: true,
        items: {
          orderBy: { createdAt: "asc" },
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
  }
);

// Admin: create category
menuRouter.post(
  "/categories",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = upsertCategorySchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const slug =
      parsed.data.slug?.trim() || createSlug(parsed.data.name);
    const category = await prisma.menuCategory.create({
      data: {
        name: parsed.data.name,
        slug,
        imageUrl: parsed.data.imageUrl ?? undefined,
      },
    });

    return res.status(201).json(category);
  },
);

// Admin: update category (PATCH or PUT)
async function updateCategory(req: import("express").Request, res: import("express").Response) {
  const parsed = upsertCategorySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res
      .status(400)
      .json({ message: "Invalid input", errors: parsed.error.issues });
  }

  const id = Number(req.params.id);
  const data: { name?: string; imageUrl?: string | null; slug?: string } = {};
  if (parsed.data.name !== undefined) data.name = parsed.data.name;
  if (parsed.data.imageUrl !== undefined)
    data.imageUrl = parsed.data.imageUrl === "" ? null : parsed.data.imageUrl;
  if (parsed.data.slug !== undefined) data.slug = parsed.data.slug;
  if (parsed.data.name !== undefined && parsed.data.slug === undefined)
    data.slug = createSlug(parsed.data.name);

  const category = await prisma.menuCategory.update({
    where: { id },
    data,
  });

  return res.json(category);
}

menuRouter.patch(
  "/categories/:id",
  authenticate,
  requireRole("ADMIN"),
  updateCategory
);

menuRouter.put(
  "/categories/:id",
  authenticate,
  requireRole("ADMIN"),
  updateCategory
);

// Admin: delete category
menuRouter.delete(
  "/categories/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    await prisma.menuCategory.delete({ where: { id } });
    return res.status(204).send();
  },
);

// Admin: create menu item (optional notifyCustomers → prepare broadcast for new launch)
menuRouter.post(
  "/items",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = upsertMenuItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const { notifyCustomers, ...itemData } = parsed.data;

    const item = await prisma.menuItem.create({
      data: {
        ...itemData,
        hasHalf: itemData.hasHalf ?? false,
        isActive: itemData.isActive ?? true,
      },
    });

    let broadcast: { message: string; mobileCount: number; mobiles: string[] } | undefined;
    if (notifyCustomers) {
      const { buildNewItemBroadcast } = await import("../../services/whatsapp.js");
      const branch = await prisma.branch.findFirst({
        select: { name: true, location: true, phone: true, googleReviewUrl: true },
      });
      const message = buildNewItemBroadcast({
        itemNames: [item.name],
        itemDetails: item.description ?? undefined,
        branch: branch || undefined,
      });
      const orders = await prisma.order.findMany({
        where: { customerMobile: { not: null } },
        select: { customerMobile: true },
      });
      const seen = new Set<string>();
      const mobiles: string[] = [];
      for (const o of orders) {
        const m = o.customerMobile!.replace(/\D/g, "").slice(-10);
        if (m.length === 10 && !seen.has(m)) {
          seen.add(m);
          mobiles.push(m);
        }
      }
      broadcast = { message, mobileCount: mobiles.length, mobiles };
    }

    return res.status(201).json({ item, ...(broadcast ? { broadcast } : {}) });
  },
);

// Admin: update menu item
menuRouter.patch(
  "/items/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const parsed = upsertMenuItemSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: "Invalid input", errors: parsed.error.issues });
    }

    const id = Number(req.params.id);
    const item = await prisma.menuItem.update({
      where: { id },
      data: parsed.data,
    });

    return res.json(item);
  },
);

// Admin: delete (soft) menu item
menuRouter.delete(
  "/items/:id",
  authenticate,
  requireRole("ADMIN"),
  async (req, res) => {
    const id = Number(req.params.id);
    const item = await prisma.menuItem.update({
      where: { id },
      data: { isActive: false },
    });

    return res.json(item);
  },
);

