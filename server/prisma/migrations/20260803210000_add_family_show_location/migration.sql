-- AddColumn: owner opt-in to SHOW photo location in the app (capture/storage is
-- always on; this only gates visibility, owner-only even when enabled).
ALTER TABLE "Family" ADD COLUMN "showPhotoLocation" BOOLEAN NOT NULL DEFAULT false;
