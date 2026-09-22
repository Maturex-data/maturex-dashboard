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
const STALE_JOB_MS = 15 * 60 * 1000;
const WRITE_BATCH_SIZE = 50;

export type DateRange = { from: Date; to: Date };
export type CogsSource = "PGPrint" | "Printify" | "Printful" | "Luxury Pro";

type SyncProgress = {
  pagesProcessed: number;
  totalPages?: number;
  rowsFetched: number;
  checkpoint?: Prisma.InputJsonValue;
};

type ProgressReporter = (progress: SyncProgress) => Promise<void>;

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

async function fetchPrintify(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
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
  const pages = [first];
  await report?.({
    pagesProcessed: 1,
    totalPages: lastPage,
    rowsFetched: Array.isArray(first.data) ? first.data.length : 0,
    checkpoint: { page: 1 },
  });
  for (let start = 2; start <= lastPage; start += 5) {
    const pageNumbers = Array.from(
      { length: Math.min(5, lastPage - start + 1) },
      (_, index) => start + index,
    );
    const batch = await Promise.all(
      pageNumbers.map((page) =>
        fetchWithTimeout(
          `https://api.printify.com/v1/shops/${shopId}/orders.json?page=${page}&limit=50`,
          { headers: { Authorization: `Bearer ${token}` } },
        ).then(async (response) => {
          if (!response.ok) throw new Error(`Printify API ${response.status}`);
          return (await response.json()) as JsonRecord;
        }),
      ),
    );
    pages.push(...batch);
    await report?.({
      pagesProcessed: pages.length,
      totalPages: lastPage,
      rowsFetched: pages.reduce(
        (sum, page) => sum + (Array.isArray(page.data) ? page.data.length : 0),
        0,
      ),
      checkpoint: { page: pageNumbers.at(-1) },
    });
  }
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

async function fetchPrintful(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
  const token = process.env.PRINTFUL_API_TOKEN;
  if (!token) throw new Error("Printful API credentials are missing.");

  const headers = {
    Authorization: `Bearer ${token}`,
    "User-Agent": "maturex-dashboard/1.0",
  };
  const orders: JsonRecord[] = [];
  let offset = 0;
  let pagesProcessed = 0;

  while (true) {
    const response = await fetchWithTimeout(
      `https://api.printful.com/orders?offset=${offset}&limit=100`,
      { headers },
    );
    const payload = (await response.json()) as JsonRecord;
    if (!response.ok) throw new Error(`Printful API ${response.status}`);
    const page = Array.isArray(payload.result) ? payload.result : [];
    orders.push(...page.map(record));
    const paging = record(payload.paging);
    const total = amount(paging.total);
    pagesProcessed += 1;
    await report?.({
      pagesProcessed,
      totalPages: total ? Math.ceil(total / 100) : undefined,
      rowsFetched: orders.length,
      checkpoint: { offset: offset + page.length },
    });
    if (page.length === 0 || !total || orders.length >= total) break;
    offset += page.length;
  }

  return orders.flatMap((order) => {
    const created = date(
      amount(order.created) ? amount(order.created) * 1000 : order.created,
    );
    if (created < range.from || created >= range.to) return [];
    const items = Array.isArray(order.items) ? order.items.map(record) : [];
    if (items.length === 0) return [];

    const orderCosts = record(order.costs);
    const orderTotal = amount(orderCosts.total);
    const bases = items.map((item) =>
      Math.max(0, amount(item.price) * Math.max(1, amount(item.quantity))),
    );
    const baseTotal = bases.reduce((sum, value) => sum + value, 0);
    const equalWeight = 1 / items.length;
    let allocated = 0;

    return items.map((item, index) => {
      const weight = baseTotal > 0 ? bases[index] / baseTotal : equalWeight;
      const total =
        index === items.length - 1
          ? Math.max(0, Number((orderTotal - allocated).toFixed(4)))
          : Number((orderTotal * weight).toFixed(4));
      allocated += total;
      const externalId = text(order.external_id);
      const normalizedReference = externalId.replace(/_\d+$/, "");

      return makeRow(
        "Printful",
        text(order.id),
        created,
        normalizedReference || externalId,
        order.id,
        total,
        total,
        text(item.id) || String(index),
        {
          order,
          item,
          cost_allocation: {
            order_total: orderTotal,
            item_base: bases[index],
            base_total: baseTotal,
            allocated_total: total,
            currency: text(orderCosts.currency) || "USD",
          },
        },
      );
    });
  });
}

async function fetchPgPrint(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
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
    await report?.({
      pagesProcessed: Math.min(page + pages.length - 1, 1000),
      rowsFetched: rows.length,
      checkpoint: { page: page + pages.length },
    });
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

async function fetchLuxuryPro(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
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
  const rows = lines
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
  await report?.({
    pagesProcessed: 1,
    totalPages: 1,
    rowsFetched: rows.length,
    checkpoint: { row: lines.length - 1 },
  });
  return rows;
}

const COGS_SOURCES = [
  ["PGPrint", fetchPgPrint],
  ["Printify", fetchPrintify],
  ["Printful", fetchPrintful],
  ["Luxury Pro", fetchLuxuryPro],
] as const;

async function persistRows(rows: CogsRow[]): Promise<{
  added: number;
  skipped: number;
}> {
  if (rows.length === 0) return { added: 0, skipped: 0 };
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
  for (let index = 0; index < existingRows.length; index += WRITE_BATCH_SIZE) {
    const batch = existingRows.slice(index, index + WRITE_BATCH_SIZE);
    await Promise.all(
      batch.map((row) =>
        prisma.cogsRecord.update({
          where: { itemKey: row.itemKey },
          data: row,
        }),
      ),
    );
  }
  return { added: inserted.count, skipped: existingRows.length };
}

function sourceEntries(selectedSource?: CogsSource) {
  return selectedSource
    ? COGS_SOURCES.filter(([source]) => source === selectedSource)
    : [...COGS_SOURCES];
}

export async function fetchCogsFromSourceApis(
  range: DateRange,
): Promise<CogsRow[]> {
  const results = await Promise.all(
    COGS_SOURCES.map(async ([source, fetcher]) => ({
      source,
      rows: await fetcher(range),
    })),
  );
  return results.flatMap((result) => result.rows);
}

export async function syncCogs(
  selectedSource?: CogsSource,
  range = previousMonthRange(),
): Promise<{
  added: number;
  skipped: number;
  sources: Record<string, number>;
  from: string;
  until: string;
}> {
  const entries = sourceEntries(selectedSource);
  const run = await prisma.cogsSyncRun.create({
    data: {
      status: "RUNNING",
      syncType: "LATEST",
      rangeFrom: range.from,
      rangeTo: range.to,
      sourceRuns: {
        create: entries.map(([source]) => ({
          source,
          status: "RUNNING",
          startedAt: new Date(),
        })),
      },
    },
  });
  try {
    const results = await Promise.allSettled(
      entries.map(async ([source, fetcher]) => {
        const sourceKey = { runId_source: { runId: run.id, source } };
        try {
          const rows = await fetcher(range, async (progress) => {
            const now = new Date();
            await Promise.all([
              prisma.cogsSyncRun.update({
                where: { id: run.id },
                data: { heartbeatAt: now },
              }),
              prisma.cogsSyncSourceRun.update({
                where: sourceKey,
                data: { ...progress, heartbeatAt: now },
              }),
            ]);
          });
          const counts = await persistRows(rows);
          await prisma.cogsSyncSourceRun.update({
            where: sourceKey,
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              heartbeatAt: new Date(),
              rowsFetched: rows.length,
              addedCount: counts.added,
              skippedCount: counts.skipped,
            },
          });
          return { source, rows, ...counts };
        } catch (error) {
          await prisma.cogsSyncSourceRun.update({
            where: sourceKey,
            data: {
              status: "FAILED",
              completedAt: new Date(),
              heartbeatAt: new Date(),
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            },
          });
          throw error;
        }
      }),
    );
    const sources: Record<string, number> = {};
    let added = 0;
    let skipped = 0;
    results.forEach((result, index) => {
      const name = entries[index][0];
      if (result.status === "fulfilled") {
        sources[name] = result.value.rows.length;
        added += result.value.added;
        skipped += result.value.skipped;
      } else {
        sources[`${name}_error`] = 1;
      }
    });
    const failed = results.filter((result) => result.status === "rejected");
    await prisma.cogsSyncRun.update({
      where: { id: run.id },
      data: {
        status: failed.length > 0 ? "PARTIAL_FAILED" : "COMPLETED",
        completedAt: new Date(),
        addedCount: added,
        skippedCount: skipped,
        sourceResults: sources,
        errorMessage:
          failed.length > 0 ? `${failed.length} source(s) failed.` : null,
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

export async function createCogsSyncJob(
  range = cogsHistoryRange(),
  syncType: "HISTORY" | "LATEST" = "HISTORY",
): Promise<{ id: string; reused: boolean }> {
  const staleBefore = new Date(Date.now() - STALE_JOB_MS);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext('maturex-cogs-sync'))",
    );
    const staleRuns = await tx.cogsSyncRun.findMany({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        OR: [
          { heartbeatAt: { lt: staleBefore } },
          { startedAt: { lt: staleBefore } },
        ],
      },
      select: { id: true },
    });
    if (staleRuns.length > 0) {
      const ids = staleRuns.map((run) => run.id);
      await tx.cogsSyncSourceRun.updateMany({
        where: { runId: { in: ids }, status: { in: ["QUEUED", "RUNNING"] } },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "Job became stale before completion.",
        },
      });
      await tx.cogsSyncRun.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "No heartbeat for 15 minutes.",
        },
      });
    }
    const active = await tx.cogsSyncRun.findFirst({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        heartbeatAt: { gte: staleBefore },
      },
      orderBy: { startedAt: "desc" },
    });
    if (active) return { id: active.id, reused: true };
    const run = await tx.cogsSyncRun.create({
      data: {
        status: "QUEUED",
        syncType,
        rangeFrom: range.from,
        rangeTo: range.to,
        sourceRuns: {
          create: COGS_SOURCES.map(([source]) => ({ source })),
        },
      },
    });
    return { id: run.id, reused: false };
  });
}

