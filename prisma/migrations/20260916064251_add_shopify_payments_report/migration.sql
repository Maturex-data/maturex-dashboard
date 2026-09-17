-- CreateTable
CREATE TABLE "shopify_payment_records" (
    "id" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "record_type" TEXT NOT NULL,
    "transaction_date" TIMESTAMP(3),
    "currency" TEXT,
    "gross_amount" DECIMAL(18,4),
    "fee_amount" DECIMAL(18,4),
    "net_amount" DECIMAL(18,4),
    "payout_id" TEXT,
    "payout_status" TEXT,
    "source_type" TEXT,
    "source_order_id" TEXT,
    "source_order_name" TEXT,
    "reason" TEXT,
    "payload" JSONB NOT NULL,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shopify_payment_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_payment_sync_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "shopify_payment_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "shopify_payment_records_external_id_key" ON "shopify_payment_records"("external_id");

-- CreateIndex
CREATE INDEX "shopify_payment_records_record_type_transaction_date_idx" ON "shopify_payment_records"("record_type", "transaction_date");

-- CreateIndex
CREATE INDEX "shopify_payment_records_payout_id_idx" ON "shopify_payment_records"("payout_id");

-- CreateIndex
CREATE INDEX "shopify_payment_sync_runs_started_at_idx" ON "shopify_payment_sync_runs"("started_at");
