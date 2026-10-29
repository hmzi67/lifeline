-- The name people type at sign-up. It used to be stored as the unique username, so two
-- people with the same name could not both sign up. Existing users keep what they had.
ALTER TABLE "users" ADD COLUMN "display_name" VARCHAR(100);

UPDATE "users" SET "display_name" = "username" WHERE "display_name" IS NULL;
