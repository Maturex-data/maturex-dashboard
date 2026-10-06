/**
 * Cấu hình và kiểu dữ liệu cho COGS - Nhà cung cấp Equarus
 * Ánh xạ sang 14 cột chuẩn của tab RAW.COGS trên Google Sheet:
 * Spreadsheet ID: 1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do (tab RAW.COGS - gid 58221536)
 */

export const RAW_COGS_HEADERS = [
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
  "Source line ID",
  "Source file",
] as const;

export type RawCogsHeader = (typeof RAW_COGS_HEADERS)[number];

export interface EquarusRawOrderRow {
  paymentId: string;
  sourceStore?: string;
  sourceChannel?: string;
  createDay: string | number | null;
  orderId: string;
  orderBaseCost: number | null;
  orderAmazonFulfillmentCost: number | null;
  orderAmount: number | null;
  orderStatus: string;
  rowNumber: number; // 1-indexed trong sheet nguồn
}

export interface EquarusPaymentSummary {
  paymentId: string;
  totalBaseCost: number | null;
  totalAmazonCost: number | null;
  totalAmount: number | null;
  claimsBack: number | null;
  totalPayment: number | null;
  ordersCount: number;
  sumOrdersAmount: number;
  difference: number; // totalAmount - sumOrdersAmount
}

export interface MappedCogsRow {
  "Etsy Order ID": string;
  "Supplier Order ID": string;
  Store: string;
  Supplier: string;
  "Source date": string;
  "Status nguồn": string;
  Currency: string;
  "Production cost": string | number;
  "Shipping cost": string | number;
  Tax: string;
  "Other cost": string;
  "Total cost nguồn": string | number;
  "Source line ID": string;
  "Source file": string;
  [key: string]: string | number | null | undefined;
}

export type StoreMappingStatus =
  | "CONFLICT_SOURCE_STORE"
  | "SKIPPED_TIKTOK"
  | "MAPPED_97DECOR"
  | "OUT_OF_SCOPE" // Ví dụ: Timond
  | "UNMAPPED_MISSING_ORDERS" // Chưa có trong RAW.Orders
  | "UNMAPPED_REPLACE_SUFFIX" // Có đuôi -Replace chưa map được
  | "CONFLICT_MULTIPLE_STORES";

export interface CogsValidationDetail {
  orderId: string;
  rowNumber: number;
  paymentId: string;
  status: StoreMappingStatus;
  detectedStore?: string;
  message: string;
}

export interface CogsExistingComparison {
  orderId: string;
  store: string;
  sourceAmount: number;
  existingCost: number;
  difference: number;
  status: "IDENTICAL" | "DIFF_COST" | "NOT_IN_COGS";
}

export interface CogsValidationSummary {
  fileName: string;
  fileSizeBytes: number;
  totalOrdersCount: number;
  skippedOrdersCount?: number;
  mapped97DecorCount: number;
  outOfScopeCount: number; // Timond
  unmappedCount: number; // 5 đơn chưa map
  conflictCount: number;
  alreadyInCogsCount: number;
  identicalCostCount: number;
  diffCostCount: number;
  paymentSummaries: EquarusPaymentSummary[];
  mathDiscrepanciesCount: number;
  validationDetails: CogsValidationDetail[];
  warnings: string[];
}

export interface CogsParseResult {
  headers: string[];
  rows: MappedCogsRow[];
  summary: CogsValidationSummary;
  existingComparisons: CogsExistingComparison[];
}
