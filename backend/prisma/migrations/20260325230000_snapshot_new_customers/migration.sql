-- AlterTable
ALTER TABLE "MonthlyRevenueSnapshot" ADD COLUMN IF NOT EXISTS "newCustomersCount" INTEGER NOT NULL DEFAULT 0;
