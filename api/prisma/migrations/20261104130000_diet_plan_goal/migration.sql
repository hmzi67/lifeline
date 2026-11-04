-- The goal chosen in the admin for a diet plan, so the app can show it to users with that goal.
ALTER TABLE "diet_plans" ADD COLUMN "goal" VARCHAR(50);
