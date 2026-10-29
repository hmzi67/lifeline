-- Per-user challenge completion (a challenge's own status is set by admins for everyone).
ALTER TABLE "user_challenges" ADD COLUMN "completed_at" TIMESTAMP(3);

-- Medication taken/skipped per day; days with no row count as missed.
CREATE TABLE "medication_intakes" (
    "id" TEXT NOT NULL,
    "medication_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" VARCHAR(10) NOT NULL,
    "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "medication_intakes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "medication_intakes_medication_id_date_key" ON "medication_intakes"("medication_id", "date");
CREATE INDEX "medication_intakes_user_id_date_idx" ON "medication_intakes"("user_id", "date");
ALTER TABLE "medication_intakes" ADD CONSTRAINT "medication_intakes_medication_id_fkey" FOREIGN KEY ("medication_id") REFERENCES "medications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "medication_intakes" ADD CONSTRAINT "medication_intakes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Weight history, one reading per user per day.
CREATE TABLE "weight_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "unit" VARCHAR(10),
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "weight_logs_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "weight_logs_user_id_date_key" ON "weight_logs"("user_id", "date");
ALTER TABLE "weight_logs" ADD CONSTRAINT "weight_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
