import { prisma } from '../config/prisma.js';
import { DEFAULT_MENU_TIMEZONE, mapDbHappyHourToRule, type HappyHourRule } from './happyHourEngine.js';
import { getDefaultPublicBranchId } from '../utils/defaultPublicBranch.js';

export async function loadActiveHappyHourRules(): Promise<{ rules: HappyHourRule[]; tz: string }> {
  const defaultBranchId = await getDefaultPublicBranchId();
  const [branchTzRow, hhRows] = await Promise.all([
    defaultBranchId
      ? prisma.branch.findUnique({
          where: { id: defaultBranchId },
          select: { timezone: true },
        })
      : Promise.resolve(null),
    prisma.happyHour.findMany({
      where: { status: 'ACTIVE' },
      include: {
        categoryLinks: { select: { categoryId: true } },
        itemLinks: { select: { menuItemId: true } },
        excludedItemLinks: { select: { menuItemId: true } },
      },
    }),
  ]);
  const tz = branchTzRow?.timezone?.trim() || DEFAULT_MENU_TIMEZONE;
  return { rules: hhRows.map(mapDbHappyHourToRule), tz };
}
