import { prisma } from "@/lib/prisma";

export async function reconcileOrderItems(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE etsy_order_items AS item
    SET etsy_order_id = orders.id, match_status = 'MATCHED', updated_at = NOW()
    FROM etsy_orders AS orders
    WHERE item.shop_id = orders.shop_id
      AND item.order_id = orders.order_id
      AND (item.etsy_order_id IS NULL OR item.match_status <> 'MATCHED')
  `;
}
