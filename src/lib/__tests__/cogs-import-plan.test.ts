import assert from "node:assert/strict";
import test from "node:test";
import { mapEquarusOrdersToCogs } from "@/lib/fl/cogs-parser/cogs-mapper";
import { planCogs, snapshotHash } from "@/lib/fl/cogs-parser/import-plan";
import {
  applyCogs,
  checkPreviewToken,
  makePreviewToken,
  type prepareCogs,
} from "@/lib/fl/cogs-parser/import-service";
import {
  type MappedCogsRow,
  RAW_COGS_HEADERS,
} from "@/lib/fl/cogs-parser/types";

const row = (id = "123"): MappedCogsRow => ({
  "Etsy Order ID": id,
  "Supplier Order ID": "",
  Store: "97DECOR",
  Supplier: "EQUARUS",
  "Source date": "2026-09-14",
  "Status nguồn": "Completed",
  Currency: "",
  "Production cost": 10,
  "Shipping cost": 2,
  Tax: "",
  "Other cost": "",
  "Total cost nguồn": 12,
  "Source line ID": "",
  "Source file": "",
});
const values = (r: MappedCogsRow) => RAW_COGS_HEADERS.map((h) => r[h] ?? "");
test("same file is unchanged on repeat, normalized shop/supplier/date/money", () => {
  const old = values(row());
  old[2] = "97Decor";
  old[3] = "Equarus";
  old[4] = "2026-09-14 00:00:00";
  old[7] = "10.00";
  old[12] = "historical-id";
  assert.equal(planCogs([row()], [old]).decisions[0].kind, "UNCHANGED");
});
test("status and individual costs produce changes even when total is equal", () => {
  const old = values(row());
  old[5] = "Processing";
  old[7] = 9;
  old[8] = 3;
  assert.deepEqual(
    planCogs([row()], [old]).decisions[0].changes.map((c) => c.column),
    ["Status nguồn", "Production cost", "Shipping cost"],
  );
});
test("duplicates in sheet conflict; same upload rows collapse, different rows conflict", () => {
  assert.equal(
    planCogs([row()], [values(row()), values(row())]).decisions[0].kind,
    "CONFLICT",
  );
  const same = planCogs([row(), row()], []);
  assert.equal(same.decisions.length, 1);
  assert.equal(same.duplicateCount, 1);
  const changed = { ...row(), "Status nguồn": "Processing" };
  assert.equal(planCogs([row(), changed], []).decisions[0].kind, "CONFLICT");
});
test("replacement lookup uses original only for store and preserves its independent key", () => {
  const mapped = mapEquarusOrdersToCogs(
    [
      {
        orderId: "123-Replace",
        paymentId: "p",
        createDay: "2026-09-14",
        orderBaseCost: 10,
        orderAmazonFulfillmentCost: 2,
        orderAmount: 12,
        orderStatus: "Completed",
        rowNumber: 3,
      },
    ],
    [],
    {
      fileName: "test.xlsx",
      fileSizeBytes: 1,
      ordersLookup: new Map([["123", new Set(["97Decor"])]]),
    },
  );
  assert.equal(mapped.rows[0].Store, "97DECOR");
  assert.equal(mapped.rows[0]["Etsy Order ID"], "123-Replace");
  assert.equal(planCogs(mapped.rows, [values(row())]).decisions[0].kind, "NEW");
});
test("missing keys, invalid values and outside shop block", () => {
  for (const change of [
    { Store: "" },
    { Store: "TIMOND" },
    { "Production cost": "bad" },
    { "Source date": "2026-02-30" },
  ])
    assert.equal(
      planCogs([{ ...row(), ...change }], []).decisions[0].kind,
      "CONFLICT",
    );
});
function prepared(existing: unknown[][], incoming: MappedCogsRow[]) {
  let current = existing.map((r) => [...r]);
  const orders: unknown[][] = [
    ["Order ID", "Store"],
    ["123", "97Decor"],
  ];
  let writes = 0;
  const p = {
    blocked: 0,
    state: { orders, cogs: existing },
    snapshot: snapshotHash(orders, existing),
    plan: planCogs(incoming, existing),
    read: async () => ({ orders, cogs: current }),
    request: async (path: string, init?: RequestInit) => {
      if (path.startsWith("?fields"))
        return {
          sheets: [
            {
              properties: {
                sheetId: 58221536,
                title: "RAW.COGS",
                gridProperties: { rowCount: 1000 },
              },
            },
          ],
        };
      if (path === "/values:batchUpdate") {
        writes++;
        const data = JSON.parse(String(init?.body)).data;
        for (const entry of data) {
          const m = entry.range.match(/!([A-Z]+)(\d+)/);
          const idx = Number(m[2]) - 3;
          const col = m[1].charCodeAt(0) - 65;
          current[idx] ??= [];
          entry.values[0].forEach((v: unknown, i: number) => {
            current[idx][col + i] = v;
          });
        }
      }
      return {};
    },
  } as Awaited<ReturnType<typeof prepareCogs>>;
  return {
    p,
    writes: () => writes,
    setRows: (r: unknown[][]) => {
      current = r;
    },
    rows: () => current,
  };
}
test("unchanged import never writes", async () => {
  const mock = prepared([values(row())], [row()]);
  const result = await applyCogs(mock.p, []);
  assert.equal(result.skippedCount, 1);
  assert.equal(mock.writes(), 0);
});
test("approved updates preserve history and unrelated rows; unapproved updates skip", async () => {
  const old = values(row());
  old[5] = "Processing";
  old[1] = "supplier-id";
  old[6] = "USD";
  old[9] = 4;
  old[10] = 3;
  old[12] = "line";
  old[13] = "archive";
  const other = values({ ...row("456"), Store: "TIMOND" });
  const mock = prepared([old, other], [row()]);
  const key = mock.p.plan.decisions[0].key;
  assert.equal((await applyCogs(mock.p, [])).updatedCount, 0);
  assert.equal(mock.writes(), 0);
  const result = await applyCogs(mock.p, [key]);
  assert.equal(result.updatedCount, 1);
  for (const i of [1, 6, 9, 10, 12, 13])
    assert.equal(mock.rows()[0][i], old[i]);
  assert.deepEqual(mock.rows()[1], other);
});
test("new rows append and second import is unchanged", async () => {
  const mock = prepared([], [row()]);
  assert.equal((await applyCogs(mock.p, [])).insertedCount, 1);
  assert.equal(planCogs([row()], mock.rows()).decisions[0].kind, "UNCHANGED");
});
test("fresh read mismatch and conflicts stop before mutation", async () => {
  const mock = prepared([], [row()]);
  mock.setRows([values(row("999"))]);
  await assert.rejects(applyCogs(mock.p, []), /Sheet đã thay đổi/);
  assert.equal(mock.writes(), 0);
  mock.p.blocked = 1;
  await assert.rejects(applyCogs(mock.p, []), /Preview/);
});
test("signed preview rejects a changed file or sheet", () => {
  const old = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = "test-secret";
  try {
    const f = Buffer.from("file");
    const token = makePreviewToken("snapshot", f);
    checkPreviewToken(token, "snapshot", f);
    assert.throws(() => checkPreviewToken(token, "other", f));
    assert.throws(() =>
      checkPreviewToken(token, "snapshot", Buffer.from("other")),
    );
    assert.throws(() => checkPreviewToken(`${token}tamper`, "snapshot", f));
  } finally {
    if (old === undefined) delete process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
    else process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY = old;
  }
});

test("replacement exact lookup takes priority and an ambiguous original blocks", () => {
  const raw = {
    orderId: "123-Replace",
    paymentId: "p",
    createDay: "2026-09-14",
    orderBaseCost: 10,
    orderAmazonFulfillmentCost: 2,
    orderAmount: 12,
    orderStatus: "Completed",
    rowNumber: 3,
  };
  const run = (lookup: Map<string, Set<string>>) =>
    mapEquarusOrdersToCogs([raw], [], {
      fileName: "test.xlsx",
      fileSizeBytes: 1,
      ordersLookup: lookup,
    });
  assert.equal(
    run(
      new Map([
        ["123-Replace", new Set(["97Decor"])],
        ["123", new Set(["Timond"])],
      ]),
    ).rows[0].Store,
    "97DECOR",
  );
  assert.equal(
    run(new Map([["123", new Set(["97Decor", "Timond"])]])).summary
      .conflictCount,
    1,
  );
});
test("an arbitrary approval is rejected without writing", async () => {
  const mock = prepared([], [row()]);
  await assert.rejects(
    applyCogs(mock.p, ["not-in-preview"]),
    /Danh sách duyệt/,
  );
  assert.equal(mock.writes(), 0);
});
