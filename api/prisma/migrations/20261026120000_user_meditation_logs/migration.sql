-- Every meditation a user finishes. The daily routine keeps only the last one of the day,
-- so this is the history behind "recently finished".
CREATE TABLE "user_meditation_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "meditation_id" TEXT NOT NULL,
    "duration_seconds" INTEGER,
    "completed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_meditation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "user_meditation_logs_user_id_completed_at_idx" ON "user_meditation_logs"("user_id", "completed_at");

ALTER TABLE "user_meditation_logs" ADD CONSTRAINT "user_meditation_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_meditation_logs" ADD CONSTRAINT "user_meditation_logs_meditation_id_fkey" FOREIGN KEY ("meditation_id") REFERENCES "meditations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
