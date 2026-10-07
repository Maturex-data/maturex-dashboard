export interface PrintifySyncOptions {
  fromDate?: string;
  toDate?: string;
}
export interface PrintifySyncResult {
  totalFetched: number;
  selectedCount: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
}
export interface PrintifyOrder {
  id: string;
  created_at: string;
  status?: string;
  total_shipping?: number;
  total_tax?: number;
  address_to?: {
    first_name?: string;
    last_name?: string;
    phone?: string;
    email?: string;
    address1?: string;
    address2?: string;
    city?: string;
    region?: string;
    zip?: string;
    country?: string;
  };
  line_items?: {
    cost?: number;
    quantity: number;
    metadata?: { title?: string; sku?: string };
  }[];
}
export const PHUC_PRINTIFY_COGS_HEADERS = [
  "Etsy Order ID",
  "Supplier Order ID",
  "Store",
  "Supplier",
  "Source date",
  "Status nguồn",
  "Currency",
  "Production cost",
  "Shipping cost",
  "Tax",
  "Other cost",
  "Total cost nguồn",
  "Recipient name",
  "Phone",
  "Email",
  "Address 1",
  "Address 2",
  "City",
  "State / Region",
  "Postal code",
  "Country",
  "Items name",
  "Items quantity",
  "Items SKU",
] as const;
export function mapPrintifyOrder(order: PrintifyOrder): (string | number)[] {
  const text = (value?: string) => value ?? "";
  const money = (value?: number) => {
    if (value === undefined) return "";
    if (!Number.isSafeInteger(value))
      throw Error("Chi phí Printify không hợp lệ.");
    return value / 100;
  };
  const items = order.line_items ?? [],
    address = order.address_to ?? {};
  if (!order.id || !order.created_at)
    throw Error("Printify trả về đơn thiếu ID hoặc ngày.");
  if (
    items.some(
      (item) => !Number.isSafeInteger(item.quantity) || item.quantity < 1,
    )
  )
    throw Error("Số lượng item không hợp lệ.");
  if (items.some((item) => item.quantity !== 1))
    throw Error(
      "Đơn có item quantity khác 1. Cần xác minh cách tính cost trước khi đồng bộ.",
    );
  const production =
    items.length && items.every((item) => Number.isSafeInteger(item.cost))
      ? items.reduce((sum, item) => sum + (item.cost ?? 0), 0) / 100
      : "";
  return [
    "",
    order.id,
    "",
    "PRINTIFY",
    order.created_at,
    text(order.status),
    "",
    production,
    money(order.total_shipping),
    money(order.total_tax),
    "",
    "",
    [address.first_name, address.last_name].filter(Boolean).join(" "),
    text(address.phone),
    text(address.email),
    text(address.address1),
    text(address.address2),
    text(address.city),
    text(address.region),
    text(address.zip),
    text(address.country),
    items
      .map((item) => item.metadata?.title)
      .filter(Boolean)
      .join("; "),
    items.length ? items.reduce((sum, item) => sum + item.quantity, 0) : "",
    items
      .map((item) => item.metadata?.sku)
      .filter(Boolean)
      .join("; "),
  ];
}
