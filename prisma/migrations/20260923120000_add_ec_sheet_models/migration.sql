-- CreateTable
CREATE TABLE "ec_sheet_import_runs" (
    "id" TEXT NOT NULL,
    "spreadsheet_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "inserted_rows" INTEGER NOT NULL DEFAULT 0,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "cogs_count" INTEGER NOT NULL DEFAULT 0,
    "ads_count" INTEGER NOT NULL DEFAULT 0,
    "payouts_count" INTEGER NOT NULL DEFAULT 0,
    "checksums" JSONB,
    "sheet_stats" JSONB,
    "error_message" TEXT,
    "error_details" JSONB,
    "actor" TEXT,

    CONSTRAINT "ec_sheet_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_sheet_active_snapshots" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "active_run_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ec_sheet_active_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_sheet_orders" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT 'EC',
    "month" VARCHAR(7) NOT NULL,
    "source_row" INTEGER NOT NULL,
    "order_name" VARCHAR(100) NOT NULL,
    "order_date" DATE NOT NULL,
    "gross_sales" DECIMAL(18,4) NOT NULL,
    "discounts" DECIMAL(18,4) NOT NULL,
    "shipping_charged" DECIMAL(18,4) NOT NULL,
    "original_tax" DECIMAL(18,4) NOT NULL,
    "corrected_net" DECIMAL(18,4) NOT NULL,
    "refund_snapshot" DECIMAL(18,4) NOT NULL,
    "before_refund" DECIMAL(18,4) NOT NULL,
    "source" VARCHAR(50),
    "item_name" TEXT,
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ec_sheet_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_sheet_cogs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT 'EC',
    "month" VARCHAR(7) NOT NULL,
    "source_row" INTEGER NOT NULL,
    "supplier" VARCHAR(100) NOT NULL,
    "cost_date" DATE NOT NULL,
    "reference_order_id" VARCHAR(100),
    "items_name" TEXT,
    "supplier_order_id" VARCHAR(100),
    "total_cost" DECIMAL(18,4) NOT NULL,
    "estimated_cost" DECIMAL(18,4) NOT NULL,
    "row_key" VARCHAR(200) NOT NULL,
    "treatment" VARCHAR(100) NOT NULL,
    "source" VARCHAR(50),
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ec_sheet_cogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_sheet_ads" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT 'EC',
    "month" VARCHAR(7) NOT NULL,
    "source_row" INTEGER NOT NULL,
    "external_id" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "campaign_id" VARCHAR(100),
    "campaign_name" TEXT,
    "currency" VARCHAR(10) NOT NULL,
    "spend" DECIMAL(18,4) NOT NULL,
    "granularity" VARCHAR(50) NOT NULL,
    "source" VARCHAR(50),
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ec_sheet_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ec_sheet_payouts" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "shop" TEXT NOT NULL DEFAULT 'EC',
    "month_local" VARCHAR(7) NOT NULL,
    "source_row" INTEGER NOT NULL,
    "balance_transaction_id" VARCHAR(100) NOT NULL,
    "payout_id" VARCHAR(100),
    "type" VARCHAR(50) NOT NULL,
    "currency" VARCHAR(10) NOT NULL,
    "gross" DECIMAL(18,4) NOT NULL,
    "fee" DECIMAL(18,4) NOT NULL,
    "net" DECIMAL(18,4) NOT NULL,
    "processed_utc" TIMESTAMP(3) NOT NULL,
    "processed_gmt7" VARCHAR(30) NOT NULL,
    "processed_vietnam" VARCHAR(30) NOT NULL,
    "reason" TEXT,
    "source_id" VARCHAR(100),
    "order_id" VARCHAR(100),
    "source" VARCHAR(50),
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ec_sheet_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ec_sheet_import_runs_started_at_idx" ON "ec_sheet_import_runs"("started_at");

-- CreateIndex
CREATE INDEX "ec_sheet_import_runs_status_idx" ON "ec_sheet_import_runs"("status");

-- CreateIndex
CREATE INDEX "ec_sheet_orders_batch_id_month_idx" ON "ec_sheet_orders"("batch_id", "month");

-- CreateIndex
CREATE INDEX "ec_sheet_orders_batch_id_order_date_idx" ON "ec_sheet_orders"("batch_id", "order_date");

-- CreateIndex
CREATE UNIQUE INDEX "ec_sheet_orders_batch_id_shop_order_name_key" ON "ec_sheet_orders"("batch_id", "shop", "order_name");

-- CreateIndex
CREATE INDEX "ec_sheet_cogs_batch_id_month_supplier_idx" ON "ec_sheet_cogs"("batch_id", "month", "supplier");

-- CreateIndex
CREATE INDEX "ec_sheet_cogs_batch_id_cost_date_idx" ON "ec_sheet_cogs"("batch_id", "cost_date");

-- CreateIndex
CREATE UNIQUE INDEX "ec_sheet_cogs_batch_id_shop_row_key_key" ON "ec_sheet_cogs"("batch_id", "shop", "row_key");

-- CreateIndex
CREATE INDEX "ec_sheet_ads_batch_id_account_id_date_idx" ON "ec_sheet_ads"("batch_id", "account_id", "date");

-- CreateIndex
CREATE INDEX "ec_sheet_ads_batch_id_month_idx" ON "ec_sheet_ads"("batch_id", "month");

-- CreateIndex
CREATE UNIQUE INDEX "ec_sheet_ads_batch_id_shop_external_id_key" ON "ec_sheet_ads"("batch_id", "shop", "external_id");

-- CreateIndex
CREATE INDEX "ec_sheet_payouts_batch_id_month_local_type_idx" ON "ec_sheet_payouts"("batch_id", "month_local", "type");

-- CreateIndex
CREATE INDEX "ec_sheet_payouts_batch_id_processed_utc_idx" ON "ec_sheet_payouts"("batch_id", "processed_utc");

-- CreateIndex
CREATE UNIQUE INDEX "ec_sheet_payouts_batch_id_shop_balance_transaction_id_key" ON "ec_sheet_payouts"("batch_id", "shop", "balance_transaction_id");

-- AddForeignKey
ALTER TABLE "ec_sheet_active_snapshots" ADD CONSTRAINT "ec_sheet_active_snapshots_active_run_id_fkey" FOREIGN KEY ("active_run_id") REFERENCES "ec_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_sheet_orders" ADD CONSTRAINT "ec_sheet_orders_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ec_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_sheet_cogs" ADD CONSTRAINT "ec_sheet_cogs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ec_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_sheet_ads" ADD CONSTRAINT "ec_sheet_ads_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ec_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ec_sheet_payouts" ADD CONSTRAINT "ec_sheet_payouts_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "ec_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
