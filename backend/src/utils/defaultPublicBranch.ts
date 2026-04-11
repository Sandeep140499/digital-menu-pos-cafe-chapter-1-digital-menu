import { prisma } from '../config/prisma.js';

/**
 * The "main" branch for legacy / unpinned behaviour:
 * - Customer `GET /menu` and `GET /config/branch-contact` with no `branchId`
 * - Admin `GET /config/branch` with no `branchId`
 * - Happy hour timezone default, WhatsApp templates, etc.
 *
 * `DEFAULT_PUBLIC_BRANCH_ID` — force a specific outlet (must exist).
 *
 * If unset, we use the **lowest branch id that already has at least one menu category**.
 * That matches how the DB migration attached legacy menus (usually the first branch), so
 * unpinned customers still see food even when a newer branch has a lower id with no menu yet.
 */
export async function getDefaultPublicBranchId(): Promise<number | null> {
  const raw = process.env.DEFAULT_PUBLIC_BRANCH_ID?.trim();
  if (raw) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) {
      const row = await prisma.branch.findUnique({ where: { id: n }, select: { id: true } });
      if (row) return row.id;
    }
  }

  const withCategories = await prisma.branch.findFirst({
    where: { menuCategories: { some: {} } },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (withCategories) return withCategories.id;

  const any = await prisma.branch.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return any?.id ?? null;
}
