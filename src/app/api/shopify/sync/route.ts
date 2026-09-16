import { syncShopifyRawOrders } from "@/lib/shopify-raw-order-sync";

export const maxDuration = 300;
export const runtime = "nodejs";

export async function POST(): Promise<Response> {
  try {
    const result = await syncShopifyRawOrders();

    return Response.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Shopify sync failed.";
    const status = message.includes("already running") ? 409 : 500;

    return Response.json({ error: message }, { status });
  }
}
