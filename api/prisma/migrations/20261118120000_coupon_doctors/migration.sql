-- DropIndex
DROP INDEX "coupon_usages_coupon_id_user_id_key";

-- AlterTable
ALTER TABLE "coupon_codes" ADD COLUMN     "doctor_id" TEXT,
ADD COLUMN     "max_uses_per_user" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "doctors" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "clinic" VARCHAR(160),
    "phone" VARCHAR(40),
    "email" VARCHAR(255),
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "doctors_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "coupon_codes_doctor_id_idx" ON "coupon_codes"("doctor_id");

-- CreateIndex
CREATE INDEX "coupon_usages_coupon_id_user_id_idx" ON "coupon_usages"("coupon_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "coupon_usages_coupon_id_payment_id_key" ON "coupon_usages"("coupon_id", "payment_id");

-- AddForeignKey
ALTER TABLE "coupon_codes" ADD CONSTRAINT "coupon_codes_doctor_id_fkey" FOREIGN KEY ("doctor_id") REFERENCES "doctors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

