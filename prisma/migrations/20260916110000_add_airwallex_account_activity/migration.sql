CREATE TABLE "airwallex_account_activity" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3) NOT NULL,
    "transaction_type" TEXT NOT NULL,
    "card" TEXT,
    "card_nick_name" TEXT,
    "account_number" TEXT,
    "account_name" TEXT,
    "where_paid" TEXT,
    "credit" DECIMAL(18,4) NOT NULL,
    "debit" DECIMAL(18,4) NOT NULL,
    "currency" TEXT,
    "ledger_status" TEXT NOT NULL DEFAULT 'Posted',
    "details" TEXT,
    "raw_payload" JSONB NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "airwallex_account_activity_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "airwallex_account_activity_external_id_key"
ON "airwallex_account_activity"("external_id");

CREATE INDEX "airwallex_account_activity_transaction_date_idx"
ON "airwallex_account_activity"("transaction_date");

CREATE INDEX "airwallex_account_activity_card_idx"
ON "airwallex_account_activity"("card");
