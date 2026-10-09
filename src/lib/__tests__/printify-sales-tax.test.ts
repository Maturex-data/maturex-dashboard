import assert from "node:assert/strict";
import { test } from "node:test";
import { fetchPrintify } from "../ec/cogs/providers/printify";
import {
  cogsSalesTax,
  ensureCogsSalesTaxHeader,
} from "../ec/cogs/sales-tax-sheet";
import { EXPECTED_SHEET_HEADERS } from "../ec/sheet-import/types";

test("Printify includes order tax once across multiple items, handles zero/missing tax", async () => {
  const oldFetch = globalThis.fetch;
  const oldToken = process.env.PRINTIFY_ACCESS_TOKEN,
    oldShop = process.env.PRINTIFY_SHOP_ID;
  process.env.PRINTIFY_ACCESS_TOKEN = "fixture";
  process.env.PRINTIFY_SHOP_ID = "fixture";
  globalThis.fetch = async () =>
    Response.json({
      last_page: 1,
      data: [82, 0, undefined].map((tax, i) => ({
        id: String(i),
        created_at: "2026-09-15T00:00:00Z",
        total_tax: tax,
        line_items: [
          { cost: 1093, shipping_cost: 399 },
          { cost: 1093, shipping_cost: 399 },
        ],
      })),
    });
  try {
    const rows = await fetchPrintify({
      from: new Date("2026-09-01Z"),
      to: new Date("2026-10-01Z"),
    });
    assert.equal(rows[0].totalCost, 15.74);
    assert.equal(rows[1].totalCost, 14.92);
    assert.equal(cogsSalesTax(rows[0]), 0.82);
    assert.equal(cogsSalesTax(rows[1]), "");
    assert.equal(cogsSalesTax(rows[2]), 0);
    assert.equal(cogsSalesTax(rows[4]), "");
    assert.equal(new Set(rows.map((r) => r.itemKey)).size, 6);
  } finally {
    globalThis.fetch = oldFetch;
    if (oldToken === undefined) delete process.env.PRINTIFY_ACCESS_TOKEN;
    else process.env.PRINTIFY_ACCESS_TOKEN = oldToken;
    if (oldShop === undefined) delete process.env.PRINTIFY_SHOP_ID;
    else process.env.PRINTIFY_SHOP_ID = oldShop;
  }
});

test("Sales Tax header is added idempotently and refuses occupied O column", async () => {
  const header: string[] = [...EXPECTED_SHEET_HEADERS.COGS];
  let writes = 0;
  const request = async (_path: string, init?: RequestInit) => {
    if (_path.startsWith("?fields="))
      return Response.json({
        sheets: [
          {
            properties: {
              sheetId: 1,
              title: "COGS",
              gridProperties: { columnCount: 15 },
            },
          },
        ],
      });
    if (init?.method === "PUT") {
      writes++;
      header[14] = "Sales Tax";
    }
    return Response.json({ values: [header] });
  };
  await ensureCogsSalesTaxHeader(request);
  await ensureCogsSalesTaxHeader(request);
  assert.equal(writes, 1);
  header[14] = "Other";
  await assert.rejects(ensureCogsSalesTaxHeader(request), /already in use/);
  assert.equal(writes, 1);
});
