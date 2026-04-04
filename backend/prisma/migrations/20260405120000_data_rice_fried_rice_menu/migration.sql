-- Data: standalone "Rice" category (fried rice) — separate from "Rice Bowl (Lunch/Dinner)" (slug `rice`).
-- Idempotent: safe to run more than once.

INSERT INTO "MenuCategory" ("name", "slug", "image_url", "createdAt", "updatedAt")
SELECT 'Rice', 'fried-rice', 'https://i.ibb.co/6Pjw8H4/rice.jpg', NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM "MenuCategory" WHERE "slug" = 'fried-rice');

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
SELECT 'Chicken Fried Rice', NULL, 169, true, 109, true, c.id, NOW(), NULL, NULL
FROM "MenuCategory" c
WHERE c."slug" = 'fried-rice'
  AND NOT EXISTS (
    SELECT 1 FROM "MenuItem" m WHERE m."categoryId" = c.id AND m."name" = 'Chicken Fried Rice'
  );

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
SELECT 'Paneer Fried Rice', NULL, 159, true, 109, true, c.id, NOW(), NULL, NULL
FROM "MenuCategory" c
WHERE c."slug" = 'fried-rice'
  AND NOT EXISTS (
    SELECT 1 FROM "MenuItem" m WHERE m."categoryId" = c.id AND m."name" = 'Paneer Fried Rice'
  );

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
SELECT 'Egg Fried Rice', NULL, 159, true, 99, true, c.id, NOW(), NULL, NULL
FROM "MenuCategory" c
WHERE c."slug" = 'fried-rice'
  AND NOT EXISTS (
    SELECT 1 FROM "MenuItem" m WHERE m."categoryId" = c.id AND m."name" = 'Egg Fried Rice'
  );

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
SELECT 'Veg Fried Rice', NULL, 149, true, 89, true, c.id, NOW(), NULL, NULL
FROM "MenuCategory" c
WHERE c."slug" = 'fried-rice'
  AND NOT EXISTS (
    SELECT 1 FROM "MenuItem" m WHERE m."categoryId" = c.id AND m."name" = 'Veg Fried Rice'
  );
