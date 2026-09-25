-- CreateTable
CREATE TABLE "microm_source_sync_runs" (
    "id" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "trigger_type" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "window_start" TIMESTAMP(3),
    "window_end" TIMESTAMP(3),
    "sources" JSONB,
    "per_tab_fingerprints" JSONB,
    "is_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "error_message" TEXT,
    "error_details" JSONB,
    "actor" VARCHAR(100),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microm_source_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microm_sheet_import_runs" (
    "id" TEXT NOT NULL,
    "spreadsheet_id" VARCHAR(100) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'RUNNING',
    "trigger_type" VARCHAR(20) NOT NULL DEFAULT 'MANUAL',
    "error_category" VARCHAR(50),
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "heartbeat_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "inserted_rows" INTEGER NOT NULL DEFAULT 0,
    "orders_count" INTEGER NOT NULL DEFAULT 0,
    "cogs_count" INTEGER NOT NULL DEFAULT 0,
    "ads_count" INTEGER NOT NULL DEFAULT 0,
    "items_count" INTEGER NOT NULL DEFAULT 0,
    "checksums" JSONB,
    "sheet_stats" JSONB,
    "source_sync_run_id" VARCHAR(50),
    "provider_reconciled" BOOLEAN NOT NULL DEFAULT false,
    "manual_edit_acknowledged" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgement_reason" TEXT,
    "error_message" TEXT,
    "error_details" JSONB,
    "actor" VARCHAR(100),

    CONSTRAINT "microm_sheet_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microm_sheet_import_locks" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "locked_by" VARCHAR(100),
    "locked_at" TIMESTAMP(3),
    "heartbeat_at" TIMESTAMP(3),

    CONSTRAINT "microm_sheet_import_locks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microm_sheet_active_snapshots" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "active_run_id" TEXT NOT NULL,
    "last_checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "microm_sheet_active_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microm_sheet_orders" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "source_row" INTEGER NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "shopify_id" VARCHAR(100) NOT NULL,
    "order_date" DATE NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "financial_status" VARCHAR(50) NOT NULL,
    "fulfillment_status" VARCHAR(50),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
    "subtotal" DECIMAL(18,4) NOT NULL,
    "discount" DECIMAL(18,4) NOT NULL,
    "shipping" DECIMAL(18,4) NOT NULL,
    "tax" DECIMAL(18,4) NOT NULL,
    "gross_order" DECIMAL(18,4) NOT NULL,
    "eligible_revenue_eur" DECIMAL(18,4) NOT NULL,
    "fx_rate" DECIMAL(8,4) NOT NULL DEFAULT 1.15,
    "eligible_revenue_usd_calc" DECIMAL(18,4) NOT NULL,
    "gross_order_usd_calc" DECIMAL(18,4) NOT NULL,
    "source_line" VARCHAR(100),
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microm_sheet_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microm_sheet_cogs" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "source_row" INTEGER NOT NULL,
    "pgprint_order_id" VARCHAR(100) NOT NULL,
    "pgc_order_id" VARCHAR(100),
    "customer_order_id" VARCHAR(100),
    "cost_date" DATE NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "source_status" VARCHAR(50),
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "production" DECIMAL(18,4) NOT NULL,
    "shipping" DECIMAL(18,4) NOT NULL,
    "cogs_source_usd" DECIMAL(18,4) NOT NULL,
    "eligible_cogs_usd" DECIMAL(18,4) NOT NULL,
    "source_line" VARCHAR(100),
    "control_note" TEXT,
    "row_key" VARCHAR(200) NOT NULL,
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microm_sheet_cogs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microm_sheet_ads" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "source_row" INTEGER NOT NULL,
    "account_name" VARCHAR(100) NOT NULL,
    "account_id" VARCHAR(100) NOT NULL,
    "date" DATE NOT NULL,
    "period" VARCHAR(7) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'USD',
    "spend_usd" DECIMAL(18,4) NOT NULL,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "purchases" INTEGER NOT NULL DEFAULT 0,
    "source_line" VARCHAR(100),
    "control_note" TEXT,
    "row_key" VARCHAR(200) NOT NULL,
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microm_sheet_ads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "microm_sheet_shopify_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "source_row" INTEGER NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "line_item_id" VARCHAR(100) NOT NULL,
    "product_name" TEXT NOT NULL,
    "sku" VARCHAR(100),
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "line_total" DECIMAL(18,4) NOT NULL,
    "currency" VARCHAR(10) NOT NULL DEFAULT 'EUR',
    "fulfillment" VARCHAR(50),
    "source_line" VARCHAR(100),
    "raw_values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "microm_sheet_shopify_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "microm_source_sync_runs_started_at_idx" ON "microm_source_sync_runs"("started_at");
CREATE INDEX "microm_source_sync_runs_status_idx" ON "microm_source_sync_runs"("status");
CREATE INDEX "microm_source_sync_runs_trigger_type_idx" ON "microm_source_sync_runs"("trigger_type");

-- CreateIndex
CREATE INDEX "microm_sheet_import_runs_started_at_idx" ON "microm_sheet_import_runs"("started_at");
CREATE INDEX "microm_sheet_import_runs_status_idx" ON "microm_sheet_import_runs"("status");
CREATE INDEX "microm_sheet_import_runs_trigger_type_idx" ON "microm_sheet_import_runs"("trigger_type");

-- CreateIndex
CREATE UNIQUE INDEX "microm_sheet_orders_batch_id_shopify_id_key" ON "microm_sheet_orders"("batch_id", "shopify_id");
CREATE INDEX "microm_sheet_orders_batch_id_period_idx" ON "microm_sheet_orders"("batch_id", "period");
CREATE INDEX "microm_sheet_orders_batch_id_order_date_idx" ON "microm_sheet_orders"("batch_id", "order_date");
CREATE INDEX "microm_sheet_orders_batch_id_order_id_idx" ON "microm_sheet_orders"("batch_id", "order_id");

-- CreateIndex
CREATE UNIQUE INDEX "microm_sheet_cogs_batch_id_row_key_key" ON "microm_sheet_cogs"("batch_id", "row_key");
CREATE INDEX "microm_sheet_cogs_batch_id_period_idx" ON "microm_sheet_cogs"("batch_id", "period");
CREATE INDEX "microm_sheet_cogs_batch_id_cost_date_idx" ON "microm_sheet_cogs"("batch_id", "cost_date");
CREATE INDEX "microm_sheet_cogs_batch_id_customer_order_id_idx" ON "microm_sheet_cogs"("batch_id", "customer_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "microm_sheet_ads_batch_id_row_key_key" ON "microm_sheet_ads"("batch_id", "row_key");
CREATE INDEX "microm_sheet_ads_batch_id_period_idx" ON "microm_sheet_ads"("batch_id", "period");
CREATE INDEX "microm_sheet_ads_batch_id_account_id_date_idx" ON "microm_sheet_ads"("batch_id", "account_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "microm_sheet_shopify_items_batch_id_line_item_id_key" ON "microm_sheet_shopify_items"("batch_id", "line_item_id");
CREATE INDEX "microm_sheet_shopify_items_batch_id_order_id_idx" ON "microm_sheet_shopify_items"("batch_id", "order_id");

-- AddForeignKey
ALTER TABLE "microm_sheet_active_snapshots" ADD CONSTRAINT "microm_sheet_active_snapshots_active_run_id_fkey" FOREIGN KEY ("active_run_id") REFERENCES "microm_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microm_sheet_orders" ADD CONSTRAINT "microm_sheet_orders_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "microm_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microm_sheet_cogs" ADD CONSTRAINT "microm_sheet_cogs_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "microm_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microm_sheet_ads" ADD CONSTRAINT "microm_sheet_ads_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "microm_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "microm_sheet_shopify_items" ADD CONSTRAINT "microm_sheet_shopify_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "microm_sheet_import_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
