ALTER TABLE "pricing_plans"
ADD COLUMN "apple_product_id" VARCHAR(255);

-- Give the first plan for each duration a stable App Store product identifier.
-- Additional plans with the same duration remain unassigned until an admin gives
-- them a distinct product in App Store Connect and updates appleProductId.
WITH ranked_plans AS (
  SELECT
    "id",
    "duration_months",
    ROW_NUMBER() OVER (
      PARTITION BY "duration_months"
      ORDER BY "is_active" DESC, "sort_order" ASC, "created_at" ASC, "id" ASC
    ) AS rank
  FROM "pricing_plans"
)
UPDATE "pricing_plans" AS plan
SET "apple_product_id" = CASE ranked."duration_months"
  WHEN 1 THEN 'com.irtaza.lifeline.vip.monthly'
  WHEN 2 THEN 'com.irtaza.lifeline.vip.bimonthly'
  WHEN 3 THEN 'com.irtaza.lifeline.vip.quarterly'
  WHEN 6 THEN 'com.irtaza.lifeline.vip.semiannual'
  WHEN 12 THEN 'com.irtaza.lifeline.vip.annual'
  ELSE NULL
END
FROM ranked_plans AS ranked
WHERE plan."id" = ranked."id"
  AND ranked.rank = 1
  AND ranked."duration_months" IN (1, 2, 3, 6, 12);

CREATE UNIQUE INDEX "pricing_plans_apple_product_id_key"
ON "pricing_plans"("apple_product_id");

ALTER TABLE "subscription_payments"
ADD COLUMN "app_store_entitlement_key" VARCHAR(255),
ADD COLUMN "store_product_id" VARCHAR(255),
ADD COLUMN "store_environment" VARCHAR(20);

CREATE UNIQUE INDEX "subscription_payments_app_store_entitlement_key_key"
ON "subscription_payments"("app_store_entitlement_key");

ALTER TABLE "user_licenses"
ADD COLUMN "app_store_entitlement_key" VARCHAR(255);

CREATE UNIQUE INDEX "user_licenses_app_store_entitlement_key_key"
ON "user_licenses"("app_store_entitlement_key");
