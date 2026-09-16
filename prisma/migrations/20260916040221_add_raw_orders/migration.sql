-- CreateTable
CREATE TABLE "raw_orders" (
    "id" TEXT NOT NULL,
    "shopify_order_id" TEXT NOT NULL,
    "order_name" TEXT NOT NULL,
    "order_date" DATE NOT NULL,
    "financial_status" TEXT,
    "fulfillment_status" TEXT,
    "fulfillment_date" DATE,
    "delivery_status" TEXT,
    "delivery_date" DATE,
    "gross_sales" DECIMAL(18,4) NOT NULL,
    "discounts" DECIMAL(18,4) NOT NULL,
    "shipping_charged" DECIMAL(18,4) NOT NULL,
    "sales_tax" DECIMAL(18,4) NOT NULL,
    "order_total_before_refund" DECIMAL(18,4) NOT NULL,
    "order_total" DECIMAL(18,4) NOT NULL,
    "refund_amount" DECIMAL(18,4) NOT NULL,
    "refund_date" DATE,
    "items" INTEGER NOT NULL,
    "tag" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "raw_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shopify_sync_runs" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "page_count" INTEGER NOT NULL DEFAULT 0,
    "added_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_message" TEXT,

    CONSTRAINT "shopify_sync_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "raw_orders_shopify_order_id_key" ON "raw_orders"("shopify_order_id");

-- CreateIndex
CREATE INDEX "raw_orders_order_date_idx" ON "raw_orders"("order_date");

-- CreateIndex
CREATE INDEX "shopify_sync_runs_started_at_idx" ON "shopify_sync_runs"("started_at");
