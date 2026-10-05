import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureOrdersDeliveryHeaders,
  ORDER_DELIVERY_HEADERS,
} from "../ec/order-delivery-sheet";
import { ORDERS_COLUMNS } from "../microm/constants";
import { computeOrdersFingerprint } from "../microm/sheet-writer";
import { fetchMicromOrderDelivery } from "../microm/shopify-delivery";

test("Microm appends delivery headers only to O:W", async () => {
  const writes: string[] = [];
  await ensureOrdersDeliveryHeaders(async (path, init) => {
    if (init) {
      writes.push(decodeURIComponent(path));
      return Response.json({});
    }
    if (path.startsWith("?fields="))
      return Response.json({
        sheets: [
          {
            properties: {
              title: "Orders",
              sheetId: 1,
              gridProperties: { columnCount: 26 },
            },
          },
        ],
      });
    return Response.json({ values: [ORDERS_COLUMNS] });
  }, ORDERS_COLUMNS);
  assert.deepEqual(writes, ["/values/Orders!O1:W1?valueInputOption=RAW"]);
});

test("delivery columns do not change financial reconciliation fingerprint", () => {
  const base = ORDERS_COLUMNS.map((_, i) => String(i));
  assert.equal(
    computeOrdersFingerprint([[...base, "DELIVERED"]]),
    computeOrdersFingerprint([[...base, "CONFIRMED"]]),
  );
});

test("Microm lookup deduplicates, batches and uses its own store credentials", async () => {
  const oldDomain = process.env.MICROM_SHOPIFY_STORE_DOMAIN;
  const oldToken = process.env.MICROM_SHOPIFY_ACCESS_TOKEN;
  process.env.MICROM_SHOPIFY_STORE_DOMAIN = "microm-test.myshopify.com";
  process.env.MICROM_SHOPIFY_ACCESS_TOKEN = "microm-test-token";
  try {
    const sizes: number[] = [];
    const fake: typeof fetch = async (url, init) => {
      assert.ok(String(url).startsWith("https://microm-test.myshopify.com/"));
      assert.equal(
        new Headers(init?.headers).get("X-Shopify-Access-Token"),
        "microm-test-token",
      );
      const ids = JSON.parse(String(init?.body)).variables.ids as string[];
      sizes.push(ids.length);
      return Response.json({
        data: {
          nodes: ids.map((id) => ({
            id,
            displayFulfillmentStatus: "UNFULFILLED",
            fulfillments: [],
          })),
        },
      });
    };
    const ids = Array.from({ length: 101 }, (_, i) => String(i + 1));
    const result = await fetchMicromOrderDelivery([...ids, "1"], fake);
    assert.deepEqual(sizes, [100, 1]);
    assert.equal(result.size, 101);
    assert.equal(result.get("1")?.length, ORDER_DELIVERY_HEADERS.length);
    assert.equal(result.get("1")?.[5], "");
    await assert.rejects(
      fetchMicromOrderDelivery(["1"], async () =>
        Response.json({ data: { nodes: [null] } }),
      ),
      /missing order/,
    );
  } finally {
    if (oldDomain === undefined) delete process.env.MICROM_SHOPIFY_STORE_DOMAIN;
    else process.env.MICROM_SHOPIFY_STORE_DOMAIN = oldDomain;
    if (oldToken === undefined) delete process.env.MICROM_SHOPIFY_ACCESS_TOKEN;
    else process.env.MICROM_SHOPIFY_ACCESS_TOKEN = oldToken;
  }
});
