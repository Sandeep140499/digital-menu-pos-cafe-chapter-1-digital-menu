/**
 * Public menu: merge duplicate categories (same display name or same slug) and duplicate items.
 * Fixes double cards when DB has e.g. two "Fresh Smoothies" rows from migrations/seeds.
 */

export function normalizeMenuNameKey(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function dedupePublicMenuItems<
  T extends { id?: number; name?: string; isNewLaunch?: boolean },
>(items: T[]): T[] {
  const out: T[] = [];
  const seenId = new Set<number>();
  const seenName = new Set<string>();
  for (const it of items) {
    if (it && typeof it.id === 'number' && Number.isFinite(it.id)) {
      if (seenId.has(it.id)) {
        const idx = out.findIndex(o => (o as { id?: number }).id === it.id);
        if (idx >= 0) {
          const cur = out[idx] as { isNewLaunch?: boolean };
          const next = it as { isNewLaunch?: boolean };
          cur.isNewLaunch = !!(cur.isNewLaunch || next.isNewLaunch);
        }
        continue;
      }
      seenId.add(it.id);
      out.push(it);
      continue;
    }
    const nk = normalizeMenuNameKey(it?.name);
    if (!nk || seenName.has(nk)) continue;
    seenName.add(nk);
    out.push(it);
  }
  return out;
}

export type PublicMenuCategoryShape = {
  id: number;
  name: string;
  slug?: string | null;
  imageUrl?: string | null;
  createdAt?: Date;
  isNewLaunch: boolean;
  items: Array<Record<string, unknown>>;
};

export function dedupePublicMenuCategories<T extends PublicMenuCategoryShape>(
  categories: T[]
): T[] {
  const byMergeKey = new Map<string, T>();

  for (const cat of categories) {
    const nameKey = normalizeMenuNameKey(cat.name);
    if (!nameKey) continue;

    const slugRaw = typeof cat.slug === 'string' ? cat.slug.trim().toLowerCase() : '';

    // IMPORTANT:
    // Only merge categories when there's a valid slug match.
    // Merging by name can incorrectly group items under the wrong card when names repeat or drift.
    const mergeKey = slugRaw ? `slug:${slugRaw}` : `id:${cat.id}`;

    const existing = byMergeKey.get(mergeKey);
    const combinedItems = dedupePublicMenuItems([...(existing?.items ?? []), ...(cat.items ?? [])]);

    if (!existing) {
      byMergeKey.set(mergeKey, { ...cat, items: combinedItems as T['items'] });
      continue;
    }

    byMergeKey.set(mergeKey, {
      ...existing,
      slug: existing.slug || cat.slug,
      imageUrl:
        (existing.imageUrl && String(existing.imageUrl).trim()) ||
        (cat.imageUrl && String(cat.imageUrl).trim()) ||
        existing.imageUrl,
      isNewLaunch: !!(existing.isNewLaunch || cat.isNewLaunch),
      items: combinedItems as T['items'],
    });
  }

  return Array.from(byMergeKey.values());
}
