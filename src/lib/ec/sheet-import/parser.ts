import { Prisma } from "@/generated/prisma/client";
import {
  EXPECTED_SHEET_HEADERS,
  type ParsedAdRow,
  type ParsedCogsRow,
  type ParsedOrderRow,
  type ParsedPayoutRow,
  type SheetName,
  SheetValidationError,
} from "./types";

/**
 * Robust decimal parser for financial cells in Google Sheets.
 * Handles:
 * - Direct numbers (e.g. 45.99)
 * - Comma as decimal separator (e.g. "45,99")
 * - Thousands comma + dot decimal (e.g. "105,935.39")
 * - Thousands dot + comma decimal (e.g. "105.935,39")
 * - Currency symbols ($, USD)
 * - Parenthesized negatives (e.g. "(45.99)" -> -45.99)
 */
export function parseDecimal(
  value: unknown,
  context: { sheet: SheetName; row: number; colName: string },
): Prisma.Decimal {
  if (value === null || value === undefined || value === "") {
    return new Prisma.Decimal(0);
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new SheetValidationError(
        `Giá trị số không hợp lệ tại sheet ${context.sheet} dòng ${context.row} cột "${context.colName}": ${value}`,
      );
    }
    return new Prisma.Decimal(value);
  }

  const rawStr = String(value).trim();
  if (rawStr === "" || rawStr === "-" || rawStr === "--") {
    return new Prisma.Decimal(0);
  }

  let isNegative = false;
  let str = rawStr;

  // Check parenthesized negative: (123.45) or (123,45)
  if (str.startsWith("(") && str.endsWith(")")) {
    isNegative = true;
    str = str.slice(1, -1).trim();
  }

  if (str.startsWith("-")) {
    isNegative = true;
    str = str.slice(1).trim();
  } else if (str.endsWith("-")) {
    isNegative = true;
    str = str.slice(0, -1).trim();
  }

  // Remove currency signs and spaces
  str = str.replace(/[$₫€£¥\s]|USD/gi, "").trim();

  // If contains both comma and period
  if (str.includes(",") && str.includes(".")) {
    const firstComma = str.indexOf(",");
    const firstDot = str.indexOf(".");
    if (firstComma < firstDot) {
      // 105,935.39 -> comma is thousands, dot is decimal
      str = str.replace(/,/g, "");
    } else {
      // 105.935,39 -> dot is thousands, comma is decimal
      str = str.replace(/\./g, "").replace(",", ".");
    }
  } else if (str.includes(",")) {
    // Only commas
    const parts = str.split(",");
    if (parts.length > 2) {
      // Multiple commas: 1,000,000 -> thousands
      str = str.replace(/,/g, "");
    } else {
      // Single comma: e.g. "45,99" or "105,93" -> decimal separator
      str = str.replace(",", ".");
    }
  }

  // Validate pure decimal format
  if (!/^\d+(\.\d+)?$/.test(str)) {
    throw new SheetValidationError(
      `Không thể đọc giá trị tiền tệ "${rawStr}" tại sheet ${context.sheet} dòng ${context.row} cột "${context.colName}"`,
    );
  }

  try {
    const dec = new Prisma.Decimal(str);
    return isNegative ? dec.negated() : dec;
  } catch {
    throw new SheetValidationError(
      `Lỗi chuyển đổi tiền tệ "${rawStr}" tại sheet ${context.sheet} dòng ${context.row} cột "${context.colName}"`,
    );
  }
}

export function parseString(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" || s === "--" || s === "-" ? null : s;
}

export function parseRequiredString(
  value: unknown,
  context: { sheet: SheetName; row: number; colName: string },
): string {
  const s = parseString(value);
  if (!s) {
    throw new SheetValidationError(
      `Thiếu giá trị bắt buộc tại sheet ${context.sheet} dòng ${context.row} cột "${context.colName}"`,
    );
  }
  return s;
}

export function parseInteger(
  value: unknown,
  context: { sheet: SheetName; row: number; colName: string },
): number {
  if (typeof value === "number") return Math.trunc(value);
  const s = parseRequiredString(value, context).replace(/,/g, "");
  const num = Number.parseInt(s, 10);
  if (!Number.isFinite(num)) {
    throw new SheetValidationError(
      `Giá trị số nguyên không hợp lệ "${value}" tại sheet ${context.sheet} dòng ${context.row} cột "${context.colName}"`,
    );
  }
  return num;
}

