-- A user follows one diet plan at a time. Starting another ends (deactivates) the old one
-- instead of deleting it, so its meal logs stay as history.
ALTER TABLE "user_active_diet_plan" ADD COLUMN "ended_at" TIMESTAMP(3);

-- Users who already have more than one plan keep only their most recently started one.
UPDATE "user_active_diet_plan" AS p
SET "ended_at" = NOW()
WHERE p."id" IN (
    SELECT "id" FROM (
        SELECT "id",
               ROW_NUMBER() OVER (PARTITION BY "user_id" ORDER BY "started_at" DESC, "id" DESC) AS rn
        FROM "user_active_diet_plan"
    ) ranked
    WHERE ranked.rn > 1
);

CREATE INDEX "user_active_diet_plan_user_id_ended_at_idx" ON "user_active_diet_plan"("user_id", "ended_at");

-- At most one open plan per user (Prisma can't express partial indexes; enforced here).
CREATE UNIQUE INDEX "user_active_diet_plan_one_open_per_user" ON "user_active_diet_plan"("user_id") WHERE "ended_at" IS NULL;
