import { createHash } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  detectShopFromPath,
  ETSY_SHOPS,
  isCogsFileName,
  normalizeShopCode,
  SHOPS_MAP,
} from "../etsy-constants";

export {
  ETSY_SHOPS,
  SHOPS_MAP,
  detectShopFromPath,
  normalizeShopCode,
  isCogsFileName,
};

export const MAX_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_FILES = 100;

export type SourceRow = Record<string, unknown>;
export type ReportType =
  | "ORDERS"
  | "ORDER_ITEMS"
  | "STATEMENTS"
  | "COGS"
  | "COGS_CLAIM";

export interface ParsedSource {
  fileHash: string;
  fileName: string;
  reportType: ReportType;
  rows: SourceRow[];
  sourceMonth: Date;
}

export interface EtsyImportResult {
  fileName: string;
  relativePath?: string;
  shopCode?: string;
  reportType: ReportType | "UNKNOWN";
  sourceMonth: string | null;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  message: string;
}

export function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" || normalized === "--" ? null : normalized;
}

export function integer(value: unknown): number | null {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized.replaceAll(",", ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function money(value: unknown): number | null {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const parenthesized = normalized.startsWith("(") && normalized.endsWith(")");
  const numeric = normalized.replaceAll(",", "").replace(/[^0-9.-]/g, "");
  if (!numeric || numeric === "-" || numeric === ".") return null;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  return parenthesized ? -Math.abs(parsed) : parsed;
}

export function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
    );
  }
  const normalized = cleanText(value);
  if (!normalized) return null;

  const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
  }

  const us = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!us) return null;
  const year = us[3].length === 2 ? Number(us[3]) + 2000 : Number(us[3]);
  return new Date(Date.UTC(year, Number(us[1]) - 1, Number(us[2])));
}

export function monthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

export function monthLabel(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function sha256(value: string | ArrayBuffer): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : Buffer.from(value))
    .digest("hex");
}

export function jsonRow(row: SourceRow): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
}

export function detectReport(headers: string[]): ReportType {
  const values = new Set(headers);
  if (
    values.has("Transaction ID") &&
    values.has("Item Name") &&
    values.has("Order ID")
  ) {
    return "ORDER_ITEMS";
  }
  if (values.has("Sale Date") && values.has("Order ID")) return "ORDERS";
  if (values.has("Date") && values.has("Type") && values.has("Net"))
    return "STATEMENTS";
  if (
    values.has("Order ID") &&
    (values.has("Order Amount") || values.has("Create Day"))
  ) {
    return "COGS";
  }
  if (values.has("Ticket ID") || values.has("Issues Order ID")) {
    return "COGS_CLAIM";
  }
  throw new Error("Cấu trúc cột không khớp báo cáo Etsy được hỗ trợ.");
}

export function extractOrderId(row: SourceRow): string | null {
  const searchable = `${cleanText(row.Info) ?? ""} ${cleanText(row.Title) ?? ""}`;
  return searchable.match(/Order\s*#?\s*(\d+)/i)?.[1] ?? null;
}
