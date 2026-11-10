-- AlterTable
ALTER TABLE "users" ADD COLUMN     "password_reset_failed_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "password_reset_last_sent_at" TIMESTAMP(3),
ADD COLUMN     "password_reset_sent_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "password_reset_window_start" TIMESTAMP(3);