export function parseDateOnly(
  value: unknown,
  context: { sheet: SheetName; row: number; colName: string },
): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()),
    );
  }

  const s = parseRequiredString(value, context);

  // Match YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (isoMatch) {
    const year = Number.parseInt(isoMatch[1], 10);
    const month = Number.parseInt(isoMatch[2], 10) - 1;
    const day = Number.parseInt(isoMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  // Match M/D/YYYY or D/M/YYYY
  const slashMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (slashMatch) {
    const month = Number.parseInt(slashMatch[1], 10) - 1;
    const day = Number.parseInt(slashMatch[2], 10);
    const year = Number.parseInt(slashMatch[3], 10);
    return new Date(Date.UTC(year, month, day));
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) {
    throw new SheetValidationError(
      `Định dạng ngày không hợp lệ "${s}" tại sheet ${context.sheet} dòng ${context.row} cột "${context.colName}"`,
    );
  }
  return new Date(
    Date.UTC(
      parsed.getUTCFullYear(),
      parsed.getUTCMonth(),
      parsed.getUTCDate(),
    ),
  );
}

export function parseUtcTimestamp(
  value: unknown,
  context: { sheet: SheetName; row: number; colName: string },
): Date {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value;
  }
  const s = parseRequiredString(value, context);
  const parsed = new Date(s.includes("Z") ? s : `${s}Z`);
  if (Number.isNaN(parsed.getTime())) {
    // Try standard Date parsing
    const standard = new Date(s);
    if (!Number.isNaN(standard.getTime())) return standard;
    throw new SheetValidationError(
      `Định dạng timestamp UTC không hợp lệ "${s}" tại sheet ${context.sheet} dòng ${context.row} cột "${context.colName}"`,
    );
  }
  return parsed;
}

export function validateSheetHeaders(
  sheetName: SheetName,
  actualHeaders: unknown[],
): void {
  const expected = EXPECTED_SHEET_HEADERS[sheetName];
  if (!actualHeaders || actualHeaders.length < expected.length) {
    throw new SheetValidationError(
      `Cấu trúc header sheet ${sheetName} không khớp: yêu cầu tối thiểu ${expected.length} cột, nhận được ${actualHeaders?.length ?? 0}`,
    );
  }

  for (let i = 0; i < expected.length; i++) {
    const act = String(actualHeaders[i] ?? "").trim();
    const exp = expected[i];
    if (act.toLowerCase() !== exp.toLowerCase()) {
      throw new SheetValidationError(
        `Cấu trúc header sheet ${sheetName} tại cột ${i + 1} không khớp: yêu cầu "${exp}", nhận được "${act}"`,
      );
    }
  }
}

export function parseOrderRows(rows: unknown[][]): ParsedOrderRow[] {
  const results: ParsedOrderRow[] = [];
  const seenKeys = new Set<string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (
      !row ||
      row.length === 0 ||
      row.every((c) => c === null || c === "" || c === undefined)
    ) {
      continue; // Skip completely blank row
    }
    const rowNumber = idx + 2; // +1 for 0-index, +1 for header
    const ctx = (colName: string) => ({
      sheet: "Orders" as const,
      row: rowNumber,
      colName,
    });

    const month = parseRequiredString(row[0], ctx("Month"));
    const sourceRow = parseInteger(row[1], ctx("Source row"));
    const orderName = parseRequiredString(row[2], ctx("Order"));

    if (seenKeys.has(orderName)) {
      throw new SheetValidationError(
        `Trùng lặp khóa đơn hàng "${orderName}" tại Orders dòng ${rowNumber}`,
      );
    }
    seenKeys.add(orderName);

    const orderDate = parseDateOnly(row[3], ctx("Date"));
    const grossSales = parseDecimal(row[4], ctx("Gross sales"));
    const discounts = parseDecimal(row[5], ctx("Discounts"));
    const shippingCharged = parseDecimal(row[6], ctx("Shipping charged"));
    const originalTax = parseDecimal(row[7], ctx("Original tax"));
    const correctedNet = parseDecimal(row[8], ctx("Corrected net"));
    const refundSnapshot = parseDecimal(row[9], ctx("Refund snapshot"));
    const beforeRefund = parseDecimal(row[10], ctx("Before refund"));
    const source = parseString(row[11]);
    const itemName = parseString(row[12]);

    results.push({
      month,
      sourceRow,
      orderName,
      orderDate,
      grossSales,
      discounts,
      shippingCharged,
      originalTax,
      correctedNet,
      refundSnapshot,
      beforeRefund,
      source,
      itemName,
      rawValues: row as unknown as Prisma.InputJsonValue,
    });
  }

  return results;
}

