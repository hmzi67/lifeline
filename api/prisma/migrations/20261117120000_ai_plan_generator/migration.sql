-- AlterTable
ALTER TABLE "diet_plans" ADD COLUMN     "ai_batch_id" TEXT,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'published';

-- AlterTable
ALTER TABLE "exercises" ADD COLUMN     "ai_batch_id" TEXT,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'published',
ADD COLUMN     "tags" JSONB;

-- AlterTable
ALTER TABLE "exercise_plans" ADD COLUMN     "ai_batch_id" TEXT,
ADD COLUMN     "status" VARCHAR(20) NOT NULL DEFAULT 'published';

-- CreateTable
CREATE TABLE "ai_generation_batches" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "media_source" VARCHAR(20) NOT NULL,
    "settings" JSONB NOT NULL,
    "plan_count" INTEGER NOT NULL,
    "cost_cap_usd" DOUBLE PRECISION,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "finished_at" TIMESTAMP(3),

    CONSTRAINT "ai_generation_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_generation_jobs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'queued',
    "spec" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "result_plan_id" TEXT,
    "cost_usd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "log" JSONB NOT NULL DEFAULT '[]',
    "error_message" TEXT,
    "review_data" JSONB NOT NULL DEFAULT '{}',
    "locked_at" TIMESTAMP(3),
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_generation_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ai_generation_batches_created_at_idx" ON "ai_generation_batches"("created_at");

-- CreateIndex
CREATE INDEX "ai_generation_jobs_status_created_at_idx" ON "ai_generation_jobs"("status", "created_at");

-- CreateIndex
CREATE INDEX "ai_generation_jobs_batch_id_position_idx" ON "ai_generation_jobs"("batch_id", "position");

-- CreateIndex
CREATE INDEX "diet_plans_status_idx" ON "diet_plans"("status");

-- CreateIndex
CREATE INDEX "exercises_status_idx" ON "exercises"("status");

-- CreateIndex
CREATE INDEX "exercise_plans_status_idx" ON "exercise_plans"("status");

-- AddForeignKey
ALTER TABLE "diet_plans" ADD CONSTRAINT "diet_plans_ai_batch_id_fkey" FOREIGN KEY ("ai_batch_id") REFERENCES "ai_generation_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_ai_batch_id_fkey" FOREIGN KEY ("ai_batch_id") REFERENCES "ai_generation_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exercise_plans" ADD CONSTRAINT "exercise_plans_ai_batch_id_fkey" FOREIGN KEY ("ai_batch_id") REFERENCES "ai_generation_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_batches" ADD CONSTRAINT "ai_generation_batches_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_generation_jobs" ADD CONSTRAINT "ai_generation_jobs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ai_generation_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

