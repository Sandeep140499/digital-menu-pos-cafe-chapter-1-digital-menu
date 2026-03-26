-- Persist "Clear all notifications" across devices (per admin).
ALTER TABLE "Admin"
ADD COLUMN IF NOT EXISTS "notificationsClearedAt" TIMESTAMP(3);

