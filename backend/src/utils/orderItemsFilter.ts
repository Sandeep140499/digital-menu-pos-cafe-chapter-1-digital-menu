/**
 * Legacy take-away orders stored a synthetic ₹0 "Packaging" line item.
 * Take-away is already indicated by orderType — hide this row on receipts, email, and UI.
 */
export function filterOrderItemsForReceipt<
  T extends { name: string; price: number; isRemoved?: boolean | null },
>(items: T[]): T[] {
  return items.filter(i => {
    if (i.isRemoved) return false;
    const n = String(i.name).trim().toLowerCase();
    if (n === 'packaging' && Number(i.price) === 0) return false;
    return true;
  });
}
