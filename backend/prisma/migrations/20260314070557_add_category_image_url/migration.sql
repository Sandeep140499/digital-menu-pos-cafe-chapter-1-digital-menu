-- AlterTable
ALTER TABLE "MenuCategory" ADD COLUMN     "imageUrl" TEXT;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "originalAmount" DOUBLE PRECISION DEFAULT 0;

-- AlterTable
ALTER TABLE "OrderItem" ADD COLUMN     "isRemoved" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "removalReason" TEXT,
ADD COLUMN     "removedAt" TIMESTAMP(3),
ADD COLUMN     "removedBy" INTEGER;

-- CreateTable
CREATE TABLE "RemovedItemsReport" (
    "id" SERIAL NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" INTEGER NOT NULL,
    "employeeId" INTEGER,
    "itemName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalLoss" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemovedItemsReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderModification" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "modifiedBy" INTEGER NOT NULL,
    "modifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "oldAmount" DOUBLE PRECISION NOT NULL,
    "newAmount" DOUBLE PRECISION NOT NULL,
    "itemsRemoved" JSONB,
    "reason" TEXT,

    CONSTRAINT "OrderModification_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "RemovedItemsReport" ADD CONSTRAINT "RemovedItemsReport_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RemovedItemsReport" ADD CONSTRAINT "RemovedItemsReport_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderModification" ADD CONSTRAINT "OrderModification_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
