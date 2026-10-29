-- Users can report a public challenge; admins review the reports and remove the challenge or dismiss them.
CREATE TABLE "challenge_reports" (
    "id" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "reporter_id" TEXT NOT NULL,
    "reason" VARCHAR(30) NOT NULL,
    "details" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'OPEN',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "challenge_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "challenge_reports_challenge_id_reporter_id_key" ON "challenge_reports"("challenge_id", "reporter_id");

CREATE INDEX "challenge_reports_status_created_at_idx" ON "challenge_reports"("status", "created_at");

ALTER TABLE "challenge_reports" ADD CONSTRAINT "challenge_reports_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "challenge_reports" ADD CONSTRAINT "challenge_reports_reporter_id_fkey" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
