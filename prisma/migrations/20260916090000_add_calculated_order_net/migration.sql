ALTER TABLE "raw_orders"
ADD COLUMN "calc_order_net_after_refund" DECIMAL(18,4);

UPDATE "raw_orders"
SET "calc_order_net_after_refund" = "order_total_before_refund" - "refund_amount";

ALTER TABLE "raw_orders"
ALTER COLUMN "calc_order_net_after_refund" SET NOT NULL;
