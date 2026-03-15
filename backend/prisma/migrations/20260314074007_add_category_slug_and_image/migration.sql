/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `MenuCategory` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[slug]` on the table `MenuCategory` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "MenuCategory" DROP COLUMN "imageUrl",
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "slug" TEXT,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT NOW();

-- CreateIndex
CREATE UNIQUE INDEX "MenuCategory_slug_key" ON "MenuCategory"("slug");
