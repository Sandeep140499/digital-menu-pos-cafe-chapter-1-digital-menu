-- Hotfix: ensure Branch sound fields exist (some DBs missed migration).
ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "newOrderSoundPreset" TEXT NOT NULL DEFAULT 'ring';

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "newOrderSoundVolume" DOUBLE PRECISION NOT NULL DEFAULT 1;

