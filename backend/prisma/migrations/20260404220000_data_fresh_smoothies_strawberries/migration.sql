-- Data: Fresh Smoothies category + Strawberries item (₹179), Cold Coffee–style (full price only, no half).
-- Idempotent: safe to run more than once.

UPDATE "MenuCategory"
SET
  "slug" = 'fresh-smoothies',
  "image_url" = COALESCE(
    "image_url",
    'https://images.unsplash.com/photo-1553530666-d3408ec28ec0?auto=format&fit=crop&w=1200&q=80'
  ),
  "updatedAt" = NOW()
WHERE LOWER(TRIM("name")) = 'fresh smoothies'
  AND "slug" IS NULL;

INSERT INTO "MenuCategory" ("name", "slug", "image_url", "createdAt", "updatedAt")
VALUES (
  'Fresh Smoothies',
  'fresh-smoothies',
  'https://images.unsplash.com/photo-1553530666-d3408ec28ec0?auto=format&fit=crop&w=1200&q=80',
  NOW(),
  NOW()
)
ON CONFLICT ("slug") DO NOTHING;

INSERT INTO "MenuItem" (
  "name",
  "description",
  "basePrice",
  "hasHalf",
  "halfPrice",
  "isActive",
  "categoryId",
  "createdAt",
  "highlight_new_until",
  "imageUrl"
)
SELECT
  'Strawberries',
  'Fresh strawberry smoothie — pure, vibrant flavour. Naturally refreshing, with a light, wholesome energy boost. A fruity, uplifting choice when you want something delicious and better-for-you.',
  179,
  false,
  NULL,
  true,
  c.id,
  NOW(),
  NULL,
  NULL
FROM "MenuCategory" c
WHERE c."slug" = 'fresh-smoothies'
  AND NOT EXISTS (
    SELECT 1
    FROM "MenuItem" m
    WHERE m."categoryId" = c.id
      AND m."name" = 'Strawberries'
  );
