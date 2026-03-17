-- Add Order.orderType with enum OrderType (DINE_IN / TAKE_AWAY)
DO $$ BEGIN
  CREATE TYPE "OrderType" AS ENUM ('DINE_IN', 'TAKE_AWAY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Order"
  ADD COLUMN IF NOT EXISTS "orderType" "OrderType" NOT NULL DEFAULT 'DINE_IN';

