-- Sleep logs saved without a length (the app sends only bed/wake times). Fill it in from
-- the times so the progress summary can show hours slept; overnight sleep wraps past midnight.
UPDATE "sleep_logs"
SET "duration_minutes" = (
    (EXTRACT(EPOCH FROM ("time_end"::time - "time_start"::time)) / 60)::int + 1440
) % 1440
WHERE "duration_minutes" IS NULL AND "time_start" IS NOT NULL AND "time_end" IS NOT NULL;
