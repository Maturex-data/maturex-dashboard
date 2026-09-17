-- CreateTable
CREATE TABLE "cogs_records" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "reference_order_id" TEXT,
    "supplier_order_id" TEXT,
    "total_cost" DECIMAL(18,4) NOT NULL,
    "estimated_cost" DECIMAL(18,4) NOT NULL,
    "item_key" TEXT NOT NULL,
    "source_record_id" TEXT,
    "mapping_status" TEXT NOT NULL DEFAULT 'MATCHED',
    "source_note" TEXT,
    "raw_payload" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cogs_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cogs_source_records" (
    "id" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "external_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "source_date" DATE,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cogs_source_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cogs_sync_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "source_results" JSONB,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "cogs_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cogs_records_item_key_key" ON "cogs_records"("item_key");

-- CreateIndex
CREATE INDEX "cogs_records_date_idx" ON "cogs_records"("date");

-- CreateIndex
CREATE INDEX "cogs_records_supplier_date_idx" ON "cogs_records"("supplier", "date");

-- CreateIndex
CREATE INDEX "cogs_source_records_supplier_source_date_idx" ON "cogs_source_records"("supplier", "source_date");

-- CreateIndex
CREATE UNIQUE INDEX "cogs_source_records_supplier_external_id_key" ON "cogs_source_records"("supplier", "external_id");

-- CreateIndex
CREATE INDEX "cogs_sync_runs_started_at_idx" ON "cogs_sync_runs"("started_at");
