import type { MicromTabName } from "./constants";

export interface MicromOrderRow {
  orderId: string;
  shopifyId: string;
  ngayTao: string; // YYYY-MM-DD
  ky: string; // YYYY-MM
  trangThaiThanhToan: string;
  fulfillment: string;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  grossOrder: number;
  doanhThuHopLeEur: number;
  nguonDong: string;
}

export interface MicromCogsRow {
  pgprintOrderId: string;
  pgcOrderId: string;
  customerOrderId: string;
  ngayTao: string; // YYYY-MM-DD
  ky: string; // YYYY-MM
  statusSource: string;
  currency: string;
  production: number;
  shipping: number;
  cogsSourceUsd: number;
  cogsDuDieuKienUsd: number;
  nguonDong: string;
  kiemSoat: string;
}

export interface MicromAdRow {
  account: string;
  accountId: string;
  ngay: string; // YYYY-MM-DD
  ky: string; // YYYY-MM
  spendUsd: number;
  impressions: number;
  clicks: number;
  purchases: number;
  nguonDong: string;
  kiemSoat: string;
}

export interface MicromShopifyItemRow {
  orderId: string;
  lineItemId: string;
  tenSanPham: string;
  sku: string;
  quantity: number;
  lineTotal: number;
  currency: string;
  fulfillment: string;
  nguonDong: string;
}

export interface TabFingerprints {
  Orders?: string;
  COGS?: string;
  Ads?: string;
  Shopify_Items?: string;
  [key: string]: string | undefined;
}

export interface TabStats {
  rowCount: number;
  sumField?: string;
  totalSum?: number;
  minDate?: string;
  maxDate?: string;
}

export interface ProviderSyncResult<T> {
  provider: "SHOPIFY" | "PGPRINT" | "META";
  success: boolean;
  rows: T[];
  count: number;
  errorMessage?: string;
  stats?: Record<string, unknown>;
}

export interface MicromProviderRunSummary {
  runId: string;
  startedAt: string;
  completedAt?: string;
  status: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED";
  isReconciled: boolean;
  fingerprints?: TabFingerprints;
  perTabFingerprints?: TabFingerprints;
  stats: Record<string, TabStats>;
  sources?: Record<string, unknown>;
  errors?: string[];
}

export class MicromError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "MicromError";
  }
}

export class MicromHeaderDriftError extends MicromError {
  constructor(
    tab: MicromTabName,
    expected: readonly string[],
    actual: unknown[],
  ) {
    super(
      `Cấu trúc cột tab "${tab}" trên Google Sheet không khớp với mẫu chuẩn quy định.\nKỳ vọng: ${expected.join(", ")}\nThực tế: ${actual.join(", ")}`,
      "HEADER_DRIFT",
      { tab, expected, actual },
    );
    this.name = "MicromHeaderDriftError";
  }
}

export class MicromLockError extends MicromError {
  constructor(
    message = "Một tác vụ Microm đang chạy. Vui lòng đợi hoặc thử lại sau.",
  ) {
    super(message, "CONCURRENT_LOCK");
    this.name = "MicromLockError";
  }
}

export class MicromReconciliationError extends MicromError {
  constructor(message: string, details?: unknown) {
    super(message, "RECONCILIATION_FAILED", details);
    this.name = "MicromReconciliationError";
  }
}
