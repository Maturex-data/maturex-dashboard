import { formatVietnamDate } from "@/lib/date-time";

export const FLOWA_REPORT_SPREADSHEET_ID =
  process.env.FLOWA_REPORT_SPREADSHEET_ID ||
  "1WwPh11M0ZEphoYkEHPbN4v-UDOEH1clhCY9E9xq0hrc";

export const FLOWA_REPORT_SHEETS = {
  Statement: {
    lastColumn: "M",
    dateIndex: 3, // Column D: "Date"
    monthIndex: 0, // Column A: "Month"
    source: "all-data / FLOWA_STATEMENTS",
  },
  COGS: {
    lastColumn: "F",
    dateIndex: 0, // Column A: "Month"
    monthIndex: 0,
    source: "all-data / FLOWA_COGS",
  },
} as const;

export type FlowaReportSheet = keyof typeof FLOWA_REPORT_SHEETS;
export type FlowaSheetValue = string | number | null;

export const REFUND_MONTH_OVERRIDES: Record<string, string> = {
  // The Sold Orders export for June is unavailable, but this historic refund
  // belongs to a June order and is classified that way in the accounting file.
  "4099070269": "2026-06",
};

export const COGS_TOTAL_COST_OVERRIDES: Record<string, number> = {
  // The historic workbook classifies these merged Jodoo orders using their
  // corrected landed cost rather than the raw Order Amount column.
  "4136711440": 39.29,
  "4150564675": 75.69,
};

export function isFlowaReportSheet(value: string): value is FlowaReportSheet {
  return value in FLOWA_REPORT_SHEETS;
}

export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

export function numeric(value: unknown): number {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

export function databaseDateRange(
  from: Date,
  to: Date,
): { from: Date; to: Date } {
  return {
    from: new Date(`${formatVietnamDate(from)}T00:00:00.000Z`),
    to: new Date(`${formatVietnamDate(to)}T00:00:00.000Z`),
  };
}

export function flowaShopLabel(shopCode: string, reportMonth: string): string {
  if (
    shopCode === "ARTISANHAND" &&
    (reportMonth === "2026-06" || reportMonth === "2026-07")
  ) {
    return "ARTISANSHAND";
  }
  return shopCode;
}

export function flowaSupplierLabel(supplier: string): string {
  return supplier === "Fastway" ? "LEN/Fastway" : supplier;
}

export function rawArray(value: unknown): unknown[] {
  const payload = record(value);
  return Array.isArray(payload.raw) ? payload.raw : [];
}

export function rawText(value: unknown): string {
  return text(value).trim();
}

export function cogsCostForReport(
  referenceOrderId: string | null,
  totalCost: number,
): number {
  return referenceOrderId
    ? (COGS_TOTAL_COST_OVERRIDES[referenceOrderId] ?? totalCost)
    : totalCost;
}

export function statementRowKey(row: FlowaSheetValue[]): string {
  return [row[3], row[4], row[5], row[6], row[11]].map(text).join("|");
}

export function formatEtsyStatementDate(date: Date): string {
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${months[date.getUTCMonth()]} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}
