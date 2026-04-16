-- CreateTable
CREATE TABLE "CustomerLead" (
    "id" SERIAL NOT NULL,
    "mobile" TEXT NOT NULL,
    "name" TEXT,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "lastOrderAt" TIMESTAMP(3),
    "sourceTag" TEXT,
    "importedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerLead_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CustomerLead_mobile_key" ON "CustomerLead"("mobile");

-- CreateIndex
CREATE INDEX "CustomerLead_lastOrderAt_idx" ON "CustomerLead"("lastOrderAt");

-- CreateIndex
CREATE INDEX "CustomerLead_totalOrders_idx" ON "CustomerLead"("totalOrders");

-- CreateIndex
CREATE INDEX "CustomerLead_totalSpent_idx" ON "CustomerLead"("totalSpent");

