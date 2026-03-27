-- Create table for admin-set monthly revenue targets
CREATE TABLE "MonthlyTarget" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "yearMonth" TEXT NOT NULL,
    "targetAmount" DOUBLE PRECISION NOT NULL,
    "createdBy" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MonthlyTarget_pkey" PRIMARY KEY ("id")
);

-- Ensure one target row per month
CREATE UNIQUE INDEX "MonthlyTarget_yearMonth_key" ON "MonthlyTarget"("yearMonth");
CREATE INDEX "MonthlyTarget_year_month_idx" ON "MonthlyTarget"("year", "month");
