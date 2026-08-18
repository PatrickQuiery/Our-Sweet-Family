-- Billing metadata synced from RevenueCat. "plan" remains the authoritative gate.
ALTER TABLE "User" ADD COLUMN "subscriptionStatus" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionStore" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionProductId" TEXT;
ALTER TABLE "User" ADD COLUMN "subscriptionExpiresAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "subscriptionWillRenew" BOOLEAN;
