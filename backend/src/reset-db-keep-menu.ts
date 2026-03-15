/**
 * Reset database EXCEPT MenuCategory and MenuItem.
 * Deletes: LateEntry, EmployeeOvertime, EmployeeShift, OrderItem, RemovedItemsReport,
 * OrderModification, PaymentRecord, Order, CustomerQuery, Table, Employee, Branch.
 * Keeps: Admin, MenuCategory, MenuItem (and ErrorLog if any).
 * Then creates: 1 Branch, 1 Active Employee (so salary slip dropdown works).
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { prisma } from "./config/prisma.js";

async function main() {
  console.log("Deleting data (keeping menu categories & items)...");

  await prisma.lateEntry.deleteMany({});
  await prisma.employeeOvertime.deleteMany({});
  await prisma.employeeShift.deleteMany({});
  await prisma.orderItem.deleteMany({});
  await prisma.removedItemsReport.deleteMany({});
  await prisma.orderModification.deleteMany({});
  await prisma.paymentRecord.deleteMany({});
  await prisma.order.deleteMany({});
  await prisma.customerQuery.deleteMany({});
  await prisma.table.deleteMany({});
  await prisma.employee.deleteMany({});
  await prisma.branch.deleteMany({});

  console.log("Creating default Branch and one ACTIVE Employee...");

  const branch = await prisma.branch.create({
    data: {
      name: "Main Branch",
      location: "Gautam Nagar",
      timezone: "Asia/Kolkata",
      pincode: "110049",
    },
  });

  const employeePassword = "employee@123";
  const employeeHash = await bcrypt.hash(employeePassword, 10);

  const employee = await prisma.employee.create({
    data: {
      name: "Test Employee",
      email: "employee@test.com",
      passwordHash: employeeHash,
      employeeCode: "CC100001",
      branchId: branch.id,
      role: "Counter Staff",
      status: "ACTIVE",
      emailVerified: true,
      workingHoursPerDay: 8,
      shiftStartTime: "10:00",
      shiftEndTime: "18:00",
    },
  });

  await prisma.table.create({
    data: { branchId: branch.id, tableNumber: "T1" },
  });

  console.log("Done. Branch id:", branch.id, "| Active Employee:", employee.name, "(" + employee.email + ")");
  console.log("Employee password:", employeePassword);
  console.log("Menu categories and items were NOT touched.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
