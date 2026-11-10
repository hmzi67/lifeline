-- When a challenge was added, so the app can badge recent ones as "New".
-- Existing rows stay NULL (age unknown) instead of all looking brand new;
-- the default applies only to rows inserted from now on.
ALTER TABLE "challenges"
ADD COLUMN "created_at" TIMESTAMP(3);

ALTER TABLE "challenges"
ALTER COLUMN "created_at" SET DEFAULT CURRENT_TIMESTAMP;
