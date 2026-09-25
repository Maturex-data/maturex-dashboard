import { neonConfig } from "@neondatabase/serverless";
import ws from "ws";

neonConfig.webSocketConstructor = ws;

import { createHash } from "node:crypto";
import { fetchCogsFromSourceApis } from "@/lib/cogs-sync";
import { formatVietnamDate, formatVietnamDateTime } from "@/lib/date-time";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { fetchMetaDailyFinancialsFromApi } from "@/lib/meta-daily-financials-sync";
import { fetchShopifyPaymentTransactionsFromApi } from "@/lib/shopify-payments-rest-sync";
import { fetchShopifyOrdersByUpdated } from "@/lib/shopify-raw-order-sync";

const REPORT_SPREADSHEET_ID =
  process.env.EC_REPORT_SPREADSHEET_ID ||
  "19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8";

const REPORT_SHEETS = {
  Orders: { lastColumn: "M", dateIndex: 3, source: "all-data / RAW.ORDER" },
  COGS: { lastColumn: "L", dateIndex: 3, source: "all-data / RAW.COGS" },
  Ads: { lastColumn: "K", dateIndex: 3, source: "all-data / META_ADS" },
  Payouts: {
    lastColumn: "P",
    dateIndex: 9,
    source: "all-data / RAW.PAYOUT_DETAIL",
  },
} as const;

type ReportSheet = keyof typeof REPORT_SHEETS;
type SheetValue = string | number | null | undefined;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

function firstText(...values: unknown[]): string {
  return values.map(text).find(Boolean) || "";
}

function cogsItemName(row: { supplier: string; rawPayload: unknown }): string {
  const payload = record(row.rawPayload);
  const item = record(payload.item);
  const order = record(payload.order);
  const product = record(item.product);
  const metadata = record(item.metadata);

  if (row.supplier === "Luxury Pro") {
    return [text(payload.product_type), text(payload.size), text(payload.sku)]
      .filter(Boolean)
      .join(" - ");
  }

  return firstText(
    item.name,
    item.title,
    item.product_name,
    item.productName,
    item.display_name,
    metadata.title,
    metadata.name,
    product.name,
    product.title,
    payload.product_name,
    payload.product,
    payload.item_name,
    payload.title,
    order.product_name,
    order.productName,
    order.title,
  );
}

function monthOf(date: Date): string {
  return formatVietnamDate(date).slice(0, 7);
}

function cogsTreatment(row: {
  supplier: string;
  totalCost: number;
  sourceNote: string | null;
  mappingStatus: string;
}): string {
  if (row.supplier === "Printful") {
    return row.totalCost > 0
      ? "Ghi nhận COGS — fulfilled"
      : "Loại — chi phí bằng 0";
  }
  return row.sourceNote || row.mappingStatus;
}

function payoutType(
  payload: Record<string, unknown>,
  recordType: string,
): string {
  const type = text(payload.type || payload.source_type).toLowerCase();
  if (type === "charge") return "charge";
  if (type === "refund") return "Payments::Refund";
  if (type === "dispute") return "Payments::Dispute";
  return recordType.toLowerCase();
}

function getUniqueKey(sheet: ReportSheet, row: SheetValue[]): string {
  switch (sheet) {
    case "Orders":
      return text(row[2]).trim(); // Order Name (e.g. #1001)
    case "COGS": {
      // Column 9 is itemKey (${supplier}:${sourceRecordId}:${itemIdentifier})
      const itemKey = text(row[9]).trim();
      if (itemKey) return itemKey;
      // Fallback: Supplier (2) + RefOrderId (4) + SupplierOrderId (6) + ItemName (5)
      // Note: Date is NOT included so modified dates update the existing record
      return `${text(row[2]).trim()}_${text(row[4]).trim()}_${text(row[6]).trim()}_${text(row[5]).trim()}`;
    }
    case "Ads":
      return text(row[2]).trim(); // meta:accountId:date
    case "Payouts":
      return text(row[2]).trim(); // Payout ID
  }
}

function normalizeValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    return Number.isInteger(value) ? String(value) : value.toFixed(4);
  }
  const str = String(value).trim();
  const num = Number(str);
  if (!Number.isNaN(num) && str !== "") {
    return Number.isInteger(num) ? String(num) : num.toFixed(4);
  }
  return str;
}

