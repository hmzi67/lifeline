-- Single-use codes for the web Google/Apple sign-in hand-off, so the callback
-- redirect never carries an access or refresh token in its URL.
CREATE TABLE "oauth_login_codes" (
    "id" TEXT NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "binding_hash" VARCHAR(64) NOT NULL,
    "user_id" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_login_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "oauth_login_codes_code_hash_key" ON "oauth_login_codes"("code_hash");

CREATE INDEX "oauth_login_codes_expires_at_idx" ON "oauth_login_codes"("expires_at");

ALTER TABLE "oauth_login_codes" ADD CONSTRAINT "oauth_login_codes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
