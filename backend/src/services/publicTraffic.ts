/**
 * In-memory counter for public menu (GET /menu) requests.
 * Resets on server restart. Use for "Public Network Traffic" on admin dashboard.
 */
let publicMenuViewCount = 0;

export function incrementPublicMenuViews(): void {
  publicMenuViewCount += 1;
}

export function getPublicMenuViewCount(): number {
  return publicMenuViewCount;
}
