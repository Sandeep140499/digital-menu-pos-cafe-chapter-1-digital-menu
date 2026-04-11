-- CreateEnum
CREATE TYPE "HappyHourApplyMode" AS ENUM ('ALL_ITEMS', 'CATEGORIES', 'ITEMS');

-- CreateEnum
CREATE TYPE "HappyHourStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "HappyHourNotificationPref" AS ENUM ('NONE', 'SEND_ON_CREATE', 'SEND_MANUAL');

-- CreateEnum
CREATE TYPE "HappyHourNotificationStatus" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "HappyHourNotifyAudience" AS ENUM ('ALL_CUSTOMERS', 'LEADERS', 'SELECTED');

-- CreateTable
CREATE TABLE "HappyHour" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL,
    "dateStart" DATE NOT NULL,
    "dateEnd" DATE NOT NULL,
    "timeStart" TEXT NOT NULL,
    "timeEnd" TEXT NOT NULL,
    "daysOfWeek" JSONB,
    "status" "HappyHourStatus" NOT NULL DEFAULT 'ACTIVE',
    "applyMode" "HappyHourApplyMode" NOT NULL,
    "notificationPref" "HappyHourNotificationPref" NOT NULL DEFAULT 'NONE',
    "notificationStatus" "HappyHourNotificationStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "sentAt" TIMESTAMP(3),
    "notifyAudience" "HappyHourNotifyAudience",
    "selectedMobiles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HappyHour_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HappyHourCategory" (
    "happyHourId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,

    CONSTRAINT "HappyHourCategory_pkey" PRIMARY KEY ("happyHourId","categoryId")
);

-- CreateTable
CREATE TABLE "HappyHourItem" (
    "happyHourId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,

    CONSTRAINT "HappyHourItem_pkey" PRIMARY KEY ("happyHourId","menuItemId")
);

-- CreateTable
CREATE TABLE "HappyHourExcludedItem" (
    "happyHourId" INTEGER NOT NULL,
    "menuItemId" INTEGER NOT NULL,

    CONSTRAINT "HappyHourExcludedItem_pkey" PRIMARY KEY ("happyHourId","menuItemId")
);

-- CreateIndex
CREATE INDEX "HappyHour_status_dateStart_dateEnd_idx" ON "HappyHour"("status", "dateStart", "dateEnd");

-- AddForeignKey
ALTER TABLE "HappyHourCategory" ADD CONSTRAINT "HappyHourCategory_happyHourId_fkey" FOREIGN KEY ("happyHourId") REFERENCES "HappyHour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourCategory" ADD CONSTRAINT "HappyHourCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "MenuCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourItem" ADD CONSTRAINT "HappyHourItem_happyHourId_fkey" FOREIGN KEY ("happyHourId") REFERENCES "HappyHour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourItem" ADD CONSTRAINT "HappyHourItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourExcludedItem" ADD CONSTRAINT "HappyHourExcludedItem_happyHourId_fkey" FOREIGN KEY ("happyHourId") REFERENCES "HappyHour"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HappyHourExcludedItem" ADD CONSTRAINT "HappyHourExcludedItem_menuItemId_fkey" FOREIGN KEY ("menuItemId") REFERENCES "MenuItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
