"use server";

import { revalidatePath } from "next/cache";
import { syncShopifyRawOrders } from "@/lib/shopify-raw-order-sync";

export interface ShopifySyncActionResult {
  success: boolean;
  error?: string;
  data?: {
    addedCount: number;
    pageCount: number;
    skippedCount: number;
  };
}

export async function syncShopifyAction(): Promise<ShopifySyncActionResult> {
  try {
    const result = await syncShopifyRawOrders();

    revalidatePath("/dashboard");

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Shopify sync thất bại.";
    return {
      success: false,
      error: message,
    };
  }
}
