-- Date and time a challenge starts. User-submitted challenges carry a start
-- time; startDate (date only) stays for admin-scheduled multi-day challenges.
ALTER TABLE "challenges"
ADD COLUMN "scheduled_at" TIMESTAMP(3);
