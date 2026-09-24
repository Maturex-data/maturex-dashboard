import type { Prisma } from "@/generated/prisma/client";

export const EXPECTED_SHEET_HEADERS = {
  Orders: [
    "Month",
    "Source row",
    "Order",
    "Date",
    "Gross sales",
    "Discounts",
    "Shipping charged",
    "Original tax",
    "Corrected net",
    "Refund snapshot",
    "Before refund",
    "Source",
    "Item name",
  ],
  COGS: [
    "Month",
    "Source row",
    "Supplier",
    "Date",
    "Reference order ID",
    "Items name",
    "Supplier order ID",
    "Total cost",
    "Estimated cost",
    "Row key",
    "Treatment",
    "Source",
  ],
  Ads: [
    "Month",
    "Source row",
    "ID",
    "Date",
    "Account ID",
    "Campaign ID",
    "Campaign name",
    "Currency",
    "Spend",
    "Granularity",
    "Source",
  ],
  Payouts: [
    "Month local",
    "Source row",
    "Balance transaction ID",
    "Payout ID",
    "Type",
    "Currency",
    "Gross",
    "Fee",
    "Net",
    "Processed UTC",
    "Processed GMT+7",
    "Processed Vietnam",
    "Reason",
    "Source ID",
    "Order ID",
    "Source",
  ],
} as const;

export type SheetName = keyof typeof EXPECTED_SHEET_HEADERS;

export type ImportTriggerType = "MANUAL" | "CRON";

export type ImportErrorCategory =
  | "ALREADY_RUNNING"
  | "UPSTREAM_SYNC_RUNNING"
  | "GOOGLE_AUTH"
  | "GOOGLE_RATE_LIMIT"
  | "GOOGLE_PERMISSION"
  | "VALIDATION_ERROR"
  | "LOCK_STOLEN"
  | "SYSTEM_ERROR";

export class ImportError extends Error {
  readonly category: ImportErrorCategory;
  readonly status: number;

  constructor(
    message: string,
    category: ImportErrorCategory = "SYSTEM_ERROR",
    status = 500,
  ) {
    super(message);
    this.name = "ImportError";
    this.category = category;
    this.status = status;
  }
}

export class ImportAlreadyRunningError extends ImportError {
  constructor(
    message = "Một tác vụ đồng bộ đang chạy. Vui lòng đợi hoàn tất.",
  ) {
    super(message, "ALREADY_RUNNING", 409);
    this.name = "ImportAlreadyRunningError";
  }
}

export class UpstreamSyncInProgressError extends ImportError {
  constructor(
    message = "Một tác vụ EC Drive Sync đang chạy trên Google Sheet. Vui lòng đợi tác vụ hoàn thành để tránh sai lệch dữ liệu.",
  ) {
    super(message, "UPSTREAM_SYNC_RUNNING", 409);
    this.name = "UpstreamSyncInProgressError";
  }
}

export class GoogleAuthError extends ImportError {
  constructor(
    message = "Kết nối Google Drive / Sheets chưa được xác thực hoặc token đã hết hạn. Vui lòng kết nối lại tài khoản Google trong phần Cài đặt.",
  ) {
    super(message, "GOOGLE_AUTH", 401);
    this.name = "GoogleAuthError";
  }
}

export class GoogleRateLimitError extends ImportError {
  constructor(
    message = "Google Sheets API bị giới hạn tần suất (429 Rate Limit). Vui lòng thử lại sau.",
  ) {
    super(message, "GOOGLE_RATE_LIMIT", 429);
    this.name = "GoogleRateLimitError";
  }
}

export class GooglePermissionError extends ImportError {
  constructor(
    message = "Không có quyền truy cập Google Spreadsheet (403 Forbidden).",
  ) {
    super(message, "GOOGLE_PERMISSION", 403);
    this.name = "GooglePermissionError";
  }
}

export class SheetValidationError extends ImportError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR", 422);
    this.name = "SheetValidationError";
  }
}

export class LockStolenError extends ImportError {
  constructor(
    message = "Khóa import đã bị thu hồi hoặc quá hạn trong quá trình xử lý. Hủy lưu snapshot để bảo vệ dữ liệu.",
  ) {
    super(message, "LOCK_STOLEN", 409);
    this.name = "LockStolenError";
  }
}

export interface ParsedOrderRow {
  month: string;
  sourceRow: number;
  orderName: string;
  orderDate: Date;
  grossSales: Prisma.Decimal;
  discounts: Prisma.Decimal;
  shippingCharged: Prisma.Decimal;
  originalTax: Prisma.Decimal;
  correctedNet: Prisma.Decimal;
  refundSnapshot: Prisma.Decimal;
  beforeRefund: Prisma.Decimal;
  source: string | null;
  itemName: string | null;
  rawValues: Prisma.InputJsonValue;
}

export interface ParsedCogsRow {
  month: string;
  sourceRow: number;
  supplier: string;
  costDate: Date;
  referenceOrderId: string | null;
  itemsName: string | null;
  supplierOrderId: string | null;
  totalCost: Prisma.Decimal;
  estimatedCost: Prisma.Decimal;
  rowKey: string;
  treatment: string;
  source: string | null;
  rawValues: Prisma.InputJsonValue;
}

export interface ParsedAdRow {
  month: string;
  sourceRow: number;
  externalId: string;
  date: Date;
  accountId: string;
  campaignId: string | null;
  campaignName: string | null;
  currency: string;
  spend: Prisma.Decimal;
  granularity: string;
  source: string | null;
  rawValues: Prisma.InputJsonValue;
}

export interface ParsedPayoutRow {
  monthLocal: string;
  sourceRow: number;
  balanceTransactionId: string;
  payoutId: string | null;
  type: string;
  currency: string;
  gross: Prisma.Decimal;
  fee: Prisma.Decimal;
  net: Prisma.Decimal;
  processedUtc: Date;
  processedGmt7: string;
  processedVietnam: string;
  reason: string | null;
  sourceId: string | null;
  orderId: string | null;
  source: string | null;
  rawValues: Prisma.InputJsonValue;
}

export interface ImportValidationSummary {
  sheet: SheetName;
  totalRows: number;
  distinctKeys: number;
  monthCounts: Record<string, number>;
  sums: Record<string, string>;
  checksum: string;
}

export interface SheetImportResult {
  runId: string;
  spreadsheetId: string;
  status: "COMPLETED" | "NO_CHANGE" | "FAILED";
  triggerType: ImportTriggerType;
  startedAt: Date;
  completedAt: Date;
  totalRows: number;
  insertedRows: number;
  ordersCount: number;
  cogsCount: number;
  adsCount: number;
  payoutsCount: number;
  summaries: Record<SheetName, ImportValidationSummary>;
  elapsedMs: number;
  message?: string;
  isNoChange?: boolean;
  errorMessage?: string;
  errorCategory?: ImportErrorCategory;
}