function hashRow(row: SheetValue[]): string {
  // Exclude STT (column index 1) for hashing so that re-ordering doesn't trigger false updates
  const normalized = row.map((val, idx) =>
    idx === 1 ? "" : normalizeValue(val),
  );
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

async function fetchFromPlatforms(
  sheet: ReportSheet,
  from: Date,
  to: Date,
): Promise<SheetValue[][]> {
  switch (sheet) {
    case "Orders": {
      const rows = await fetchShopifyOrdersByUpdated({ from, to });
      return rows.map((row) => {
        const orderDate = new Date(row.createdAt);
        const refundAmount = row.refunds.reduce(
          (total, refund) =>
            total + Number(refund.totalRefundedSet.shopMoney.amount),
          0,
        );
        const orderTotalBeforeRefund = Number(
          row.totalPriceSet.shopMoney.amount,
        );
        const grossSales = row.lineItems.nodes.reduce(
          (total, item) =>
            total + Number(item.originalTotalSet.shopMoney.amount),
          0,
        );
        const itemNames = row.lineItems.nodes
          .map((item) => item.name.trim())
          .filter(Boolean)
          .join(" | ");
        return [
          monthOf(orderDate),
          null, // STT will be reassigned
          row.name,
          formatVietnamDate(orderDate),
          grossSales,
          -Number(row.currentTotalDiscountsSet.shopMoney.amount),
          Number(row.totalShippingPriceSet.shopMoney.amount),
          Number(row.currentTotalTaxSet.shopMoney.amount),
          orderTotalBeforeRefund - refundAmount,
          refundAmount,
          orderTotalBeforeRefund,
          REPORT_SHEETS.Orders.source,
          itemNames,
        ];
      });
    }
    case "COGS": {
      const rows = await fetchCogsFromSourceApis({ from, to });
      return rows.map((row) => [
        monthOf(row.date),
        null,
        row.supplier,
        formatVietnamDate(row.date),
        row.referenceOrderId,
        cogsItemName(row),
        row.supplierOrderId,
        row.totalCost,
        row.estimatedCost,
        row.itemKey,
        cogsTreatment(row),
        REPORT_SHEETS.COGS.source,
      ]);
    }
    case "Ads": {
      const { accountId, rows } = await fetchMetaDailyFinancialsFromApi({
        from,
        to,
      });
      return rows.map((payload) => {
        const date = new Date(`${text(payload.date_start)}T00:00:00.000Z`);
        return [
          monthOf(date),
          null,
          `meta:${accountId}:${text(payload.date_start)}`,
          formatVietnamDate(date),
          accountId,
          text(payload.campaign_id),
          text(payload.campaign_name),
          text(payload.account_currency),
          Number(payload.spend || 0),
          "account daily",
          REPORT_SHEETS.Ads.source,
        ];
      });
    }
    case "Payouts": {
      const rows = await fetchShopifyPaymentTransactionsFromApi({ from, to });
      return rows.map((row) => {
        const date = new Date(
          text(row.processed_at || row.date || row.initiated_at),
        );
        return [
          monthOf(date),
          null,
          text(row.id),
          text(row.payout_id),
          payoutType(record(row), "BALANCE_TRANSACTION"),
          text(row.currency),
          Number(row.amount || 0),
          Number(row.fee || 0),
          Number(row.net || 0),
          date.toISOString(),
          formatVietnamDateTime(date),
          formatVietnamDateTime(date),
          text(row.adjustment_reason || row.reason),
          text(row.source_id || row.order_id || row.source_order_id),
          text(row.order_id || row.source_order_id),
          REPORT_SHEETS.Payouts.source,
        ];
      });
    }
  }
}

let cachedAccessToken: string | null = null;

async function getValidAccessToken(forceRefresh = false): Promise<string> {
  if (!cachedAccessToken || forceRefresh) {
    const access = await getGoogleDriveAccess({ forceRefresh });
    cachedAccessToken = access.accessToken;
  }
  return cachedAccessToken;
}

async function sheetsRequest(
  path: string,
  init?: RequestInit,
  retryCount = 0,
): Promise<Response> {
  const token = await getValidAccessToken();
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );

  if (response.status === 401 && retryCount === 0) {
    console.log("Google Sheets API 401. Refreshing token and retrying...");
    await getValidAccessToken(true);
    return sheetsRequest(path, init, 1);
  }

  if (!response.ok) {
    const payload = record(await response.json());
    throw new Error(
      `Google Sheets API ${response.status}: ${text(record(payload.error).message) || "Request failed."}`,
    );
  }
  return response;
}

