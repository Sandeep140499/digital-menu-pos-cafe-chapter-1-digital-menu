-- Performance indexes for high-concurrency usage (50+ users).
-- Safe to run multiple times (IF NOT EXISTS).

-- EmployeeShift: fast lookup for "any active employee at branch"
CREATE INDEX IF NOT EXISTS "EmployeeShift_branchId_shiftEnd_status_shiftStart_idx"
ON "EmployeeShift" ("branchId", "shiftEnd", "status", "shiftStart");

CREATE INDEX IF NOT EXISTS "EmployeeShift_employeeId_shiftEnd_shiftStart_idx"
ON "EmployeeShift" ("employeeId", "shiftEnd", "shiftStart");

-- Order: fast live-orders queries (branch + status + today) and realtime updates (updatedAt)
CREATE INDEX IF NOT EXISTS "Order_branchId_status_createdAt_idx"
ON "Order" ("branchId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "Order_branchId_updatedAt_idx"
ON "Order" ("branchId", "updatedAt");

-- OrderItem: common joins/grouping (order details, best-sellers)
CREATE INDEX IF NOT EXISTS "OrderItem_orderId_idx"
ON "OrderItem" ("orderId");

CREATE INDEX IF NOT EXISTS "OrderItem_menuItemId_idx"
ON "OrderItem" ("menuItemId");

