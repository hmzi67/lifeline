-- One-time codes now carry a purpose (verify vs reset), an expiry and a failed-attempt
-- counter. Codes issued before this migration have no expiry and are treated as
-- expired; users request a new one through the existing "Resend" actions.
ALTER TABLE "users"
ADD COLUMN "otp_purpose" VARCHAR(20),
ADD COLUMN "otp_expires_at" TIMESTAMP(3),
ADD COLUMN "otp_attempts" INTEGER NOT NULL DEFAULT 0;
