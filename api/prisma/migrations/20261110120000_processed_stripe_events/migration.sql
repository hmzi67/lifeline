-- CreateTable
CREATE TABLE "processed_stripe_events" (
    "id" VARCHAR(255) NOT NULL,
    "type" VARCHAR(100) NOT NULL,
    "processed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processed_stripe_events_pkey" PRIMARY KEY ("id")
);

