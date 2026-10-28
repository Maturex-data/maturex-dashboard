import { createHash, randomUUID } from "node:crypto";
import { RAW_ITEMS_HEADERS } from "../items-parser/types";
import { RAW_ORDERS_HEADERS } from "../orders-parser/types";
import { RAW_STATEMENT_HEADERS } from "../statement-parser/types";

export const REPORTS = {
  orders: {
    headers: RAW_ORDERS_HEADERS,
    table: "etsy_orders",
    report: "ORDERS",
    date: "Sale Date",
  },
  items: {
    headers: RAW_ITEMS_HEADERS,
    table: "etsy_order_items",
    report: "ORDER_ITEMS",
    date: "Sale Date",
  },
  statements: {
    headers: RAW_STATEMENT_HEADERS,
    table: "etsy_statements",
    report: "STATEMENTS",
    date: "Date",
  },
} as const;
export type DashboardReport = keyof typeof REPORTS;
export const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");
const text = (value: unknown) =>
  value == null || String(value).trim() === "" || String(value).trim() === "--"
    ? null
    : String(value).trim();
export function sheetDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number")
    return new Date(Math.round((value - 25569) * 86400000))
      .toISOString()
      .slice(0, 10);
  const s = String(value).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return iso[0];
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (us)
    return `${us[3].length === 2 ? `20${us[3]}` : us[3]}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
  const parsed = new Date(s);
  return Number.isNaN(parsed.getTime())
    ? null
    : parsed.toISOString().slice(0, 10);
}
function money(value: unknown): number | null {
  const s = text(value);
  if (s === null || /^[–—-]$/.test(s)) return null;
  const raw = s.replaceAll(",", "").replace(/[^\d.-]/g, "");
  if (!raw || raw === "-")
    throw Error("Invalid money in BO dashboard mapping.");
  const valueNumber = Number(raw);
  if (!Number.isFinite(valueNumber))
    throw Error("Invalid money in BO dashboard mapping.");
  return s.startsWith("(") ? -Math.abs(valueNumber) : valueNumber;
}
const monetary = new Set([
  "Order Value",
  "Discount Amount",
  "Shipping Discount",
  "Shipping",
  "Sales Tax",
  "Order Total",
  "Card Processing Fees",
  "Order Net",
  "Adjusted Order Total",
  "Adjusted Card Processing Fees",
  "Adjusted Net Order Amount",
  "InPerson Discount",
  "Price",
  "Order Shipping",
  "Order Sales Tax",
  "Item Total",
  "VAT Paid by Buyer",
  "Amount",
  "Fees & Taxes",
  "Net",
]);
const dates = new Set(["Sale Date", "Date", "Date Paid", "Date Shipped"]);
export type RawBoRow = Record<string, unknown>;
export function mapDashboardRows(
  type: DashboardReport,
  rows: RawBoRow[],
  shopId: string,
  batchId: string,
) {
  const occurrences = new Map<string, number>();
  const seenOrders = new Set<string>();
  return rows.map((raw) => {
    const date = sheetDate(raw[REPORTS[type].date]);
    if (!date) throw Error(`Invalid ${type} date; dashboard sync stopped.`);
    const out: Record<string, unknown> = {
      id: randomUUID(),
      shop_id: shopId,
      import_batch_id: batchId,
      raw_payload: raw,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    for (const header of REPORTS[type].headers) {
      if (header === "Store") continue;
      const column =
        (
          {
            Date: "statement_date",
            "Fees & Taxes": "fees_and_taxes",
            "Ship Address1": "ship_address_1",
            "Ship Address2": "ship_address_2",
          } as Record<string, string>
        )[header] ??
        header
          .replace(/([a-z])([A-Z])/g, "$1 $2")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "_");
      const value = raw[header];
      out[column] = dates.has(header)
        ? sheetDate(value)
        : monetary.has(header)
          ? money(value)
          : header === "Number of Items" || header === "Quantity"
            ? text(value) === null
              ? null
              : Number(value)
            : text(value);
    }
    if (type === "orders") {
      if (!out.order_id || seenOrders.has(String(out.order_id)))
        throw Error("Missing/duplicate Order ID in shop dashboard import.");
      seenOrders.add(String(out.order_id));
    } else {
      let base: string;
      if (type === "items") {
        if (!out.order_id) throw Error("Missing Items Order ID.");
        base = text(raw["Transaction ID"]) ?? hash(JSON.stringify(raw));
        out.match_status = "UNMATCHED";
      } else {
        if (!out.type) throw Error("Missing Statement Type.");
        base = JSON.stringify([
          date,
          text(raw.Type),
          text(raw.Title),
          text(raw.Info),
          text(raw.Currency),
          money(raw.Amount),
          money(raw["Fees & Taxes"]),
          money(raw.Net),
          text(raw["Tax Details"]),
        ]);
        out.extracted_order_id =
          `${text(raw.Info) ?? ""} ${text(raw.Title) ?? ""}`.match(
            /Order\s*#?\s*(\d+)/i,
          )?.[1] ?? null;
      }
      const occurrence = (occurrences.get(base) ?? 0) + 1;
      occurrences.set(base, occurrence);
      out.source_key = hash(`${base}:${occurrence}`);
    }
    return out;
  });
}
