-- CreateTable
CREATE TABLE "SalarySlip" (
    "id" SERIAL NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "salaryNumber" TEXT,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "paidDays" INTEGER,
    "lopDays" INTEGER,
    "basicSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "netSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "allowances" JSONB,
    "deductions" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalarySlip_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalarySlip_employeeId_idx" ON "SalarySlip"("employeeId");

-- CreateIndex
CREATE INDEX "SalarySlip_year_month_idx" ON "SalarySlip"("year", "month");

-- CreateIndex
CREATE INDEX "SalarySlip_createdAt_idx" ON "SalarySlip"("createdAt");

-- AddForeignKey
ALTER TABLE "SalarySlip" ADD CONSTRAINT "SalarySlip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

