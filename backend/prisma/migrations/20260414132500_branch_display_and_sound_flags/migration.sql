-- Branch display & sound flags (customer total + employee ringing preset/volume)

ALTER TABLE "Branch"
ADD COLUMN IF NOT EXISTS "showTotalAmountToCustomers" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "enableNewOrderRinging" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN IF NOT EXISTS "newOrderSoundPreset" TEXT NOT NULL DEFAULT 'ring',
ADD COLUMN IF NOT EXISTS "newOrderSoundVolume" DOUBLE PRECISION NOT NULL DEFAULT 1;

-- Branch display + sound settings fields.
-- Use IF NOT EXISTS to repair older databases that missed earlier migrations.

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "showTotalAmountToCustomers" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "enableNewOrderRinging" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "newOrderSoundPreset" TEXT NOT NULL DEFAULT 'ring';

ALTER TABLE "Branch"
  ADD COLUMN IF NOT EXISTS "newOrderSoundVolume" DOUBLE PRECISION NOT NULL DEFAULT 1;

