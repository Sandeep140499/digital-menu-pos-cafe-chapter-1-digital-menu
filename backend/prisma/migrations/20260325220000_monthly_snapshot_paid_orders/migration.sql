-- AlterTable
ALTER TABLE "MonthlyRevenueSnapshot" ADD COLUMN IF NOT EXISTS "paidOrdersCount" INTEGER NOT NULL DEFAULT 0;
