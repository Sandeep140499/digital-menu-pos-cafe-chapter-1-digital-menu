-- Extend OrderItem + OrderModification for full order modifications (add/edit)
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "addedAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "addedBy" INTEGER;

ALTER TABLE "OrderModification" ADD COLUMN IF NOT EXISTS "itemsAdded" JSONB;
ALTER TABLE "OrderModification" ADD COLUMN IF NOT EXISTS "itemsUpdated" JSONB;

