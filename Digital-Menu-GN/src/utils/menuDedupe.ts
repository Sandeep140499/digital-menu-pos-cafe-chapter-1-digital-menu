/**
 * Customer menu: one card per category name/slug; merged items by id (matches API dedupe; also fixes stale localStorage cache).
 */

function normalizeMenuNameKey(name: string | null | undefined): string {
  return String(name ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function dedupeItems<T extends { id?: number; name?: string; isNewLaunch?: boolean }>(items: T[]): T[] {
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

export function dedupeCustomerMenuCategories(categories: any[]): any[] {
  const byMergeKey = new Map<string, any>();

  for (const cat of categories) {
    if (!cat || typeof cat !== 'object') continue;
    const nameKey = normalizeMenuNameKey(cat.name);
    if (!nameKey) continue;

    const slugRaw = typeof cat.slug === 'string' ? cat.slug.trim().toLowerCase() : '';

    // Only merge by slug. Merging by name can put items under the wrong category.
    const mergeKey = slugRaw ? `slug:${slugRaw}` : `id:${String(cat.id ?? nameKey)}`;

    const existing = byMergeKey.get(mergeKey);
    const rawItems = [...(existing?.items ?? []), ...(Array.isArray(cat.items) ? cat.items : [])];
    const combinedItems = dedupeItems(rawItems);

    if (!existing) {
      byMergeKey.set(mergeKey, { ...cat, items: combinedItems });
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
      showOnMenu: existing.showOnMenu !== false && cat.showOnMenu !== false,
      items: combinedItems,
    });
  }

  return Array.from(byMergeKey.values());
}
