-- Track whether a memory's capturedAt came from EXIF (then it's read-only).
ALTER TABLE "Memory" ADD COLUMN "dateFromExif" BOOLEAN NOT NULL DEFAULT false;
