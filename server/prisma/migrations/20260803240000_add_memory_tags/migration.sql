-- AddColumn: free-text tags for search/filtering
ALTER TABLE "Memory" ADD COLUMN "tags" JSONB NOT NULL DEFAULT '[]';
