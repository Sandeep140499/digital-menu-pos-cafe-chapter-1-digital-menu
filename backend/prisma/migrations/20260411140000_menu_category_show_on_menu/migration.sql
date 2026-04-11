-- Hide entire categories from the public customer menu while keeping admin management.
ALTER TABLE "MenuCategory" ADD COLUMN "show_on_menu" BOOLEAN NOT NULL DEFAULT true;
