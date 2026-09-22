import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { previousVietnamMonthRange, vietnamMonthRange } from "@/lib/date-time";

export const HISTORY_FROM = new Date("2026-01-01T00:00:00.000Z");
export const REQUEST_TIMEOUT_MS = 20_000;
export const STALE_JOB_MS = 15 * 60 * 1000;
export const WRITE_BATCH_SIZE = 50;

export type DateRange = { from: Date; to: Date };
export type CogsSource = "PGPrint" | "Printify" | "Printful" | "Luxury Pro";

export type SyncProgress = {
  pagesProcessed: number;
  totalPages?: number;
  rowsFetched: number;
  checkpoint?: Prisma.InputJsonValue;
};

export type ProgressReporter = (progress: SyncProgress) => Promise<void>;

export function previousMonthRange(now = new Date()): DateRange {
  return previousVietnamMonthRange(now);
}

export function cogsMonthRange(month?: string): DateRange {
  if (!month || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return previousMonthRange();
  }
  return vietnamMonthRange(month);
}

export function cogsHistoryRange(now = new Date()): DateRange {
  return { from: new Date(HISTORY_FROM), to: now };
}

export type CogsRow = {
  supplier: string;
  date: Date;
  referenceOrderId: string | null;
  supplierOrderId: string | null;
  totalCost: number;
  estimatedCost: number;
  itemKey: string;
  sourceRecordId: string | null;
  mappingStatus: string;
  sourceNote: string | null;
  rawPayload: Prisma.InputJsonValue;
};

export type JsonRecord = Record<string, unknown>;

export function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

export function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

export function amount(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function date(value: unknown, fallback = HISTORY_FROM): Date {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? fallback : value;
  }
  const raw = text(value);
  const numeric = Number(raw);
  const parsed =
    raw && /^\d+(\.\d+)?$/.test(raw)
      ? new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric)
      : new Date(raw);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

export function validDate(value: unknown): Date | null {
  const parsed = date(value, new Date(Number.NaN));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function id(value: unknown): string {
  return text(value) || crypto.randomUUID();
}

export function orderReference(value: unknown): string | null {
  const normalized = text(value);
  if (!normalized) return null;
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

export function makeRow(
  supplier: string,
  sourceRecordId: string,
  sourceDate: unknown,
  reference: unknown,
  supplierOrder: unknown,
  total: number,
  estimated: number,
  itemIdentifier: string,
  payload: JsonRecord,
): CogsRow {
  const referenceOrderId = orderReference(reference);
  return {
    supplier,
    date: date(sourceDate),
    referenceOrderId,
    supplierOrderId: text(supplierOrder) || null,
    totalCost: total,
    estimatedCost: estimated,
    itemKey: `${supplier}:${sourceRecordId}:${itemIdentifier}`,
    sourceRecordId,
    mappingStatus: referenceOrderId ? "MATCHED" : "UNMATCHED",
    sourceNote: referenceOrderId
      ? null
      : "Missing supplier-to-Shopify order mapping",
    rawPayload: payload as Prisma.InputJsonValue,
  };
}