async function executeSourceRun(
  runId: string,
  source: CogsSource,
  range: DateRange,
): Promise<void> {
  const entry = COGS_SOURCES.find(([name]) => name === source);
  if (!entry) throw new Error(`Unknown COGS source: ${source}`);
  const sourceKey = { runId_source: { runId, source } };
  await prisma.cogsSyncSourceRun.update({
    where: sourceKey,
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
    },
  });
  try {
    const rows = await entry[1](range, async (progress) => {
      const now = new Date();
      await Promise.all([
        prisma.cogsSyncRun.update({
          where: { id: runId },
          data: { heartbeatAt: now },
        }),
        prisma.cogsSyncSourceRun.update({
          where: sourceKey,
          data: { ...progress, heartbeatAt: now },
        }),
      ]);
    });
    const counts = await persistRows(rows);
    await prisma.cogsSyncSourceRun.update({
      where: sourceKey,
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        heartbeatAt: new Date(),
        rowsFetched: rows.length,
        addedCount: counts.added,
        skippedCount: counts.skipped,
      },
    });
  } catch (error) {
    await prisma.cogsSyncSourceRun.update({
      where: sourceKey,
      data: {
        status: "FAILED",
        completedAt: new Date(),
        heartbeatAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function executeCogsSyncJob(
  runId: string,
  retryFailedOnly = false,
): Promise<void> {
  const run = await prisma.cogsSyncRun.findUnique({
    where: { id: runId },
    include: { sourceRuns: true },
  });
  if (!run) throw new Error("COGS sync job not found.");
  if (
    ["QUEUED", "RUNNING"].includes(run.status) &&
    run.heartbeatAt.getTime() < Date.now() - STALE_JOB_MS
  ) {
    await prisma.cogsSyncRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: "No heartbeat for 15 minutes.",
      },
    });
    return;
  }
  const sourceRuns = retryFailedOnly
    ? run.sourceRuns.filter((sourceRun) =>
        ["FAILED", "QUEUED"].includes(sourceRun.status),
      )
    : run.sourceRuns.filter((sourceRun) => sourceRun.status !== "COMPLETED");
  if (sourceRuns.length === 0) return;
  await prisma.cogsSyncRun.update({
    where: { id: runId },
    data: {
      status: "RUNNING",
      completedAt: null,
      heartbeatAt: new Date(),
      errorMessage: null,
    },
  });
  const range = {
    from: run.rangeFrom || HISTORY_FROM,
    to: run.rangeTo || new Date(),
  };
  await Promise.allSettled(
    sourceRuns.map((sourceRun) =>
      executeSourceRun(runId, sourceRun.source as CogsSource, range),
    ),
  );
  const completed = await prisma.cogsSyncSourceRun.findMany({
    where: { runId },
  });
  const failed = completed.filter((sourceRun) => sourceRun.status === "FAILED");
  const added = completed.reduce(
    (sum, sourceRun) => sum + sourceRun.addedCount,
    0,
  );
  const skipped = completed.reduce(
    (sum, sourceRun) => sum + sourceRun.skippedCount,
    0,
  );
  await prisma.cogsSyncRun.update({
    where: { id: runId },
    data: {
      status: failed.length > 0 ? "PARTIAL_FAILED" : "COMPLETED",
      completedAt: new Date(),
      heartbeatAt: new Date(),
      addedCount: added,
      skippedCount: skipped,
      sourceResults: Object.fromEntries(
        completed.map((sourceRun) => [
          sourceRun.source,
          {
            status: sourceRun.status,
            rows: sourceRun.rowsFetched,
            added: sourceRun.addedCount,
            skipped: sourceRun.skippedCount,
          },
        ]),
      ),
      errorMessage:
        failed.length > 0 ? `${failed.length} source(s) failed.` : null,
    },
  });
}

export async function retryCogsSyncJob(runId: string): Promise<boolean> {
  const failed = await prisma.cogsSyncSourceRun.count({
    where: { runId, status: "FAILED" },
  });
  if (failed === 0) return false;
  await prisma.cogsSyncSourceRun.updateMany({
    where: { runId, status: "FAILED" },
    data: { status: "QUEUED", completedAt: null, errorMessage: null },
  });
  await prisma.cogsSyncRun.update({
    where: { id: runId },
    data: {
      status: "QUEUED",
      completedAt: null,
      heartbeatAt: new Date(),
      errorMessage: null,
    },
  });
  return true;
}

export async function getCogsSyncJob(id?: string) {
  return prisma.cogsSyncRun.findFirst({
    where: id ? { id } : { syncType: "HISTORY" },
    orderBy: { startedAt: "desc" },
    include: { sourceRuns: { orderBy: { source: "asc" } } },
  });
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
