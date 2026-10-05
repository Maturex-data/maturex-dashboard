import assert from "node:assert/strict";
import test from "node:test";
import {
  ensureOrdersDeliveryHeaders,
  ORDER_DELIVERY_HEADERS,
  orderDeliveryValues,
} from "../ec/order-delivery-sheet";
import { EXPECTED_SHEET_HEADERS } from "../ec/sheet-import/types";
import type { ShopifyOrderNode } from "../shopify-raw-order-sync";

function order(
  fulfillments: ShopifyOrderNode["fulfillments"],
): ShopifyOrderNode {
  return {
    displayFulfillmentStatus: "PARTIALLY_FULFILLED",
    fulfillments,
  } as ShopifyOrderNode;
}

test("delivery timestamps preserve timezone, blanks and fulfillment alignment", () => {
  const values = orderDeliveryValues(
    order([
      {
        id: "first",
        createdAt: "2026-09-01T01:00:00Z",
        updatedAt: "2026-10-05T10:00:00Z",
        deliveredAt: "2026-10-04T17:18:42Z",
        inTransitAt: "2026-10-01T10:00:00Z",
        displayStatus: "DELIVERED",
        trackingInfo: [{ number: "tracking1", company: null }],
        events: {
          nodes: [
            {
              status: "DELIVERED",
              happenedAt: "2026-10-04T17:18:42Z",
              createdAt: "2026-10-04T23:04:42Z",
            },
          ],
        },
      },
      {
        id: "second",
        createdAt: "2026-09-02T01:00:00Z",
        updatedAt: "2026-10-05T10:00:00Z",
        deliveredAt: null,
        inTransitAt: null,
        displayStatus: "CONFIRMED",
        trackingInfo: [{ number: "tracking2", company: "UPS" }],
        events: { nodes: [] },
      },
    ]),
  );
  assert.equal(values.length, ORDER_DELIVERY_HEADERS.length);
  assert.equal(values[1], "first\nsecond");
  assert.equal(values[2], "tracking1\ntracking2");
  assert.equal(values[3], "\nUPS");
  assert.equal(values[5], "2026-10-04T17:18:42Z\n");
  assert.equal(values[6], "2026-10-01T10:00:00Z\n");
  assert.equal(values[8], "2026-10-04T23:04:42Z\n");
});

test("a stale event must not supply current status update time", () => {
  const values = orderDeliveryValues(
    order([
      {
        createdAt: "created",
        updatedAt: "modified",
        deliveredAt: null,
        displayStatus: "IN_TRANSIT",
        events: {
          nodes: [
            {
              status: "CONFIRMED",
              happenedAt: "confirmed",
              createdAt: "recorded",
            },
          ],
        },
      },
    ]),
  );
  assert.equal(values[5], "");
  assert.equal(values[6], "");
  assert.equal(values[8], "");
});

test("header drift is rejected before any write", async () => {
  const calls: string[] = [];
  await assert.rejects(
    ensureOrdersDeliveryHeaders(async (_path, init) => {
      calls.push(init?.method || "GET");
      return Response.json({
        values: [[...EXPECTED_SHEET_HEADERS.Orders, "Other data"]],
      });
    }),
    /already used/,
  );
  assert.deepEqual(calls, ["GET"]);
});

test("append only N:V headers and keep repeated setup read-only", async () => {
  const writes: Array<{ path: string; init?: RequestInit }> = [];
  await ensureOrdersDeliveryHeaders(async (path, init) => {
    if (init) {
      writes.push({ path, init });
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
    return Response.json({ values: [EXPECTED_SHEET_HEADERS.Orders] });
  });
  assert.equal(writes.length, 1);
  assert.ok(decodeURIComponent(writes[0].path).includes("Orders!N1:V1"));
  assert.deepEqual(JSON.parse(String(writes[0].init?.body)).values, [
    ORDER_DELIVERY_HEADERS,
  ]);
  await ensureOrdersDeliveryHeaders(async (_path, init) => {
    assert.equal(init, undefined);
    return Response.json({
      values: [[...EXPECTED_SHEET_HEADERS.Orders, ...ORDER_DELIVERY_HEADERS]],
    });
  });
});
