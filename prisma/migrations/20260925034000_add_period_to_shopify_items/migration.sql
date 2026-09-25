-- AlterTable
ALTER TABLE "microm_sheet_shopify_items" ADD COLUMN "period" VARCHAR(7);
ALTER TABLE "microm_sheet_shopify_items" ADD COLUMN "order_date" DATE;

-- CreateIndex
CREATE INDEX "microm_sheet_shopify_items_batch_id_period_idx" ON "microm_sheet_shopify_items"("batch_id", "period");
