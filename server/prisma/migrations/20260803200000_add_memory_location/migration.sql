-- AddColumn: EXIF GPS (owner-only; never exposed to members or in the feed)
ALTER TABLE "Memory" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Memory" ADD COLUMN "longitude" DOUBLE PRECISION;
