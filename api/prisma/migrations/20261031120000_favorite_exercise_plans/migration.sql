-- Exercise plans a user has hearted on the Exercise tab (previously kept only on the device).
CREATE TABLE "user_favorite_exercise_plans" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "plan_id" TEXT NOT NULL,
    "favorited_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_favorite_exercise_plans_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_favorite_exercise_plans_user_id_plan_id_key" ON "user_favorite_exercise_plans"("user_id", "plan_id");
CREATE INDEX "user_favorite_exercise_plans_user_id_idx" ON "user_favorite_exercise_plans"("user_id");

ALTER TABLE "user_favorite_exercise_plans" ADD CONSTRAINT "user_favorite_exercise_plans_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_favorite_exercise_plans" ADD CONSTRAINT "user_favorite_exercise_plans_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "exercise_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
