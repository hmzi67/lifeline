-- Protein, carbs and fats (grams) for diet plan meals, and room for longer portion sizes
-- (a 50-character limit made admin saves fail with "value too long").
ALTER TABLE "diet_plan_meals" ADD COLUMN "protein" DOUBLE PRECISION;
ALTER TABLE "diet_plan_meals" ADD COLUMN "carbs" DOUBLE PRECISION;
ALTER TABLE "diet_plan_meals" ADD COLUMN "fats" DOUBLE PRECISION;
ALTER TABLE "diet_plan_meals" ALTER COLUMN "portion_size" TYPE VARCHAR(150);
