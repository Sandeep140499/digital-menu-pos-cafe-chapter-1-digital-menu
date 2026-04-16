-- Add normalized customer identity columns to Order and backfill.
-- These replace raw SQL patterns in application code (fast lookups + analytics).

ALTER TABLE "Order"
ADD COLUMN "customer_mobile_last10" TEXT,
ADD COLUMN "customer_key" TEXT;

-- Backfill last10 (only when a valid 10-digit Indian mobile is present).
UPDATE "Order"
SET "customer_mobile_last10" = right(regexp_replace(COALESCE("customerMobile", ''), '[^0-9]', '', 'g'), 10)
WHERE length(regexp_replace(COALESCE("customerMobile", ''), '[^0-9]', '', 'g')) >= 10
  AND right(regexp_replace(COALESCE("customerMobile", ''), '[^0-9]', '', 'g'), 10) ~ '^[6-9][0-9]{9}$';

-- Backfill customer_key:
-- prefer mobile-based identity; otherwise fall back to session token when present.
UPDATE "Order"
SET "customer_key" = CASE
  WHEN "customer_mobile_last10" IS NOT NULL AND "customer_mobile_last10" ~ '^[6-9][0-9]{9}$'
    THEN 'm:' || "customer_mobile_last10"
  WHEN "sessionToken" IS NOT NULL AND length(btrim("sessionToken")) > 0
    THEN 's:' || btrim("sessionToken")
  ELSE NULL
END;

-- Indexes for fast filtering/grouping.
CREATE INDEX IF NOT EXISTS "Order_customer_mobile_last10_idx" ON "Order" ("customer_mobile_last10");
CREATE INDEX IF NOT EXISTS "Order_customer_key_idx" ON "Order" ("customer_key");

