export interface ShopOption {
  code: string;
  name: string;
}

export type Column = readonly [string, string];

export interface DataRow {
  id: string | number;
  currency?: string;
  [key: string]: unknown;
}

export type TableTab = "orders" | "items" | "statements";

export const orderColumns = [
  ["order_id", "Order ID"],
  ["shop_name", "Shop"],
  ["sale_date", "Sale Date"],
  ["full_name", "Buyer / Name"],
  ["buyer_user_id", "Buyer User ID"],
  ["first_name", "First Name"],
  ["last_name", "Last Name"],
  ["number_of_items", "Items"],
  ["payment_method", "Payment Method"],
  ["currency", "Curr"],
  ["order_value", "Order Value"],
  ["discount_amount", "Discount"],
  ["shipping", "Shipping"],
  ["shipping_discount", "Shipping Discount"],
  ["sales_tax", "Sales Tax"],
  ["order_total", "Total"],
  ["card_processing_fees", "Fee (Card)"],
  ["order_net", "Order Net"],
  ["adjusted_order_total", "Adjusted Total"],
  ["adjusted_card_processing_fees", "Adjusted Card Fee"],
  ["adjusted_net_order_amount", "Adjusted Net"],
  ["coupon_code", "Coupon Code"],
  ["coupon_details", "Coupon Details"],
  ["buyer", "Buyer"],
  ["order_type", "Order Type"],
  ["payment_type", "Payment Type"],
  ["in_person_discount", "In-Person Discount"],
  ["in_person_location", "In-Person Location"],
  ["status", "Status"],
  ["date_shipped", "Shipped Date"],
  ["ship_country", "Country"],
  ["ship_city", "City"],
  ["ship_state", "State"],
  ["ship_zipcode", "ZIP Code"],
  ["street_1", "Street 1"],
  ["street_2", "Street 2"],
  ["sku", "SKU"],
] as const satisfies readonly Column[];

export const itemColumns = [
  ["order_id", "Order ID"],
  ["shop_name", "Shop"],
  ["sale_date", "Sale Date"],
  ["item_name", "Item Name"],
  ["buyer", "Buyer"],
  ["sku", "SKU"],
  ["listing_id", "Listing ID"],
  ["variations", "Variations"],
  ["quantity", "Qty"],
  ["currency", "Curr"],
  ["price", "Price"],
  ["discount_amount", "Discount"],
  ["coupon_code", "Coupon Code"],
  ["coupon_details", "Coupon Details"],
  ["shipping_discount", "Shipping Discount"],
  ["order_shipping", "Shipping"],
  ["order_sales_tax", "Sales Tax"],
  ["item_total", "Item Total"],
  ["transaction_id", "Transaction ID"],
  ["date_paid", "Date Paid"],
  ["date_shipped", "Date Shipped"],
  ["ship_name", "Ship Name"],
  ["ship_address1", "Address 1"],
  ["ship_address2", "Address 2"],
  ["ship_city", "City"],
  ["ship_state", "State"],
  ["ship_zipcode", "ZIP Code"],
  ["ship_country", "Country"],
  ["order_type", "Order Type"],
  ["listings_type", "Listings Type"],
  ["payment_type", "Payment Type"],
  ["in_person_discount", "In-Person Discount"],
  ["in_person_location", "In-Person Location"],
  ["vat_paid_by_buyer", "VAT Paid by Buyer"],
  ["match_status", "Match"],
] as const satisfies readonly Column[];

export const statementColumns = [
  ["statement_date", "Date"],
  ["shop_name", "Shop"],
  ["type", "Type"],
  ["title", "Title"],
  ["info", "Details / Info"],
  ["extracted_order_id", "Order Ref"],
  ["currency", "Curr"],
  ["amount", "Amount"],
  ["fees_and_taxes", "Fees & Taxes"],
  ["net", "Net"],
  ["tax_details", "Tax Details"],
] as const satisfies readonly Column[];

export const MONEY_COLUMNS = new Set([
  "order_value",
  "discount_amount",
  "shipping",
  "shipping_discount",
  "sales_tax",
  "order_total",
  "card_processing_fees",
  "order_net",
  "adjusted_order_total",
  "adjusted_card_processing_fees",
  "adjusted_net_order_amount",
  "in_person_discount",
  "price",
  "order_shipping",
  "shipping_discount",
  "order_sales_tax",
  "item_total",
  "vat_paid_by_buyer",
  "amount",
  "fees_and_taxes",
  "net",
]);

export const SORTABLE_COLUMNS = new Set([
  "order_id",
  "sale_date",
  "order_value",
  "order_total",
  "order_net",
  "item_total",
  "statement_date",
  "amount",
  "fees_and_taxes",
  "net",
]);

export function isTableTab(value: string | null): value is TableTab {
  return value === "orders" || value === "items" || value === "statements";
}

export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

export function endpointForTab(tab: TableTab): string {
  return tab === "orders"
    ? "/api/etsy/orders"
    : tab === "items"
      ? "/api/etsy/items"
      : "/api/etsy/statements";
}
