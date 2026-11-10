-- Food eaten outside a diet plan's meals (barcode scans, photo scans, manual entries),
-- counted in the daily calorie intake.
CREATE TABLE "food_logs" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "meal_type" VARCHAR(50),
    "name" VARCHAR(150) NOT NULL,
    "calories" INTEGER,
    "protein" DOUBLE PRECISION,
    "carbs" DOUBLE PRECISION,
    "fat" DOUBLE PRECISION,
    "source" VARCHAR(20) NOT NULL,
    "barcode" VARCHAR(64),
    "image" TEXT,
    "logged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "food_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "food_logs_user_id_date_idx" ON "food_logs"("user_id", "date");

ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
