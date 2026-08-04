-- AddColumn: reverse-geocoded place (City, State), computed once at upload.
ALTER TABLE "Memory" ADD COLUMN "locationCity" TEXT;
ALTER TABLE "Memory" ADD COLUMN "locationState" TEXT;
