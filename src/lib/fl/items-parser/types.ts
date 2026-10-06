/**
 * Cấu hình và kiểu dữ liệu cho Etsy Sold Order Items
 * Ánh xạ 33 cột Etsy sang 34 cột chuẩn của tab RAW.Items trên Google Sheet:
 * Spreadsheet ID: 1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do (tab RAW.Items - gid 136409036)
 */

export const RAW_ITEMS_HEADERS = [
  "Sale Date",
  "Item Name",
  "Buyer",
  "Quantity",
  "Price",
  "Coupon Code",
  "Coupon Details",
  "Discount Amount",
  "Shipping Discount",
  "Order Shipping",
  "Order Sales Tax",
  "Item Total",
  "Currency",
  "Transaction ID",
  "Listing ID",
  "Date Paid",
  "Date Shipped",
  "Ship Name",
  "Ship Address1",
  "Ship Address2",
  "Ship City",
  "Ship State",
  "Ship Zipcode",
  "Ship Country",
  "Order ID",
  "Variations",
  "Order Type",
  "Listings Type",
  "Payment Type",
  "InPerson Discount",
  "InPerson Location",
  "VAT Paid by Buyer",
  "SKU",
  "Store",
] as const;

export type RawItemHeader = (typeof RAW_ITEMS_HEADERS)[number];

export const ETSY_ITEMS_SOURCE_HEADERS = [
  "Sale Date",
  "Item Name",
  "Buyer",
  "Quantity",
  "Price",
  "Coupon Code",
  "Coupon Details",
  "Discount Amount",
  "Shipping Discount",
  "Order Shipping",
  "Order Sales Tax",
  "Item Total",
  "Currency",
  "Transaction ID",
  "Listing ID",
  "Date Paid",
  "Date Shipped",
  "Ship Name",
  "Ship Address1",
  "Ship Address2",
  "Ship City",
  "Ship State",
  "Ship Zipcode",
  "Ship Country",
  "Order ID",
  "Variations",
  "Order Type",
  "Listings Type",
  "Payment Type",
  "InPerson Discount",
  "InPerson Location",
  "VAT Paid by Buyer",
  "SKU",
] as const;

export type EtsyItemSourceHeader = (typeof ETSY_ITEMS_SOURCE_HEADERS)[number];

/** Các cột ID bắt buộc giữ nguyên định dạng text không bao giờ chuyển thành số */
export const TEXT_ITEM_COLUMNS = new Set<string>([
  "Transaction ID",
  "Listing ID",
  "Order ID",
  "SKU",
  "Ship Zipcode",
  "Buyer",
]);

/** Các cột số tiền / số lượng cần kiểm tra hợp lệ */
export const NUMERIC_ITEM_COLUMNS = new Set<string>([
  "Quantity",
  "Price",
  "Discount Amount",
  "Shipping Discount",
  "Order Shipping",
  "Order Sales Tax",
  "Item Total",
  "InPerson Discount",
  "VAT Paid by Buyer",
]);

export interface MappedItemRow {
  "Sale Date": string;
  "Item Name": string;
  Buyer: string;
  Quantity: number | string;
  Price: number | string;
  "Coupon Code": string;
  "Coupon Details": string;
  "Discount Amount": number | string;
  "Shipping Discount": number | string;
  "Order Shipping": number | string;
  "Order Sales Tax": number | string;
  "Item Total": number | string;
  Currency: string;
  "Transaction ID": string;
  "Listing ID": string;
  "Date Paid": string;
  "Date Shipped": string;
  "Ship Name": string;
  "Ship Address1": string;
  "Ship Address2": string;
  "Ship City": string;
  "Ship State": string;
  "Ship Zipcode": string;
  "Ship Country": string;
  "Order ID": string;
  Variations: string;
  "Order Type": string;
  "Listings Type": string;
  "Payment Type": string;
  "InPerson Discount": number | string;
  "InPerson Location": string;
  "VAT Paid by Buyer": number | string;
  SKU: string;
  Store: string;
  [key: string]: string | number | null | undefined;
}

export interface ItemValidationError {
  rowNumber: number; // 1-indexed trong file CSV (tính cả header)
  transactionId?: string;
  orderId?: string;
  column: string;
  message: string;
}

export interface ItemsValidationSummary {
  fileName: string;
  fileSizeBytes: number;
  totalSourceRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  duplicateTransactionIds: string[];
  multiItemOrdersCount: number;
  errors: ItemValidationError[];
  warnings: string[];
}

export interface ItemsParseResult {
  headers: string[];
  rows: MappedItemRow[];
  summary: ItemsValidationSummary;
}