async function syncSheet(
  sheet: ReportSheet,
  from: Date,
  to: Date,
): Promise<{ changed: boolean }> {
  console.log(`[${sheet}] Fetching existing rows from Google Sheet...`);
  const { dateIndex, lastColumn } = REPORT_SHEETS[sheet];

  const existingResponse = await sheetsRequest(
    `/values/${encodeURIComponent(`${sheet}!A2:${lastColumn}`)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  const existingPayload = record(await existingResponse.json());
  const existing: SheetValue[][] = Array.isArray(existingPayload.values)
    ? existingPayload.values.filter(Array.isArray)
    : [];

  console.log(`[${sheet}] Found ${existing.length} existing rows.`);

  console.log(`[${sheet}] Fetching new data from platforms...`);
  const newRows = await fetchFromPlatforms(sheet, from, to);
  console.log(
    `[${sheet}] Fetched ${newRows.length} rows updated between ${from.toISOString()} and ${to.toISOString()}.`,
  );

  // Build a map of existing rows by their unique keys
  const mergedMap = new Map<string, SheetValue[]>();
  for (const row of existing) {
    const key = getUniqueKey(sheet, row);
    if (key) {
      mergedMap.set(key, row);
    }
  }

  // Upsert new rows
  for (const row of newRows) {
    const key = getUniqueKey(sheet, row);
    if (key) {
      mergedMap.set(key, row);
    }
  }

  // Convert back to array, sort, and assign STT
  const mergedArray = Array.from(mergedMap.values())
    .sort((left, right) =>
      text(left[dateIndex]).localeCompare(text(right[dateIndex])),
    )
    .map((row, index) => {
      const next = [...row];
      next[1] = index + 2;
      return next;
    });

  // Smart Skip calculation
  let hasChanges = false;
  if (mergedArray.length !== existing.length) {
    hasChanges = true;
    console.log(
      `[${sheet}] Row count changed from ${existing.length} to ${mergedArray.length}.`,
    );
  } else {
    // If length is identical, compare normalized hashes
    for (let i = 0; i < existing.length; i++) {
      if (hashRow(existing[i]) !== hashRow(mergedArray[i])) {
        hasChanges = true;
        console.log(
          `[${sheet}] Data change detected at STT ${mergedArray[i][1]}.`,
        );
        break;
      }
    }
  }

  if (!hasChanges) {
    console.log(`[${sheet}] No changes detected. Smart Skipping write.`);
    return { changed: false };
  }

  console.log(
    `[${sheet}] Writing ${mergedArray.length} rows back to Google Sheets...`,
  );

  // Resize sheet if needed
  const spreadsheetResponse = await sheetsRequest(
    "?fields=sheets.properties(sheetId,title,gridProperties.rowCount)",
  );
  const spreadsheet = record(await spreadsheetResponse.json());
  const sheetProperties = (
    Array.isArray(spreadsheet.sheets) ? spreadsheet.sheets.map(record) : []
  )
    .map((entry) => record(entry.properties))
    .find((properties) => text(properties.title) === sheet);

  const currentRows = Number(record(sheetProperties?.gridProperties).rowCount);
  if (
    sheetProperties &&
    Number.isFinite(currentRows) &&
    currentRows < mergedArray.length + 1
  ) {
    await sheetsRequest(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetProperties.sheetId,
                gridProperties: { rowCount: mergedArray.length + 1_000 },
              },
              fields: "gridProperties.rowCount",
            },
          },
        ],
      }),
    });
  }

  // Clear existing range
  const range = `${sheet}!A2:${lastColumn}`;
  await sheetsRequest(`/values/${encodeURIComponent(range)}:clear`, {
    method: "POST",
    body: "{}",
  });

  // Write in chunks
  const chunkSize = 1_000;
  const data = [];
  for (let offset = 0; offset < mergedArray.length; offset += chunkSize) {
    data.push({
      range: `${sheet}!A${offset + 2}`,
      majorDimension: "ROWS",
      values: mergedArray.slice(offset, offset + chunkSize),
    });
  }
  if (data.length) {
    const batchUpdateResponse = await sheetsRequest("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
    const batchPayload = record(await batchUpdateResponse.json());
    console.log(
      `[${sheet}] batchUpdate confirmed: ${batchPayload.totalUpdatedRows ?? mergedArray.length} rows written.`,
    );
  }

  console.log(
    `[${sheet}] Successfully synced and confirmed ${mergedArray.length} rows.`,
  );
  return { changed: true };
}

async function main() {
  const daysString = process.env.SYNC_DAYS || process.argv[2] || "30";
  const days = parseInt(daysString, 10);
  if (Number.isNaN(days) || days <= 0) {
    console.error("Usage: npx tsx scripts/sync-upstream.ts [days]");
    process.exit(1);
  }

  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);

  console.log(`Starting upstream sync for the last ${days} days...`);
  console.log(`Range: ${from.toISOString()} to ${to.toISOString()}`);

  const sheetsToSync: ReportSheet[] = ["Orders", "COGS", "Ads", "Payouts"];

  let totalChanged = false;
  let hasError = false;

  for (const sheet of sheetsToSync) {
    try {
      const result = await syncSheet(sheet, from, to);
      if (result.changed) {
        totalChanged = true;
      }
    } catch (error) {
      console.error(`[${sheet}] ERROR:`, error);
      hasError = true;
    }
  }

  if (hasError) {
    console.error("Upstream sync completed with errors.");
    process.exit(1);
  }

  if (totalChanged) {
    console.log(
      "Upstream sync completed with changes! Downstream sync should be triggered.",
    );
  } else {
    console.log("Upstream sync completed with no changes.");
  }

  process.exit(0);
}

main();
