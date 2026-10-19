import assert from "node:assert/strict";
import { test } from "node:test";
import { COGS_COLUMNS } from "../microm/constants";
import { fetchMicromMerchOneOrders } from "../microm/merchone-adapter";
import {
  MERCHONE_EXTRA_HEADERS,
  planMerchOneImport,
} from "../microm/merchone-sheet";

const header = [...COGS_COLUMNS, ...MERCHONE_EXTRA_HEADERS];
const row = (id: string, ref = "#TM1023DE"): (string | number)[] => [
  id,
  "",
  ref,
  "2026-10-15",
  "2026-10",
  "Fulfilled",
  "EUR",
  4.15,
  3.99,
  "",
  "",
  "MerchOne API v1",
  "No approved FX",
  9.69,
  "DE",
];

test("MerchOne import is idempotent, normalizes old IDs and preserves PGPrint", () => {
  const pg = [
    "pg-id",
    "",
    "",
    46269,
    46266,
    "fulfilled",
    "USD",
    17,
    5.4,
    25.9,
    25.9,
    "PGPrint API",
    "note",
    "",
    "DE",
  ];
  const old = row("PP080953859", "");
  const incoming = [row("PPO80953859", ""), row("PPO96042231")];
  const first = planMerchOneImport([header, old, pg], incoming);
  assert.equal(first.updated, 1);
  assert.equal(first.added, 1);
  assert.deepEqual(first.finalRows[2], pg);
  const second = planMerchOneImport(first.finalRows, incoming);
  assert.equal(second.changes.length, 0);
  assert.equal(second.skipped, 2);
  assert.equal(second.finalRows[1][2], "");
  assert.equal(second.finalRows[1][9], "");
  assert.equal(second.finalRows[1][13], 9.69);
});

test("MerchOne refuses duplicate supplier IDs and changed headers", () => {
  assert.throws(
    () =>
      planMerchOneImport([header, row("PPO80953859"), row("PP080953859")], []),
    /Duplicate/,
  );
  assert.throws(
    () =>
      planMerchOneImport([header], [row("PPO80953859"), row("PPO80953859")]),
    /duplicate/,
  );
  assert.throws(() => planMerchOneImport([["wrong"]], []), /headers/);
});

test("MerchOne adapter reads paginated lists/details and matches exact Shopify names", async () => {
  const previousFetch = globalThis.fetch;
  const names = [
    "MICROM_MERCHONE_API_USER",
    "MICROM_MERCHONE_API_KEY",
    "MICROM_SHOPIFY_STORE_DOMAIN",
    "MICROM_SHOPIFY_ACCESS_TOKEN",
  ];
  const previous = names.map((name) => process.env[name]);
  for (const name of names)
    process.env[name] = name.includes("DOMAIN")
      ? "microm.myshopify.com"
      : "fixture";
  const methods: string[] = [];
  globalThis.fetch = async (input, init) => {
    assert.ok(!init?.method || init.method === "GET");
    methods.push(String(input));
    const url = String(input);
    if (url.includes("myshopify.com"))
      return Response.json({ orders: [{ id: 123, name: "#TM1023DE" }] });
    if (url.endsWith("/orders"))
      return Response.json({
        data: [{ order_id: "PPO96042231", country: "DE" }],
        links: { next: "https://api.merchone.com/api/v1/orders?page=2" },
      });
    if (url.includes("page=2"))
      return Response.json({
        data: [{ order_id: "PPO80953859", country: "DE" }],
        links: { next: null },
      });
    const id = url.split("/").at(-1);
    return Response.json({
      data: {
        order_id: id,
        external_id: id === "PPO96042231" ? "#TM1023DE" : null,
        status: "Fulfilled",
        created_at: "2026-10-15T03:00:00Z",
        sub_total: { amount: 4.15, currency: "EUR" },
        shipping_total: { amount: 3.99, currency: "EUR" },
        total_amount: { amount: 9.69, currency: "EUR" },
      },
    });
  };
  try {
    const result = await fetchMicromMerchOneOrders();
    assert.equal(result.ordersFetched, 2);
    assert.equal(result.matched, 1);
    assert.equal(result.unmapped, 1);
    assert.equal(result.rows[0][2], "#TM1023DE");
    assert.equal(result.rows[1][2], "");
    assert.equal(result.rows[0][9], "");
    assert.equal(methods.length, 5);
  } finally {
    globalThis.fetch = previousFetch;
    names.forEach((name, i) => {
      if (previous[i] === undefined) delete process.env[name];
      else process.env[name] = previous[i];
    });
  }
});

test("MerchOne preserves approved USD/formulas when EUR amount is unchanged", () => {
  const original = row("PPO96042231");
  original[9] = "=N2*1.1";
  original[10] = 10.66;
  const plan = planMerchOneImport([header, original], [row("PPO96042231")]);
  assert.equal(plan.changes.length, 0);
  assert.equal(plan.finalRows[1][9], "=N2*1.1");
  const changed = row("PPO96042231");
  changed[13] = 12;
  const update = planMerchOneImport([header, original], [changed]);
  assert.equal(update.finalRows[1][9], "");
});
