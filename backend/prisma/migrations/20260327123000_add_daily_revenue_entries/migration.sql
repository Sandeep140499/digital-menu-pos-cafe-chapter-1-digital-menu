-- Store daily earnings snapshots for historical tracking and monthly achievement math
CREATE TABLE "DailyRevenueEntry" (
    "id" SERIAL NOT NULL,
    "businessDate" DATE NOT NULL,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "paidOrders" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DailyRevenueEntry_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DailyRevenueEntry_businessDate_key" ON "DailyRevenueEntry"("businessDate");
CREATE INDEX "DailyRevenueEntry_businessDate_idx" ON "DailyRevenueEntry"("businessDate");
