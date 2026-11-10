-- Sign in with Apple refresh token, kept so it can be revoked when the account is deleted.
ALTER TABLE "users" ADD COLUMN "apple_refresh_token" TEXT;
ALTER TABLE "users" ADD COLUMN "apple_client_id" VARCHAR(255);
