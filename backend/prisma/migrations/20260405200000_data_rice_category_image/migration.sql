-- Rice (fried-rice) category card image

UPDATE "MenuCategory"
SET
  "image_url" = 'https://thai-foodie.com/wp-content/uploads/2025/04/thai-curry-fried-rice-plated.jpg',
  "updatedAt" = NOW()
WHERE "slug" = 'fried-rice';
