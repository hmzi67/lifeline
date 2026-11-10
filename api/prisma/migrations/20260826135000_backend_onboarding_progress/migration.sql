-- Persist onboarding resume state per authenticated user.
CREATE TABLE "onboarding_progress" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_route" VARCHAR(255),
    "pricing_plan_id" VARCHAR(191),
    "is_complete" BOOLEAN NOT NULL DEFAULT false,
    "visited_gender_info" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "onboarding_progress_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "onboarding_progress_user_id_key"
    ON "onboarding_progress"("user_id");

ALTER TABLE "onboarding_progress"
    ADD CONSTRAINT "onboarding_progress_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Preserve completed onboarding for accounts that already received a license
-- before backend route tracking existed.
INSERT INTO "onboarding_progress" (
    "id",
    "user_id",
    "last_route",
    "pricing_plan_id",
    "is_complete",
    "visited_gender_info",
    "completed_at",
    "created_at",
    "updated_at"
)
SELECT
    'legacy_' || "user_id",
    "user_id",
    NULL,
    NULL,
    true,
    true,
    COALESCE(MAX("created_at"), CURRENT_TIMESTAMP),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "user_licenses"
WHERE "user_id" IS NOT NULL
GROUP BY "user_id"
ON CONFLICT ("user_id") DO NOTHING;
