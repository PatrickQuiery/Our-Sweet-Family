-- AddColumn: searchable, space-joined tag text for fuzzy (substring) filtering
ALTER TABLE "Memory" ADD COLUMN "tagsText" TEXT;

-- Backfill from existing JSONB tags
UPDATE "Memory" m
SET "tagsText" = sub.txt
FROM (
  SELECT id, lower(string_agg(value, ' ')) AS txt
  FROM "Memory", jsonb_array_elements_text("tags") AS value
  GROUP BY id
) sub
WHERE m.id = sub.id;
