import { orderDeliveryValues } from "@/lib/ec/order-delivery-sheet";
import type { ShopifyOrderNode } from "@/lib/shopify-raw-order-sync";

type DeliveryOrder = Pick<
  ShopifyOrderNode,
  "displayFulfillmentStatus" | "fulfillments"
> & { id: string };
const QUERY = `query MicromDelivery($ids: [ID!]!) {
  nodes(ids: $ids) {
    ... on Order {
      id displayFulfillmentStatus
      fulfillments(first: 250) {
        id createdAt updatedAt deliveredAt inTransitAt displayStatus
        trackingInfo { company number }
        events(first: 1, reverse: true) { nodes { status happenedAt createdAt } }
      }
    }
  }
}`;

export async function fetchMicromOrderDelivery(
  orderIds: string[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, string[]>> {
  const ids = [...new Set(orderIds)];
  const result = new Map<string, string[]>();
  if (!ids.length) return result;
  const domain = process.env.MICROM_SHOPIFY_STORE_DOMAIN?.trim();
  const token = process.env.MICROM_SHOPIFY_ACCESS_TOKEN?.trim();
  if (!domain || !token)
    throw new Error("Missing Microm Shopify delivery credentials.");
  const host = new URL(domain.includes("://") ? domain : `https://${domain}`)
    .host;
  const endpoint = `https://${host}/admin/api/${process.env.SHOPIFY_API_VERSION || "2026-07"}/graphql.json`;
  for (let start = 0; start < ids.length; start += 100) {
    const chunk = ids.slice(start, start + 100);
    let data: DeliveryOrder[] | undefined;
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await fetchFn(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": token,
        },
        signal: AbortSignal.timeout(30_000),
        body: JSON.stringify({
          query: QUERY,
          variables: { ids: chunk.map((id) => `gid://shopify/Order/${id}`) },
        }),
      });
      const payload = (await response.json()) as {
        data?: { nodes: Array<DeliveryOrder | null> };
        errors?: Array<{ message: string; extensions?: { code?: string } }>;
      };
      const retryable =
        response.status === 429 ||
        response.status >= 500 ||
        payload.errors?.some((error) => error.extensions?.code === "THROTTLED");
      if (retryable && attempt < 2) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * 2 ** attempt),
        );
        continue;
      }
      if (!response.ok || payload.errors?.length || !payload.data) {
        throw new Error(
          `Microm delivery API ${response.status}: ${payload.errors?.map((error) => error.message).join("; ") || "Invalid response"}`,
        );
      }
      if (payload.data.nodes.some((node) => !node))
        throw new Error("Microm delivery API returned a missing order.");
      data = payload.data.nodes as DeliveryOrder[];
      break;
    }
    if (!data) throw new Error("Microm delivery API retry limit reached.");
    for (const order of data)
      result.set(order.id.split("/").pop() || "", orderDeliveryValues(order));
    if (chunk.some((id) => !result.has(id)))
      throw new Error("Microm delivery API omitted an order; sync stopped.");
  }
  return result;
}
