export type RawValue = string | number | null;
export type RawRow = Record<string, RawValue>;
export type Column = readonly [string, string];

export const orderColumns = [
  ["order_name", "Order Name"],
  ["order_date", "Order Date"],
  ["financial_status", "Financial"],
  ["fulfillment_status", "Fulfillment"],
  ["fulfillment_date", "Fulfillment Date"],
  ["delivery_status", "Delivery"],
  ["delivery_date", "Delivery Date"],
  ["gross_sales", "Gross Sales"],
  ["discounts", "Discounts"],
  ["shipping_charged", "Shipping"],
  ["sales_tax", "Tax"],
  ["order_total_before_refund", "Total Pre-Refund"],
  ["calc_net_order_after_refund", "Net Post-Refund"],
  ["refund_amount", "Refund"],
  ["refund_date", "Refund Date"],
  ["items", "Items"],
  ["tag", "Tags"],
] as const satisfies readonly Column[];

export const cogsColumns = [
  ["supplier", "Supplier"],
  ["date", "Date"],
  ["reference_order_id", "Ref Order ID"],
  ["supplier_order_id", "Supplier Order ID"],
  ["total cost", "Total Cost"],
  ["est.cost", "Est. Cost"],
] as const satisfies readonly Column[];

export const payoutColumns = [
  ["balance_transaction_id", "Balance Tx ID"],
  ["payout_id", "Payout ID"],
  ["payout_status", "Payout Status"],
  ["transaction_type", "Type"],
  ["transaction_status", "Status"],
  ["currency", "Currency"],
  ["gross_amount", "Gross Amount"],
  ["fee_amount", "Fee"],
  ["net_amount", "Net Amount"],
  ["source_order_name", "Order Name"],
  ["processed_at_vietnam", "Processed Date (VN)"],
  ["adjustment_reason", "Reason"],
] as const satisfies readonly Column[];

export const PAGE_SIZE = 40;

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)}/${year}`;
}

export const MONEY_COLUMNS = new Set([
  "gross_sales",
  "discounts",
  "shipping_charged",
  "sales_tax",
  "order_total_before_refund",
  "calc_net_order_after_refund",
  "refund_amount",
  "total cost",
  "est.cost",
  "gross_amount",
  "fee_amount",
  "net_amount",
]);
