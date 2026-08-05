-- CreateTable: push-notification device tokens (one row per device, Expo push)
CREATE TABLE "DeviceToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DeviceToken_token_key" ON "DeviceToken"("token");
CREATE INDEX "DeviceToken_userId_idx" ON "DeviceToken"("userId");

ALTER TABLE "DeviceToken"
    ADD CONSTRAINT "DeviceToken_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Memory: client-supplied asset id for background-upload dedupe (unique per family;
-- Postgres treats NULLs as distinct, so manually-uploaded memories never collide).
ALTER TABLE "Memory" ADD COLUMN "clientAssetId" TEXT;
CREATE UNIQUE INDEX "Memory_familyId_clientAssetId_key" ON "Memory"("familyId", "clientAssetId");
