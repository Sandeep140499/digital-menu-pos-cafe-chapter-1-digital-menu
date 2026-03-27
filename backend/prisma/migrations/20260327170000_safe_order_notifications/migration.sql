-- Safe migration for order notifications - data-preserving approach
-- This migration only adds new columns and updates existing data safely

-- Add order source tracking (defaults to CUSTOMER for backward compatibility)
-- Only add if column doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' AND column_name = 'orderSource'
    ) THEN
        ALTER TABLE "Order" ADD COLUMN "orderSource" TEXT DEFAULT 'CUSTOMER';
        ALTER TABLE "Order" ADD CONSTRAINT "Order_orderSource_check" CHECK ("orderSource" IN ('CUSTOMER', 'EMPLOYEE'));
    END IF;
END $$;

-- Add order priority for notification urgency (defaults to NORMAL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' AND column_name = 'priority'
    ) THEN
        ALTER TABLE "Order" ADD COLUMN "priority" TEXT DEFAULT 'NORMAL';
        ALTER TABLE "Order" ADD CONSTRAINT "Order_priority_check" CHECK ("priority" IN ('LOW', 'NORMAL', 'HIGH', 'URGENT'));
    END IF;
END $$;

-- Add urgent order volume control for branches (defaults to 1.0)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Branch' AND column_name = 'urgentOrderVolume'
    ) THEN
        ALTER TABLE "Branch" ADD COLUMN "urgentOrderVolume" FLOAT DEFAULT 1.0;
        ALTER TABLE "Branch" ADD CONSTRAINT "Branch_urgentOrderVolume_check" CHECK ("urgentOrderVolume" >= 0.1 AND "urgentOrderVolume" <= 2.0);
    END IF;
END $$;

-- Add employee notification preferences (defaults to enabled)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Employee' AND column_name = 'notificationSoundEnabled'
    ) THEN
        ALTER TABLE "Employee" ADD COLUMN "notificationSoundEnabled" BOOLEAN DEFAULT true;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Employee' AND column_name = 'notificationVolume'
    ) THEN
        ALTER TABLE "Employee" ADD COLUMN "notificationVolume" FLOAT DEFAULT 1.0;
        ALTER TABLE "Employee" ADD CONSTRAINT "Employee_notificationVolume_check" CHECK ("notificationVolume" >= 0.1 AND "notificationVolume" <= 2.0);
    END IF;
END $$;

-- Update existing orders to have proper orderSource based on employeeId
-- Only update if the column exists and hasn't been updated yet
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' AND column_name = 'orderSource'
    ) THEN
        UPDATE "Order" SET "orderSource" = 'EMPLOYEE' 
        WHERE "employeeId" IS NOT NULL AND "orderSource" = 'CUSTOMER';
    END IF;
END $$;

-- Set priority for existing orders based on status
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'Order' AND column_name = 'priority'
    ) THEN
        UPDATE "Order" SET "priority" = 'HIGH' 
        WHERE "status" = 'NEW_ORDER' AND "priority" = 'NORMAL';
    END IF;
END $$;
