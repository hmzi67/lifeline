-- CreateTable
CREATE TABLE "free_week_claims" (
    "email_hash" VARCHAR(64) NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "free_week_claims_pkey" PRIMARY KEY ("email_hash")
);
