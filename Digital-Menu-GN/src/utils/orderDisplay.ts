/**
 * Legacy ₹0 "Packaging" rows from take-away orders — hide in UI; order type already says Take Away.
 */
export function filterOrderItemsForDisplay<T extends { name: string; price?: number }>(
  items: T[] | undefined | null
): T[] {
  if (!items?.length) return [];
  return items.filter(i => {
    const n = String(i.name).trim().toLowerCase();
    if (n === 'packaging' && (Number(i.price) || 0) === 0) return false;
    return true;
  });
}
