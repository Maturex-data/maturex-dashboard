import crypto from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import {
  formatVietnamDate,
  previousVietnamMonthRange,
  vietnamMonthRange,
} from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const HISTORY_FROM = new Date("2026-01-01T00:00:00.000Z");
const REQUEST_TIMEOUT_MS = 20_000;

type DateRange = { from: Date; to: Date };

function previousMonthRange(now = new Date()): DateRange {
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

type CogsRow = {
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

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value).trim()
    : "";
}

function amount(value: unknown): number {
  const parsed = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: unknown, fallback = HISTORY_FROM): Date {
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

function id(value: unknown): string {
  return text(value) || crypto.randomUUID();
}

function orderReference(value: unknown): string | null {
  const normalized = text(value);
  if (!normalized) return null;
  return normalized.startsWith("#") ? normalized : `#${normalized}`;
}

async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  return fetch(input, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
}

function makeRow(
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

async function fetchPrintify(range: DateRange): Promise<CogsRow[]> {
  const token = process.env.PRINTIFY_ACCESS_TOKEN;
  const shopId = process.env.PRINTIFY_SHOP_ID;
  if (!token || !shopId) throw new Error("Printify credentials are missing.");
  const firstUrl = `https://api.printify.com/v1/shops/${shopId}/orders.json?page=1&limit=50`;
  const firstResponse = await fetchWithTimeout(firstUrl, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const first = (await firstResponse.json()) as JsonRecord;
  if (!firstResponse.ok)
    throw new Error(`Printify API ${firstResponse.status}`);
  const lastPage = Math.max(1, amount(first.last_page));
  const pages = await Promise.all(
    Array.from({ length: lastPage }, (_, index) =>
      fetchWithTimeout(
        `https://api.printify.com/v1/shops/${shopId}/orders.json?page=${index + 1}&limit=50`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      ).then(async (response) => {
        if (!response.ok) throw new Error(`Printify API ${response.status}`);
        return (await response.json()) as JsonRecord;
      }),
    ),
  );
  return pages.flatMap((page) => {
    const orders = Array.isArray(page.data) ? page.data : [];
    return orders.flatMap((rawOrder) => {
      const order = record(rawOrder);
      const created = date(order.created_at);
      if (created < range.from || created >= range.to) return [];
      const items = Array.isArray(order.line_items) ? order.line_items : [];
      return items.map((rawItem, index) => {
        const item = record(rawItem);
        const orderId = text(order.id);
        const cost = amount(item.cost) / 100;
        const shipping = amount(item.shipping_cost) / 100;
        return makeRow(
          "Printify",
          orderId,
          created,
          order.app_order_id || record(order.metadata).shop_order_label,
          orderId,
          cost + shipping,
          cost + shipping,
          `${text(item.id) || index}`,
          { order, item },
        );
      });
    });
  });
}

async function fetchPgPrint(range: DateRange): Promise<CogsRow[]> {
  const shopId = process.env.PGPRINT_SHOP_ID;
  const secret = process.env.PGPRINT_SECRET;
  if (!shopId || !secret) throw new Error("PGPrint credentials are missing.");
  const configuredShopId = shopId;
  const configuredSecret = secret;
  async function fetchPage(page: number): Promise<JsonRecord> {
    const body = JSON.stringify({
      fromTime: range.from.getTime(),
      toTime: range.to.getTime(),
      page,
      size: 20,
    });
    const signature = crypto
      .createHmac("sha256", configuredSecret)
      .update(body)
      .digest("base64");
    const response = await fetchWithTimeout(
      "https://app.pgprints.io/api/v1/orders/search",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PGPrints-Store-Id": configuredShopId,
          "X-PGPrints-Hmac-Sha256": signature,
        },
        body,
      },
    );
    const payload = (await response.json()) as JsonRecord;
    if (!response.ok || payload.success === false)
      throw new Error(`PGPrint API ${response.status}`);
    return payload;
  }

  function appendRows(rows: CogsRow[], payload: JsonRecord): void {
    const orders = Array.isArray(payload.data) ? payload.data : [];
    for (const rawOrder of orders) {
      const order = record(rawOrder);
      const items = Array.isArray(order.childDetails)
        ? order.childDetails
        : [order];
      items.forEach((rawItem, index) => {
        const item = record(rawItem);
        const total = amount(
          item.sellerCost || item.totalCost || order.totalCost,
        );
        rows.push(
          makeRow(
            "PGPrint",
            id(order.id),
            order.createdAt,
            order.orderId,
            order.pgcOrderId,
            total,
            total,
            text(item.id) || `${index}`,
            { order, item },
          ),
        );
      });
    }
  }

  const rows: CogsRow[] = [];
  let page = 1;
  let hasNext = true;
  while (hasNext && page <= 1000) {
    const pages = await Promise.all(
      Array.from({ length: 10 }, (_, offset) => fetchPage(page + offset)),
    );
    for (const payload of pages) {
      appendRows(rows, payload);
      if (payload.pageHasNext !== true) {
        hasNext = false;
        break;
      }
    }
    page += 10;
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

async function fetchLuxuryPro(range: DateRange): Promise<CogsRow[]> {
  const sheetId =
    process.env.LUXURY_PRO_SHEET_ID ||
    "1zRpn7RyV2YIg20GwYKBQAORP_cRswRwbNjsoHaAY3Oc";
  const gid = process.env.LUXURY_PRO_SHEET_GID || "1578872519";
  const response = await fetchWithTimeout(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
  );
  if (!response.ok)
    throw new Error(`Luxury Pro Google Sheet ${response.status}`);
  const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  );
  return lines
    .slice(1)
    .map((line, index) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(
        headers.map((header, headerIndex) => [
          header,
          values[headerIndex] || "",
        ]),
      );
      const quantity = amount(row.quantity) || 1;
      const total = amount(row.price) * quantity + amount(row.other_fee);
      return makeRow(
        "Luxury Pro",
        text(row.tracking_number) || text(row.order_number) || `${index + 2}`,
        row.date || row.created_at || row.order_date,
        row.reference_order_id ||
          row.order_id ||
          row.shopify_order ||
          row.order_number ||
          row.order,
        row.supplier_order_id ||
          row.external_order_id ||
          row.tracking_number ||
          row.id,
        total,
        total,
        `${text(row.sku) || "no-sku"}:${index}`,
        row,
      );
    })
    .filter((row) => row.date >= range.from && row.date < range.to);
}

export async function syncCogs(
  selectedSource?: "PGPrint" | "Printify" | "Luxury Pro",
  range = previousMonthRange(),
): Promise<{
  added: number;
  skipped: number;
  sources: Record<string, number>;
  from: string;
  until: string;
}> {
  const run = await prisma.cogsSyncRun.create({ data: { status: "RUNNING" } });
  try {
    const sourcesToFetch = selectedSource
      ? [
          [
            selectedSource,
            selectedSource === "PGPrint"
              ? fetchPgPrint
              : selectedSource === "Printify"
                ? fetchPrintify
                : fetchLuxuryPro,
          ] as const,
        ]
      : ([
          ["PGPrint", fetchPgPrint],
          ["Printify", fetchPrintify],
          ["Luxury Pro", fetchLuxuryPro],
        ] as const);
    const results = await Promise.allSettled(
      sourcesToFetch.map(([, fetcher]) => fetcher(range)),
    );
    const rows: CogsRow[] = [];
    const sources: Record<string, number> = {};
    results.forEach((result, index) => {
      const name = sourcesToFetch[index][0];
      if (result.status === "fulfilled") {
        sources[name] = result.value.length;
        rows.push(...result.value);
      } else sources[`${name}_error`] = 1;
    });
    const existing = await prisma.cogsRecord.findMany({
      where: { itemKey: { in: rows.map((row) => row.itemKey) } },
      select: { itemKey: true },
    });
    const existingKeys = new Set(existing.map((row) => row.itemKey));
    const newRows = rows.filter((row) => !existingKeys.has(row.itemKey));
    const existingRows = rows.filter((row) => existingKeys.has(row.itemKey));
    const inserted = await prisma.cogsRecord.createMany({
      data: newRows,
      skipDuplicates: true,
    });
    for (const row of existingRows) {
      await prisma.cogsRecord.update({
        where: { itemKey: row.itemKey },
        data: row,
      });
    }
    const added = inserted.count;
    const skipped = existingRows.length;
    await prisma.cogsSyncRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        addedCount: added,
        skippedCount: skipped,
        sourceResults: sources,
      },
    });
    return {
      added,
      skipped,
      sources,
      from: formatVietnamDate(range.from),
      until: formatVietnamDate(new Date(range.to.getTime() - 1)),
    };
  } catch (error) {
    await prisma.cogsSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function listCogs(month?: string) {
  const validMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const range = validMonth ? vietnamMonthRange(month) : undefined;
  const from = range?.from || HISTORY_FROM;
  const to = range?.to || new Date();
  return prisma.cogsRecord.findMany({
    where: { date: { gte: from, lt: to } },
    orderBy: [{ date: "desc" }, { supplier: "asc" }],
    select: {
      id: true,
      supplier: true,
      date: true,
      referenceOrderId: true,
      supplierOrderId: true,
      totalCost: true,
      estimatedCost: true,
    },
  });
}
