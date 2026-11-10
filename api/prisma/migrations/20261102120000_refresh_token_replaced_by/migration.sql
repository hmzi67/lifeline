-- A refreshed token keeps working until its replacement is first used, so a lost
-- refresh reply no longer signs the user out. Existing rows are unaffected (NULL).
ALTER TABLE "refresh_tokens" ADD COLUMN "replaced_by_id" TEXT;
CREATE INDEX "refresh_tokens_replaced_by_id_idx" ON "refresh_tokens"("replaced_by_id");
