-- Monthly revenue snapshots for admin Revenue page (survives order row deletion).
CREATE TABLE IF NOT EXISTS "MonthlyRevenueSnapshot" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "totalOrders" INTEGER NOT NULL,
    "totalSales" DOUBLE PRECISION NOT NULL,
    "uniqueCustomers" INTEGER NOT NULL,
    "avgOrdersPerDay" DOUBLE PRECISION NOT NULL,
    "totalLoss" DOUBLE PRECISION NOT NULL,
    "overtimeHoursApproved" DOUBLE PRECISION NOT NULL,
    "approvedLeavesCount" INTEGER NOT NULL,
    "lateEntriesCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonthlyRevenueSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyRevenueSnapshot_yearMonth_key" ON "MonthlyRevenueSnapshot"("yearMonth");
CREATE INDEX IF NOT EXISTS "MonthlyRevenueSnapshot_year_month_idx" ON "MonthlyRevenueSnapshot"("year", "month");
