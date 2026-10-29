-- Fasts are tracked by real timestamps so an overnight fast stays findable the next
-- day, and keep their target so "ended early" survives a reload. Older rows keep
-- using date / time_start / time_end and have a NULL status.
ALTER TABLE "fasting_logs"
ADD COLUMN "started_at" TIMESTAMP(3),
ADD COLUMN "ended_at" TIMESTAMP(3),
ADD COLUMN "target_minutes" INTEGER,
ADD COLUMN "status" VARCHAR(20);

CREATE INDEX "fasting_logs_user_id_status_idx" ON "fasting_logs"("user_id", "status");
