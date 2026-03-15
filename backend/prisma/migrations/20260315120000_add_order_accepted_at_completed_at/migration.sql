-- AlterTable: add Order columns that may be missing (safe to run if some already exist)
-- PostgreSQL does not support IF NOT EXISTS for ADD COLUMN; run once. If column exists, migration will fail - then mark as applied or add columns manually.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerName" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "customerMobile" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reviewSent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
