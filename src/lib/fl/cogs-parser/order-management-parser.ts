import * as XLSX from "xlsx";
import type { ParsedEquarusWorkbook } from "./equarus-parser";

/** Order-level cells are populated only on the first row of each merged order. */
export function parseOrderManagement(
  worksheet: XLSX.WorkSheet,
): ParsedEquarusWorkbook {
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    raw: true,
    defval: "",
  });
  const headers = (matrix[0] ?? []).map((v) => String(v).trim());
  const required = [
    "Create Day",
    "Order ID",
    "STORE",
    "Partner Sales Channel",
    "Order Base Cost",
    "Order Fulfillment Cost",
    "Order Amount",
    "Order Status",
    "Payment ID",
  ];
  const indices = new Map<string, number>();
  for (const name of required) {
    const matches = headers.flatMap((h, i) => (h === name ? [i] : []));
    if (matches.length !== 1)
      throw new Error(`Header Order Management thiếu hoặc trùng: ${name}`);
    indices.set(name, matches[0]);
  }
  const cost = (v: unknown, row: number, column: string): number | null => {
    const text = String(v ?? "").trim();
    if (!text) return null;
    if (!/^-?\d+(?:[.,]\d+)?$/.test(text))
      throw new Error(`Chi phí không hợp lệ tại hàng ${row}, cột ${column}.`);
    const value = Number(text.replace(",", "."));
    if (!Number.isFinite(value))
      throw new Error(`Chi phí không hợp lệ tại hàng ${row}, cột ${column}.`);
    return value;
  };
  const orderRows: ParsedEquarusWorkbook["orderRows"] = [];
  for (let i = 2; i < matrix.length; i++) {
    const row = matrix[i];
    const cell = (name: string) => row[indices.get(name) as number];
    const rawId = cell("Order ID");
    if (String(rawId ?? "").trim() === "") continue;
    if (typeof rawId === "number" && !Number.isSafeInteger(rawId))
      throw new Error(
        `Order ID hàng ${i + 1} cần dạng text để giữ độ chính xác.`,
      );
    orderRows.push({
      orderId: String(rawId).trim(),
      paymentId: String(cell("Payment ID") ?? "").trim(),
      createDay: cell("Create Day") as string | number | null,
      orderBaseCost: cost(cell("Order Base Cost"), i + 1, "Order Base Cost"),
      orderAmazonFulfillmentCost: cost(
        cell("Order Fulfillment Cost"),
        i + 1,
        "Order Fulfillment Cost",
      ),
      orderAmount: cost(cell("Order Amount"), i + 1, "Order Amount"),
      orderStatus: String(cell("Order Status") ?? "").trim(),
      sourceStore: String(cell("STORE") ?? "").trim(),
      sourceChannel: String(cell("Partner Sales Channel") ?? "").trim(),
      rowNumber: i + 1,
    });
  }
  if (!orderRows.length)
    throw new Error("Order Management không có dòng đơn hàng.");
  // This export has payment IDs but no declared payment totals. Do not invent totals.
  return { orderRows, paymentSummaries: [] };
}
