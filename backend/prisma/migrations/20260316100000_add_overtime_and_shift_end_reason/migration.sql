-- AlterTable
ALTER TABLE "EmployeeShift" ADD COLUMN IF NOT EXISTS "endReason" TEXT;

-- CreateTable
CREATE TABLE "EmployeeOvertime" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "shiftId" INTEGER NOT NULL,
    "employeeName" TEXT NOT NULL,
    "role" TEXT,
    "shiftDate" DATE NOT NULL,
    "shiftStart" TIMESTAMP(3) NOT NULL,
    "shiftEnd" TIMESTAMP(3) NOT NULL,
    "totalHours" DOUBLE PRECISION NOT NULL,
    "overtimeHours" DOUBLE PRECISION NOT NULL,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeOvertime_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeOvertime_shiftId_key" ON "EmployeeOvertime"("shiftId");
CREATE INDEX "EmployeeOvertime_employeeId_idx" ON "EmployeeOvertime"("employeeId");
CREATE INDEX "EmployeeOvertime_shiftDate_idx" ON "EmployeeOvertime"("shiftDate");
CREATE INDEX "EmployeeOvertime_createdAt_idx" ON "EmployeeOvertime"("createdAt");

-- AddForeignKey
ALTER TABLE "EmployeeOvertime" ADD CONSTRAINT "EmployeeOvertime_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeOvertime" ADD CONSTRAINT "EmployeeOvertime_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "EmployeeShift"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
