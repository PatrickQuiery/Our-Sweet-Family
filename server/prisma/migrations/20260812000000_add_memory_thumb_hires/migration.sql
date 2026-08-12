-- Marks whether a memory's thumbnail has been (re)generated at the current
-- hi-res (800px) size. Existing rows default to false so the boot backfill
-- picks them up and regenerates the old 400px thumbnails.
ALTER TABLE "Memory" ADD COLUMN "thumbHiRes" BOOLEAN NOT NULL DEFAULT false;
