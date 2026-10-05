import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPrintPoss } from "../ec/cogs/providers/printposs";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const range = {
  from: new Date("2026-10-01T00:00:00.000Z"),
  to: new Date("2026-11-01T00:00:00.000Z"),
};

test("PrintPoss COGS: paginates with GET and maps one order-level row", async () => {
  const previousToken = process.env.PRINTPOSS_API_TOKEN;
  const previousFetch = globalThis.fetch;
  process.env.PRINTPOSS_API_TOKEN = "test-read-token";
  const requests: Array<{
    url: URL;
    method: string | undefined;
    authorization: string | null;
  }> = [];

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input));
    requests.push({
      url,
      method: init?.method,
      authorization: new Headers(init?.headers).get("Authorization"),
    });

    if (url.searchParams.get("page") === "1") {
      return jsonResponse({
        data: [
          {
            order_number: "PP-OUTSIDE",
            created_at: "2026-09-30T23:59:59.000Z",
            total_cost: 5,
          },
          {
            order_number: "PP-100",
            external_order_id: "1001",
            created_at: "2026-10-08T12:00:00.000Z",
            total_cost: "28.50",
            order_status: "completed",
            payment_status: "paid",
            is_sample: false,
            items: [
              {
                id: "item-1",
                quantity: 2,
                product_variant: { name: "Matte Poster", sku: "MP-01" },
              },
              { id: "item-2", quantity: 1, name: "Canvas Print" },
            ],
            costs: [{ type: "production", amount: 20 }],
          },
        ],
        meta: { last_page: 2 },
        links: {
          next: "https://api.printposs.com/api/v1/seller/orders?page=2",
        },
      });
    }

    return jsonResponse({
      data: [
        {
          order_number: "PP-101",
          external_order_id: "",
          created_at: "2026-10-09T12:00:00.000Z",
          total_cost: null,
          items: [],
          costs: [
            { type: "production", amount: 12 },
            { type: "shipping", amount: 3.25 },
          ],
        },
      ],
      meta: { last_page: 2 },
      links: { next: null },
    });
  };

  try {
    const rows = await fetchPrintPoss(range);

    assert.equal(requests.length, 2);
    assert.ok(requests.every((request) => request.method === "GET"));
    assert.ok(
      requests.every(
        (request) => request.authorization === "Bearer test-read-token",
      ),
    );
    assert.ok(
      requests.every(
        (request) =>
          request.url.searchParams.get("include") === "items,costs" &&
          request.url.searchParams.get("per_page") === "100",
      ),
    );

    assert.equal(rows.length, 2);
    assert.equal(rows[0].supplier, "PrintPoss");
    assert.equal(rows[0].itemKey, "PrintPoss:PP-100");
    assert.equal(rows[0].referenceOrderId, "#1001");
    assert.equal(rows[0].supplierOrderId, "PP-100");
    assert.equal(rows[0].totalCost, 28.5);
    assert.equal(rows[0].estimatedCost, 28.5);
    assert.equal(
      (rows[0].rawPayload as { item: { name: string } }).item.name,
      "Matte Poster ×2 | Canvas Print",
    );
    assert.equal(rows[1].referenceOrderId, null);
    assert.equal(rows[1].mappingStatus, "UNMATCHED");
    assert.equal(rows[1].totalCost, 15.25);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) {
      delete process.env.PRINTPOSS_API_TOKEN;
    } else {
      process.env.PRINTPOSS_API_TOKEN = previousToken;
    }
  }
});

test("PrintPoss COGS: rejects missing token without making a request", async () => {
  const previousToken = process.env.PRINTPOSS_API_TOKEN;
  const previousFetch = globalThis.fetch;
  delete process.env.PRINTPOSS_API_TOKEN;
  let requestCount = 0;
  globalThis.fetch = async () => {
    requestCount += 1;
    return jsonResponse({ data: [] });
  };

  try {
    await assert.rejects(
      fetchPrintPoss(range),
      /PrintPoss API token is missing/,
    );
    assert.equal(requestCount, 0);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousToken === undefined) {
      delete process.env.PRINTPOSS_API_TOKEN;
    } else {
      process.env.PRINTPOSS_API_TOKEN = previousToken;
    }
  }
});
