/**
 * 37 cột chuẩn của tab RAW.Orders trên Google Sheet:
 * 1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do (tab RAW.Orders - gid 839747432)
 */
export const RAW_ORDERS_HEADERS = [
  "Sale Date",
  "Order ID",
  "Buyer User ID",
  "Full Name",
  "First Name",
  "Last Name",
  "Number of Items",
  "Payment Method",
  "Date Shipped",
  "Street 1",
  "Street 2",
  "Ship City",
  "Ship State",
  "Ship Zipcode",
  "Ship Country",
  "Currency",
  "Order Value",
  "Coupon Code",
  "Coupon Details",
  "Discount Amount",
  "Shipping Discount",
  "Shipping",
  "Sales Tax",
  "Order Total",
  "Status",
  "Card Processing Fees",
  "Order Net",
  "Adjusted Order Total",
  "Adjusted Card Processing Fees",
  "Adjusted Net Order Amount",
  "Buyer",
  "Order Type",
  "Payment Type",
  "InPerson Discount",
  "InPerson Location",
  "SKU",
  "Store",
] as const;

export type RawOrderHeader = (typeof RAW_ORDERS_HEADERS)[number];

/** 36 cột nguồn từ Etsy Sold Orders (không có cột Store) */
export const ETSY_ORDERS_SOURCE_HEADERS = RAW_ORDERS_HEADERS.slice(
  0,
  36,
) as unknown as readonly string[];

/** Danh sách các cột dạng số (float/int). Trường trống giữ trống, không ép về 0 */
export const NUMERIC_COLUMNS = new Set<string>([
  "Number of Items",
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
]);

/** Danh sách các cột bắt buộc giữ nguyên text (không bao giờ convert thành số để bảo toàn số 0 đầu) */
export const TEXT_PRESERVED_COLUMNS = new Set<string>([
  "Order ID",
  "Ship Zipcode",
  "SKU",
  "Buyer User ID",
]);

export interface ColumnMappingInfo {
  sourceColumn: string;
  targetColumn: string;
  dataType: "string" | "number";
  rule: string;
  required: boolean;
}

export interface ValidationErrorItem {
  rowNumber: number;
  orderId?: string;
  column?: string;
  message: string;
}

export interface OrdersValidationSummary {
  fileName: string;
  fileSizeBytes: number;
  totalSourceRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  duplicateOrderIds: Array<{ orderId: string; count: number; rows: number[] }>;
  errors: ValidationErrorItem[];
  warnings: string[];
  shopCode: string;
  storeValue: string;
  detectedShopName: string;
}

export type MappedOrderCell = string | number | null;
export type MappedOrderRow = Record<RawOrderHeader, MappedOrderCell>;
