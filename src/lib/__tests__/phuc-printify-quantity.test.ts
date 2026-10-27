import assert from "node:assert/strict";
import { test } from "node:test";
import { mapPrintifyOrder, type PrintifyOrder } from "../fl/printify/types";

const base: PrintifyOrder = {
  id: "6adde9c4e8f8c2a97f05beb8",
  created_at: "2026-10-25 11:36:36+00:00",
  status: "in-production",
  total_shipping: 1918,
  total_tax: 0,
  line_items: [
    { quantity: 2, cost: 8974, metadata: { sku: "31780735258834985184" } },
  ],
};

test("Phuc Printify: quantity 2 uses API line cost once", () => {
  const cells = mapPrintifyOrder(base);
  assert.equal(cells[7], 89.74);
  assert.equal(cells[8], 19.18);
  assert.equal(cells[9], 0);
  assert.equal(cells[22], 2);
  assert.equal(cells[11], ""); // API does not provide a mapped total cost in the existing contract.
});
test("Phuc Printify: sum multiple API line costs without multiplying quantities", () => {
  const cells = mapPrintifyOrder({
    ...base,
    line_items: [
      { quantity: 2, cost: 8974 },
      { quantity: 3, cost: 4500 },
    ],
  });
  assert.equal(cells[7], 134.74);
  assert.equal(cells[22], 5);
});
test("Phuc Printify: quantity 1 unchanged and absent cost stays blank", () => {
  assert.equal(
    mapPrintifyOrder({ ...base, line_items: [{ quantity: 1, cost: 1000 }] })[7],
    10,
  );
  assert.equal(
    mapPrintifyOrder({ ...base, line_items: [{ quantity: 2 }] })[7],
    "",
  );
});
test("Phuc Printify: reject invalid quantities and costs", () => {
  for (const quantity of [0, -1, 1.5, Number.NaN])
    assert.throws(
      () =>
        mapPrintifyOrder({ ...base, line_items: [{ quantity, cost: 100 }] }),
      /Số lượng/,
    );
  assert.throws(
    () => mapPrintifyOrder({ ...base, total_shipping: 12.5 }),
    /Chi phí/,
  );
});
