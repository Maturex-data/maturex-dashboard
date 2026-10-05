import { EXPECTED_SHEET_HEADERS } from "@/lib/ec/sheet-import/types";
import type { ShopifyOrderNode } from "@/lib/shopify-raw-order-sync";

export const ORDER_DELIVERY_HEADERS = [
  "Fulfillment status",
  "Fulfillment ID",
  "Tracking number",
  "Carrier",
  "Shipment status",
  "Delivered at",
  "Shipped at",
  "Delivery source",
  "Delivery updated at",
] as const;

// Each line represents the same fulfillment across all delivery columns.
// Keep Shopify's ISO timestamps, including their timezone, without DATE storage.
export function orderDeliveryValues(
  order: Pick<ShopifyOrderNode, "displayFulfillmentStatus" | "fulfillments">,
): string[] {
  const fulfillments = order.fulfillments;
  const join = (values: Array<string | null | undefined>) =>
    values.map((value) => value || "").join("\n");
  return [
    order.displayFulfillmentStatus || "",
    join(fulfillments.map((f) => f.id)),
    join(
      fulfillments.map((f) =>
        f.trackingInfo?.map((t) => t.number || "").join(" | "),
      ),
    ),
    join(
      fulfillments.map((f) =>
        f.trackingInfo?.map((t) => t.company || "").join(" | "),
      ),
    ),
    join(fulfillments.map((f) => f.displayStatus)),
    join(fulfillments.map((f) => f.deliveredAt)),
    join(fulfillments.map((f) => f.inTransitAt)),
    join(
      fulfillments.map((f) => (f.displayStatus ? "Shopify fulfillment" : "")),
    ),
    join(
      fulfillments.map((f) => {
        const event = f.events?.nodes[0];
        return event?.status === f.displayStatus ? event.createdAt : "";
      }),
    ),
  ];
}

type SheetsRequest = (path: string, init?: RequestInit) => Promise<Response>;

export async function ensureOrdersDeliveryHeaders(
  request: SheetsRequest,
  baseHeaders: readonly string[] = EXPECTED_SHEET_HEADERS.Orders,
): Promise<void> {
  const firstIndex = baseHeaders.length;
  const columnCount = firstIndex + ORDER_DELIVERY_HEADERS.length;
  const lastColumn = String.fromCharCode(64 + columnCount);
  const firstColumn = String.fromCharCode(65 + firstIndex);
  const response = await request(
    `/values/${encodeURIComponent(`Orders!A1:${lastColumn}1`)}`,
  );
  const payload = (await response.json()) as { values?: unknown[][] };
  const headers = payload.values?.[0] || [];
  for (const [index, expected] of baseHeaders.entries()) {
    if (String(headers[index] || "").trim() !== expected) {
      throw new Error(
        `Orders header mismatch at column ${index + 1}; expected ${expected}.`,
      );
    }
  }
  for (const [index, expected] of ORDER_DELIVERY_HEADERS.entries()) {
    const actual = String(headers[index + firstIndex] || "").trim();
    if (actual && actual !== expected) {
      throw new Error(
        `Orders delivery column ${index + firstIndex + 1} is already used by ${actual}.`,
      );
    }
  }
  if (
    ORDER_DELIVERY_HEADERS.every(
      (expected, index) => headers[index + firstIndex] === expected,
    )
  )
    return;
  const metadata = (await (
    await request(
      "?fields=sheets.properties(sheetId,title,gridProperties.columnCount)",
    )
  ).json()) as {
    sheets: Array<{
      properties: {
        sheetId: number;
        title: string;
        gridProperties: { columnCount: number };
      };
    }>;
  };
  const properties = metadata.sheets.find(
    (sheet) => sheet.properties.title === "Orders",
  )?.properties;
  if (!properties) throw new Error("Orders tab does not exist.");
  if (properties.gridProperties.columnCount < columnCount) {
    await request(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: properties.sheetId,
                gridProperties: { columnCount },
              },
              fields: "gridProperties.columnCount",
            },
          },
        ],
      }),
    });
  }
  await request(
    `/values/${encodeURIComponent(`Orders!${firstColumn}1:${lastColumn}1`)}?valueInputOption=RAW`,
    {
      method: "PUT",
      body: JSON.stringify({ values: [ORDER_DELIVERY_HEADERS] }),
    },
  );
}
