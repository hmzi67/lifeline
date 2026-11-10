-- StoreKit 2 purchases are verified directly against Apple (no RevenueCat).
-- Each user gets a UUID that the app passes to StoreKit as appAccountToken so
-- signed transactions and App Store Server Notifications can be tied to them.
ALTER TABLE "users"
ADD COLUMN "app_store_account_token" VARCHAR(36);

CREATE UNIQUE INDEX "users_app_store_account_token_key"
ON "users"("app_store_account_token");

-- One Apple subscription (original transaction) can grant access to only one
-- Lifeline account.
ALTER TABLE "subscription_payments"
ADD COLUMN "app_store_original_transaction_id" VARCHAR(64);

CREATE UNIQUE INDEX "subscription_payments_app_store_original_transaction_id_key"
ON "subscription_payments"("app_store_original_transaction_id");
