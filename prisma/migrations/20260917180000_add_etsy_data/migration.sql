CREATE TABLE "etsy_shops" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(50) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "etsy_shops_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "etsy_import_batches" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "report_type" VARCHAR(50) NOT NULL,
    "source_file_name" TEXT NOT NULL,
    "source_month" DATE NOT NULL,
    "file_hash" VARCHAR(64) NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'PROCESSING',
    "total_rows" INTEGER NOT NULL DEFAULT 0,
    "inserted_rows" INTEGER NOT NULL DEFAULT 0,
    "updated_rows" INTEGER NOT NULL DEFAULT 0,
    "skipped_rows" INTEGER NOT NULL DEFAULT 0,
    "failed_rows" INTEGER NOT NULL DEFAULT 0,
    "error_details" JSONB,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    CONSTRAINT "etsy_import_batches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "etsy_orders" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "order_id" VARCHAR(100) NOT NULL,
    "sale_date" DATE NOT NULL,
    "buyer_user_id" TEXT,
    "full_name" TEXT,
    "first_name" TEXT,
    "last_name" TEXT,
    "number_of_items" INTEGER,
    "payment_method" TEXT,
    "date_shipped" DATE,
    "street_1" TEXT,
    "street_2" TEXT,
    "ship_city" TEXT,
    "ship_state" TEXT,
    "ship_zipcode" TEXT,
    "ship_country" TEXT,
    "currency" VARCHAR(10),
    "order_value" DECIMAL(18,4),
    "coupon_code" TEXT,
    "coupon_details" TEXT,
    "discount_amount" DECIMAL(18,4),
    "shipping_discount" DECIMAL(18,4),
    "shipping" DECIMAL(18,4),
    "sales_tax" DECIMAL(18,4),
    "order_total" DECIMAL(18,4),
    "status" TEXT,
    "card_processing_fees" DECIMAL(18,4),
    "order_net" DECIMAL(18,4),
    "adjusted_order_total" DECIMAL(18,4),
    "adjusted_card_processing_fees" DECIMAL(18,4),
    "adjusted_net_order_amount" DECIMAL(18,4),
    "buyer" TEXT,
    "order_type" TEXT,
    "payment_type" TEXT,
    "in_person_discount" DECIMAL(18,4),
    "in_person_location" TEXT,
    "sku" TEXT,
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "etsy_orders_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "etsy_order_items" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "etsy_order_id" TEXT,
    "order_id" VARCHAR(100) NOT NULL,
    "source_key" VARCHAR(64) NOT NULL,
    "transaction_id" VARCHAR(100),
    "listing_id" VARCHAR(100),
    "sale_date" DATE NOT NULL,
    "item_name" TEXT,
    "buyer" TEXT,
    "quantity" INTEGER,
    "price" DECIMAL(18,4),
    "coupon_code" TEXT,
    "coupon_details" TEXT,
    "discount_amount" DECIMAL(18,4),
    "shipping_discount" DECIMAL(18,4),
    "order_shipping" DECIMAL(18,4),
    "order_sales_tax" DECIMAL(18,4),
    "item_total" DECIMAL(18,4),
    "currency" VARCHAR(10),
    "date_paid" DATE,
    "date_shipped" DATE,
    "ship_name" TEXT,
    "ship_address_1" TEXT,
    "ship_address_2" TEXT,
    "ship_city" TEXT,
    "ship_state" TEXT,
    "ship_zipcode" TEXT,
    "ship_country" TEXT,
    "variations" TEXT,
    "order_type" TEXT,
    "listings_type" TEXT,
    "payment_type" TEXT,
    "in_person_discount" DECIMAL(18,4),
    "in_person_location" TEXT,
    "vat_paid_by_buyer" DECIMAL(18,4),
    "sku" TEXT,
    "match_status" VARCHAR(30) NOT NULL DEFAULT 'MATCHED',
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "etsy_order_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "etsy_statements" (
    "id" TEXT NOT NULL,
    "shop_id" TEXT NOT NULL,
    "import_batch_id" TEXT NOT NULL,
    "source_key" VARCHAR(64) NOT NULL,
    "statement_date" DATE NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" TEXT,
    "info" TEXT,
    "currency" VARCHAR(10),
    "amount" DECIMAL(18,4),
    "fees_and_taxes" DECIMAL(18,4),
    "net" DECIMAL(18,4),
    "tax_details" TEXT,
    "extracted_order_id" VARCHAR(100),
    "raw_payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "etsy_statements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "etsy_shops_code_key" ON "etsy_shops"("code");
CREATE UNIQUE INDEX "etsy_import_batches_shop_id_report_type_file_hash_key" ON "etsy_import_batches"("shop_id", "report_type", "file_hash");
CREATE INDEX "etsy_import_batches_shop_id_source_month_idx" ON "etsy_import_batches"("shop_id", "source_month");
CREATE INDEX "etsy_import_batches_status_started_at_idx" ON "etsy_import_batches"("status", "started_at");
CREATE UNIQUE INDEX "etsy_orders_shop_id_order_id_key" ON "etsy_orders"("shop_id", "order_id");
CREATE INDEX "etsy_orders_shop_id_sale_date_idx" ON "etsy_orders"("shop_id", "sale_date");
CREATE INDEX "etsy_orders_import_batch_id_idx" ON "etsy_orders"("import_batch_id");
CREATE UNIQUE INDEX "etsy_order_items_shop_id_source_key_key" ON "etsy_order_items"("shop_id", "source_key");
CREATE INDEX "etsy_order_items_shop_id_sale_date_idx" ON "etsy_order_items"("shop_id", "sale_date");
CREATE INDEX "etsy_order_items_order_id_idx" ON "etsy_order_items"("order_id");
CREATE INDEX "etsy_order_items_etsy_order_id_idx" ON "etsy_order_items"("etsy_order_id");
CREATE INDEX "etsy_order_items_import_batch_id_idx" ON "etsy_order_items"("import_batch_id");
CREATE UNIQUE INDEX "etsy_statements_shop_id_source_key_key" ON "etsy_statements"("shop_id", "source_key");
CREATE INDEX "etsy_statements_shop_id_statement_date_idx" ON "etsy_statements"("shop_id", "statement_date");
CREATE INDEX "etsy_statements_shop_id_type_statement_date_idx" ON "etsy_statements"("shop_id", "type", "statement_date");
CREATE INDEX "etsy_statements_extracted_order_id_idx" ON "etsy_statements"("extracted_order_id");
CREATE INDEX "etsy_statements_import_batch_id_idx" ON "etsy_statements"("import_batch_id");

ALTER TABLE "etsy_import_batches" ADD CONSTRAINT "etsy_import_batches_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "etsy_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etsy_orders" ADD CONSTRAINT "etsy_orders_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "etsy_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etsy_orders" ADD CONSTRAINT "etsy_orders_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "etsy_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etsy_order_items" ADD CONSTRAINT "etsy_order_items_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "etsy_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etsy_order_items" ADD CONSTRAINT "etsy_order_items_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "etsy_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etsy_order_items" ADD CONSTRAINT "etsy_order_items_etsy_order_id_fkey" FOREIGN KEY ("etsy_order_id") REFERENCES "etsy_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "etsy_statements" ADD CONSTRAINT "etsy_statements_shop_id_fkey" FOREIGN KEY ("shop_id") REFERENCES "etsy_shops"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "etsy_statements" ADD CONSTRAINT "etsy_statements_import_batch_id_fkey" FOREIGN KEY ("import_batch_id") REFERENCES "etsy_import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
