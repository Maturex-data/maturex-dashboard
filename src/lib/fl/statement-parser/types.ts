/**
 * Cấu hình và kiểu dữ liệu cho Etsy Payment Statement
 * Ánh xạ các cột Etsy Statement sang 10 cột chuẩn của tab RAW.Statement trên Google Sheet:
 * Spreadsheet ID: 1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do (tab RAW.Statement - gid 69264119)
 */

export const RAW_STATEMENT_HEADERS = [
  "Date",
  "Type",
  "Title",
  "Info",
  "Currency",
  "Amount",
  "Fees & Taxes",
  "Net",
  "Tax Details",
  "Store",
] as const;

export type RawStatementHeader = (typeof RAW_STATEMENT_HEADERS)[number];

export const ETSY_STATEMENT_SOURCE_HEADERS = [
  "Date",
  "Type",
  "Title",
  "Info",
  "Currency",
  "Amount",
  "Fees & Taxes",
  "Net",
  "Tax Details",
] as const;

export type EtsyStatementSourceHeader =
  (typeof ETSY_STATEMENT_SOURCE_HEADERS)[number];

export interface MappedStatementRow {
  Date: string;
  Type: string;
  Title: string;
  Info: string;
  Currency: string;
  Amount: string;
  "Fees & Taxes": string;
  Net: string;
  "Tax Details": string;
  Store: string;
  [key: string]: string | number | null | undefined;
}

export interface StatementValidationError {
  rowNumber: number; // 1-indexed trong CSV (tính cả header)
  column: string;
  message: string;
}

export interface StatementValidationSummary {
  fileName: string;
  fileSizeBytes: number;
  totalSourceRows: number;
  validRowsCount: number;
  errorRowsCount: number;
  verifiedMonth: string; // vd: "2026-09"
  verifiedMonthLabel: string; // vd: "Tháng 09/2026"
  detectedTypes: Record<string, number>;
  trailingExtraColumnUsed: boolean;
  errors: StatementValidationError[];
  warnings: string[];
}

export interface StatementParseResult {
  headers: string[];
  rows: MappedStatementRow[];
  summary: StatementValidationSummary;
}

export function getStatementHeaders(extended = false): readonly string[] {
  return extended
    ? [...ETSY_STATEMENT_SOURCE_HEADERS, "Status", "Availability Date", "Store"]
    : RAW_STATEMENT_HEADERS;
}
