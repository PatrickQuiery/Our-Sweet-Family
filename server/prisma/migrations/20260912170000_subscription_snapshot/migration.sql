ALTER TABLE "User" ADD COLUMN "subscriptionSyncedAt" TIMESTAMP(3),
ADD COLUMN "subscriptionManagementUrl" TEXT,
ADD COLUMN "subscriptionSnapshot" JSONB;
