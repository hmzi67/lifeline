-- Paid challenges: joiners pay daily_fee x duration_days (NULL fee = free).
ALTER TABLE "challenges"
ADD COLUMN "duration_days" INTEGER,
ADD COLUMN "daily_fee" DECIMAL(10,2);

-- provider_reference is the Stripe PaymentIntent or App Store transaction ID; unique so
-- one payment can never unlock two joins.
ALTER TABLE "challenge_fees"
ADD COLUMN "provider_reference" VARCHAR(255),
ADD COLUMN "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "paid_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "challenge_fees_provider_reference_key" ON "challenge_fees"("provider_reference");
