-- CreateIndex
CREATE INDEX "auth_tokens_user_id_idx" ON "auth_tokens"("user_id");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "oauth_login_codes_user_id_idx" ON "oauth_login_codes"("user_id");

-- CreateIndex
CREATE INDEX "subscription_payments_user_id_idx" ON "subscription_payments"("user_id");

-- CreateIndex
CREATE INDEX "subscription_payments_stripe_payment_intent_id_idx" ON "subscription_payments"("stripe_payment_intent_id");

-- CreateIndex
CREATE INDEX "subscription_payments_stripe_setup_intent_id_idx" ON "subscription_payments"("stripe_setup_intent_id");

-- CreateIndex
CREATE INDEX "user_licenses_user_id_idx" ON "user_licenses"("user_id");

-- CreateIndex
CREATE INDEX "user_licenses_payment_id_idx" ON "user_licenses"("payment_id");

-- CreateIndex
CREATE INDEX "questionnaires_user_id_idx" ON "questionnaires"("user_id");

-- CreateIndex
CREATE INDEX "user_diet_plans_user_id_idx" ON "user_diet_plans"("user_id");

-- CreateIndex
CREATE INDEX "diet_plan_days_diet_id_idx" ON "diet_plan_days"("diet_id");

-- CreateIndex
CREATE INDEX "diet_plan_meals_day_id_idx" ON "diet_plan_meals"("day_id");

-- CreateIndex
CREATE INDEX "user_exercises_user_id_idx" ON "user_exercises"("user_id");

-- CreateIndex
CREATE INDEX "exercise_plan_weeks_plan_id_idx" ON "exercise_plan_weeks"("plan_id");

-- CreateIndex
CREATE INDEX "exercise_plan_schedule_week_id_idx" ON "exercise_plan_schedule"("week_id");

-- CreateIndex
CREATE INDEX "user_active_exercise_plan_user_id_idx" ON "user_active_exercise_plan"("user_id");

-- CreateIndex
CREATE INDEX "exercise_details_exercise_id_idx" ON "exercise_details"("exercise_id");

-- CreateIndex
CREATE INDEX "user_exercise_progress_user_id_idx" ON "user_exercise_progress"("user_id");

-- CreateIndex
CREATE INDEX "challenges_submitted_by_id_idx" ON "challenges"("submitted_by_id");

-- CreateIndex
CREATE INDEX "challenge_fees_user_id_idx" ON "challenge_fees"("user_id");

-- CreateIndex
CREATE INDEX "challenge_fees_challenge_id_idx" ON "challenge_fees"("challenge_id");

-- CreateIndex
CREATE INDEX "user_challenges_user_id_idx" ON "user_challenges"("user_id");

-- CreateIndex
CREATE INDEX "user_challenges_challenge_id_idx" ON "user_challenges"("challenge_id");

-- CreateIndex
CREATE INDEX "cheat_days_user_id_idx" ON "cheat_days"("user_id");

-- CreateIndex
CREATE INDEX "sleep_logs_user_id_idx" ON "sleep_logs"("user_id");

-- CreateIndex
CREATE INDEX "user_water_goal_user_id_idx" ON "user_water_goal"("user_id");

-- CreateIndex
CREATE INDEX "water_intake_logs_user_id_idx" ON "water_intake_logs"("user_id");

-- CreateIndex
CREATE INDEX "medications_user_id_idx" ON "medications"("user_id");

-- CreateIndex
CREATE INDEX "medication_reminders_user_id_idx" ON "medication_reminders"("user_id");

-- CreateIndex
CREATE INDEX "medication_reminders_medication_id_idx" ON "medication_reminders"("medication_id");

-- CreateIndex
CREATE INDEX "meditation_sessions_meditation_id_idx" ON "meditation_sessions"("meditation_id");

-- CreateIndex
CREATE INDEX "user_favorite_meditations_user_id_idx" ON "user_favorite_meditations"("user_id");

-- CreateIndex
CREATE INDEX "user_daily_routine_user_id_idx" ON "user_daily_routine"("user_id");

-- CreateIndex
CREATE INDEX "blog_comments_user_id_idx" ON "blog_comments"("user_id");

-- CreateIndex
CREATE INDEX "blog_comments_blog_id_idx" ON "blog_comments"("blog_id");

-- CreateIndex
CREATE INDEX "blog_comments_parent_id_idx" ON "blog_comments"("parent_id");

-- CreateIndex
CREATE INDEX "coupon_usages_user_id_idx" ON "coupon_usages"("user_id");

-- CreateIndex
CREATE INDEX "referral_usages_user_id_idx" ON "referral_usages"("user_id");