export function parseCogsRows(rows: unknown[][]): ParsedCogsRow[] {
  const results: ParsedCogsRow[] = [];
  const seenKeys = new Set<string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (
      !row ||
      row.length === 0 ||
      row.every((c) => c === null || c === "" || c === undefined)
    ) {
      continue;
    }
    const rowNumber = idx + 2;
    const ctx = (colName: string) => ({
      sheet: "COGS" as const,
      row: rowNumber,
      colName,
    });

    const month = parseRequiredString(row[0], ctx("Month"));
    const sourceRow = parseInteger(row[1], ctx("Source row"));
    const supplier = parseRequiredString(row[2], ctx("Supplier"));
    const costDate = parseDateOnly(row[3], ctx("Date"));
    const referenceOrderId = parseString(row[4]);
    const itemsName = parseString(row[5]);
    const supplierOrderId = parseString(row[6]);
    const totalCost = parseDecimal(row[7], ctx("Total cost"));
    const estimatedCost = parseDecimal(row[8], ctx("Estimated cost"));
    const rowKey = parseRequiredString(row[9], ctx("Row key"));

    if (seenKeys.has(rowKey)) {
      throw new SheetValidationError(
        `Trùng lặp khóa chi phí "${rowKey}" tại COGS dòng ${rowNumber}`,
      );
    }
    seenKeys.add(rowKey);

    const treatment = parseRequiredString(row[10], ctx("Treatment"));
    const source = parseString(row[11]);

    results.push({
      month,
      sourceRow,
      supplier,
      costDate,
      referenceOrderId,
      itemsName,
      supplierOrderId,
      totalCost,
      estimatedCost,
      rowKey,
      treatment,
      source,
      rawValues: row as unknown as Prisma.InputJsonValue,
    });
  }

  return results;
}

export function parseAdRows(rows: unknown[][]): ParsedAdRow[] {
  const results: ParsedAdRow[] = [];
  const seenKeys = new Set<string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (
      !row ||
      row.length === 0 ||
      row.every((c) => c === null || c === "" || c === undefined)
    ) {
      continue;
    }
    const rowNumber = idx + 2;
    const ctx = (colName: string) => ({
      sheet: "Ads" as const,
      row: rowNumber,
      colName,
    });

    const month = parseRequiredString(row[0], ctx("Month"));
    const sourceRow = parseInteger(row[1], ctx("Source row"));
    const externalId = parseRequiredString(row[2], ctx("ID"));

    if (seenKeys.has(externalId)) {
      throw new SheetValidationError(
        `Trùng lặp khóa quảng cáo "${externalId}" tại Ads dòng ${rowNumber}`,
      );
    }
    seenKeys.add(externalId);

    const date = parseDateOnly(row[3], ctx("Date"));
    const accountId = parseRequiredString(row[4], ctx("Account ID"));
    const campaignId = parseString(row[5]);
    const campaignName = parseString(row[6]);
    const currency = parseRequiredString(row[7], ctx("Currency"));
    const spend = parseDecimal(row[8], ctx("Spend"));
    const granularity = parseRequiredString(row[9], ctx("Granularity"));
    const source = parseString(row[10]);

    results.push({
      month,
      sourceRow,
      externalId,
      date,
      accountId,
      campaignId,
      campaignName,
      currency,
      spend,
      granularity,
      source,
      rawValues: row as unknown as Prisma.InputJsonValue,
    });
  }

  return results;
}

export function parsePayoutRows(rows: unknown[][]): ParsedPayoutRow[] {
  const results: ParsedPayoutRow[] = [];
  const seenKeys = new Set<string>();

  for (let idx = 0; idx < rows.length; idx++) {
    const row = rows[idx];
    if (
      !row ||
      row.length === 0 ||
      row.every((c) => c === null || c === "" || c === undefined)
    ) {
      continue;
    }
    const rowNumber = idx + 2;
    const ctx = (colName: string) => ({
      sheet: "Payouts" as const,
      row: rowNumber,
      colName,
    });

    const monthLocal = parseRequiredString(row[0], ctx("Month local"));
    const sourceRow = parseInteger(row[1], ctx("Source row"));
    const balanceTransactionId = parseRequiredString(
      row[2],
      ctx("Balance transaction ID"),
    );

    if (seenKeys.has(balanceTransactionId)) {
      throw new SheetValidationError(
        `Trùng lặp khóa balance transaction "${balanceTransactionId}" tại Payouts dòng ${rowNumber}`,
      );
    }
    seenKeys.add(balanceTransactionId);

    const payoutId = parseString(row[3]);
    const type = parseRequiredString(row[4], ctx("Type"));
    const currency = parseRequiredString(row[5], ctx("Currency"));
    const gross = parseDecimal(row[6], ctx("Gross"));
    const fee = parseDecimal(row[7], ctx("Fee"));
    const net = parseDecimal(row[8], ctx("Net"));
    const processedUtc = parseUtcTimestamp(row[9], ctx("Processed UTC"));
    const processedGmt7 = parseRequiredString(row[10], ctx("Processed GMT+7"));
    const processedVietnam = parseRequiredString(
      row[11],
      ctx("Processed Vietnam"),
    );
    const reason = parseString(row[12]);
    const sourceId = parseString(row[13]);
    const orderId = parseString(row[14]);
    const source = parseString(row[15]);

    results.push({
      monthLocal,
      sourceRow,
      balanceTransactionId,
      payoutId,
      type,
      currency,
      gross,
      fee,
      net,
      processedUtc,
      processedGmt7,
      processedVietnam,
      reason,
      sourceId,
      orderId,
      source,
      rawValues: row as unknown as Prisma.InputJsonValue,
    });
  }

  return results;
}
