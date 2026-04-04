-- Keep Fresh Smoothies → Strawberries in sync: ₹179, canonical description (idempotent UPDATE for prod).

UPDATE "MenuItem" AS m
SET
  "basePrice" = 179,
  "description" = 'Fresh strawberry smoothie — pure fruit flavour, naturally refreshing. Light, uplifting, and a delicious better-for-you choice.',
  "hasHalf" = false,
  "halfPrice" = NULL
FROM "MenuCategory" AS c
WHERE m."categoryId" = c.id
  AND c."slug" = 'fresh-smoothies'
  AND m."name" = 'Strawberries';
