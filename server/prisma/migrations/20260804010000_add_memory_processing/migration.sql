-- AddColumn: video background-compression state
ALTER TABLE "Memory" ADD COLUMN "processing" BOOLEAN NOT NULL DEFAULT false;
