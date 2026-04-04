import { prisma } from '../config/prisma.js';

export function normalizeStaffEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Match login / OTP to DB even when legacy rows used mixed-case emails (unique is case-sensitive in Postgres). */
export async function findEmployeeByEmailLoose(email: string) {
  const norm = normalizeStaffEmail(email);
  const exact = await prisma.employee.findUnique({ where: { email: norm } });
  if (exact) return exact;
  return prisma.employee.findFirst({
    where: { email: { equals: norm, mode: 'insensitive' } },
  });
}

export async function findAdminByEmailLoose(email: string) {
  const norm = normalizeStaffEmail(email);
  const exact = await prisma.admin.findUnique({ where: { email: norm } });
  if (exact) return exact;
  return prisma.admin.findFirst({
    where: { email: { equals: norm, mode: 'insensitive' } },
  });
}
