import { MICROM_TIMEZONE } from "./constants";

/**
 * Format a Date or ISO string into YYYY-MM-DD in Asia/Ho_Chi_Minh timezone
 */
export function formatVietnamDate(input: Date | string | number): string {
  const date = typeof input === "object" ? input : new Date(input);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`Invalid date input: ${String(input)}`);
  }

  // Format with Intl in Asia/Ho_Chi_Minh
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: MICROM_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

/**
 * Extract Period (YYYY-MM) from a date in Asia/Ho_Chi_Minh
 */
export function formatVietnamPeriod(input: Date | string | number): string {
  const ymd = formatVietnamDate(input);
  return ymd.slice(0, 7);
}

/**
 * Parses Google Sheets / Excel date serial (e.g. 46266) to YYYY-MM-DD
 */
export function parseSheetDateSerial(serial: number): string {
  // Excel / Google Sheets epoch is 1899-12-30
  const epoch = Date.UTC(1899, 11, 30);
  const ms = epoch + Math.round(serial * 86400000);
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Normalizes any sheet date value (string or serial number) into YYYY-MM-DD
 */
export function normalizeSheetDate(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "";
  }

  if (typeof value === "number") {
    // If it's a numeric serial like 46266
    if (value > 30000 && value < 60000) {
      return parseSheetDateSerial(value);
    }
  }

  const str = String(value).trim();
  // Check if string is a numeric serial
  if (/^\d{5}(\.\d+)?$/.test(str)) {
    return parseSheetDateSerial(Number(str));
  }

  // Format YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return str;
  }

  // Try standard parse
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    return formatVietnamDate(parsed);
  }

  return str;
}

/**
 * Normalizes a period string YYYY-MM or computes it from date
 */
export function normalizePeriod(value: unknown, fallbackDate?: string): string {
  const str = String(value ?? "").trim();
  if (/^\d{4}-\d{2}$/.test(str)) {
    return str;
  }
  if (fallbackDate && /^\d{4}-\d{2}-\d{2}$/.test(fallbackDate)) {
    return fallbackDate.slice(0, 7);
  }
  return "";
}
