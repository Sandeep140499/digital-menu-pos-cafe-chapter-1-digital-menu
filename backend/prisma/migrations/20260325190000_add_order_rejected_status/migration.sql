-- Add REJECTED order status for employee "Reject" action.
-- Safe on environments where value may already exist.
ALTER TYPE "OrderStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

