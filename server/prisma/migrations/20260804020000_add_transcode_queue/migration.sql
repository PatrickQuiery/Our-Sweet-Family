-- CreateTable: durable video transcode queue
CREATE TABLE "TranscodeJob" (
    "id" TEXT NOT NULL,
    "memoryId" TEXT NOT NULL,
    "sourceKey" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    CONSTRAINT "TranscodeJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TranscodeJob_status_createdAt_idx" ON "TranscodeJob"("status", "createdAt");
