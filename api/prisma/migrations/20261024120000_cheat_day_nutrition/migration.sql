-- Cheat-day meals keep the calories and macros the user enters (Add Manually / barcode),
-- so the Cheat Day screen can show them instead of 0.
ALTER TABLE "cheat_days" ADD COLUMN "calories" INTEGER;
ALTER TABLE "cheat_days" ADD COLUMN "protein" DOUBLE PRECISION;
ALTER TABLE "cheat_days" ADD COLUMN "carbs" DOUBLE PRECISION;
ALTER TABLE "cheat_days" ADD COLUMN "fat" DOUBLE PRECISION;
