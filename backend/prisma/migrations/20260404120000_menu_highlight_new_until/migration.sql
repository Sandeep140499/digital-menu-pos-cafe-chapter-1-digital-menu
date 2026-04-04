-- Highlight "New launch" on customer menu until this timestamp (category and/or items).
ALTER TABLE "MenuCategory" ADD COLUMN "highlight_new_until" TIMESTAMP(3);
ALTER TABLE "MenuItem" ADD COLUMN "highlight_new_until" TIMESTAMP(3);
