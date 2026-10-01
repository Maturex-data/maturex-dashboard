-- Migration: Safely remove POCDY shop from etsy_shops if no related records exist.
-- If related records exist in etsy_import_batches, etsy_orders, etsy_order_items, or etsy_statements,
-- abort migration with RAISE EXCEPTION detailing record counts.
DO $$
DECLARE
  v_shop_id TEXT;
  v_batch_count INTEGER := 0;
  v_order_count INTEGER := 0;
  v_item_count INTEGER := 0;
  v_statement_count INTEGER := 0;
  v_total_relations INTEGER := 0;
BEGIN
  -- Check if POCDY shop exists in etsy_shops
  SELECT "id" INTO v_shop_id FROM "etsy_shops" WHERE "code" = 'POCDY';

  IF v_shop_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_batch_count FROM "etsy_import_batches" WHERE "shop_id" = v_shop_id;
    SELECT COUNT(*) INTO v_order_count FROM "etsy_orders" WHERE "shop_id" = v_shop_id;
    SELECT COUNT(*) INTO v_item_count FROM "etsy_order_items" WHERE "shop_id" = v_shop_id;
    SELECT COUNT(*) INTO v_statement_count FROM "etsy_statements" WHERE "shop_id" = v_shop_id;

    v_total_relations := v_batch_count + v_order_count + v_item_count + v_statement_count;

    IF v_total_relations > 0 THEN
      RAISE EXCEPTION 'Cannot remove shop POCDY (id: %): Found % linked records (batches: %, orders: %, items: %, statements: %). Manual cleanup or archiving is required.',
        v_shop_id, v_total_relations, v_batch_count, v_order_count, v_item_count, v_statement_count;
    ELSE
      DELETE FROM "etsy_shops" WHERE "id" = v_shop_id;
    END IF;
  END IF;
END $$;
