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
  status: "COMPLETED" | "FAILED";
  startedAt: Date;
  completedAt: Date;
  totalRows: number;
  insertedRows: number;
  ordersCount: number;
  cogsCount: number;
  adsCount: number;
  payoutsCount: number;
  summaries: Record<SheetName, ImportValidationSummary>;
  errorMessage?: string;
}
