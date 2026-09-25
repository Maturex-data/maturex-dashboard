export const MICROM_SPREADSHEET_ID =
  process.env.MICROM_SPREADSHEET_ID ||
  "15zckwx3zC-bY_AJsl19mFS1oRz7QkFL6NEW2huhxpuo";

export const MICROM_TIMEZONE = "Asia/Ho_Chi_Minh";
export const MICROM_START_DATE = "2026-01-01";
export const DEFAULT_FX_EUR_TO_USD = 1.15;

export const MICROM_TABS = {
  ORDERS: "Orders",
  COGS: "COGS",
  ADS: "Ads",
  SHOPIFY_ITEMS: "Shopify_Items",
} as const;

export type MicromTabName = (typeof MICROM_TABS)[keyof typeof MICROM_TABS];

export const NON_TARGET_TABS = ["PL", "Payroll", "Tools", "Sources"] as const;

export const ORDERS_COLUMNS = [
  "Order ID",
  "Shopify ID",
  "Ngày tạo",
  "Kỳ",
  "Trạng thái thanh toán",
  "Fulfillment",
  "Currency",
  "Subtotal",
  "Discount",
  "Shipping",
  "Tax",
  "Gross order",
  "Doanh thu hợp lệ (EUR)",
  "Nguồn dòng",
] as const;

export const COGS_COLUMNS = [
  "PGPrint Order ID",
  "PGC Order ID",
  "Customer Order ID",
  "Ngày tạo",
  "Kỳ",
  "Status (source)",
  "Currency",
  "Production",
  "Shipping",
  "COGS source USD",
  "COGS đủ điều kiện USD",
  "Nguồn dòng",
  "Kiểm soát",
] as const;

export const ADS_COLUMNS = [
  "Account",
  "Account ID",
  "Ngày",
  "Kỳ",
  "Spend USD",
  "Impressions",
  "Clicks",
  "Purchases",
  "Nguồn dòng",
  "Kiểm soát",
] as const;

export const SHOPIFY_ITEMS_COLUMNS = [
  "Order ID",
  "Line Item ID",
  "Tên sản phẩm",
  "SKU",
  "Quantity",
  "Line total",
  "Currency",
  "Fulfillment",
  "Nguồn dòng",
] as const;

export const TAB_COLUMNS_MAP = {
  [MICROM_TABS.ORDERS]: ORDERS_COLUMNS,
  [MICROM_TABS.COGS]: COGS_COLUMNS,
  [MICROM_TABS.ADS]: ADS_COLUMNS,
  [MICROM_TABS.SHOPIFY_ITEMS]: SHOPIFY_ITEMS_COLUMNS,
} as const;
