-- AlterTable
ALTER TABLE "challenges" ADD COLUMN "entry_fee" DECIMAL(10,2);

-- Existing paid challenges keep what they cost: daily fee x days.
UPDATE "challenges"
SET "entry_fee" = ROUND("daily_fee" * "duration_days", 2)
WHERE "daily_fee" > 0 AND "duration_days" > 0;
