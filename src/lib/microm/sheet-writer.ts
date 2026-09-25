import crypto from "node:crypto";
import { MICROM_TABS, type MicromTabName, TAB_COLUMNS_MAP } from "./constants";
import { normalizePeriod, normalizeSheetDate } from "./date-utils";
import type {
  MicromAdRow,
  MicromCogsRow,
  MicromOrderRow,
  MicromShopifyItemRow,
} from "./types";

export class MicromHeaderDriftError extends Error {
  constructor(
    public tab: MicromTabName,
    public expected: readonly string[] | string[],
    public actual: unknown[],
  ) {
    super(
      `Phát hiện sai lệch cấu trúc cột (header drift) tại tab "${tab}". Yêu cầu dừng thao tác để bảo vệ dữ liệu Google Sheet.`,
    );
    this.name = "MicromHeaderDriftError";
  }
}

/**
 * Validates sheet headers against the strict contract
 */
export async function validateSheetHeaders(
  spreadsheetId: string,
  accessToken: string,
  tab: MicromTabName,
): Promise<void> {
  const expected = TAB_COLUMNS_MAP[tab];
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    tab,
  )}!A1:Z1?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to read header for tab ${tab}: HTTP ${res.status} - ${errText}`,
    );
  }

  const data = (await res.json()) as { values?: unknown[][] };
  const actual = data.values?.[0] || [];

  if (actual.length < expected.length) {
    throw new MicromHeaderDriftError(tab, expected, actual);
  }

  for (let i = 0; i < expected.length; i++) {
    const act = String(actual[i] ?? "").trim();
    const exp = expected[i].trim();
    if (act !== exp) {
      throw new MicromHeaderDriftError(tab, expected, actual);
    }
  }
}

/**
 * Read existing data rows with strict HTTP status validation
 */
async function fetchSheetRows(
  spreadsheetId: string,
  accessToken: string,
  tab: string,
  range: string,
): Promise<unknown[][]> {
  const readUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    `${tab}!${range}`,
  )}?valueRenderOption=UNFORMATTED_VALUE`;
  const res = await fetch(readUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to read existing rows from tab "${tab}": HTTP ${res.status} - ${errText}`,
    );
  }
  const data = (await res.json()) as { values?: unknown[][] };
  return data.values || [];
}

/**
 * Clear data rows (A2:Z) in a tab while keeping header row 1 untouched
 */
async function clearTabDataRows(
  spreadsheetId: string,
  accessToken: string,
  tab: MicromTabName,
  lastCol: string,
): Promise<void> {
  const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    `${tab}!A2:${lastCol}`,
  )}:clear`;
  const res = await fetch(clearUrl, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Failed to clear rows in tab "${tab}": HTTP ${res.status} - ${errText}`,
    );
  }
}

/**
 * Computes a deterministic SHA-256 fingerprint for a tab's rows
 */
export function computeTabFingerprint(rows: unknown[][]): string {
  const hash = crypto.createHash("sha256");
  for (const r of rows) {
    hash.update(JSON.stringify(r));
  }
  return hash.digest("hex");
}

/**
 * Extract item suffix from PGPrint nguonDong to ensure unique composite key for multi-child items
 */
function extractCogsItemKey(sourceLine: string): string {
  const match = sourceLine.match(/\|\s*Item\s*([^|]+)/i);
  return match ? match[1].trim() : "";
}

function buildCogsRowKey(
  pgprintOrderId: string,
  customerOrderId: string,
  sourceLine: string,
  fallbackIdx?: number,
): string {
  const itemPart = extractCogsItemKey(sourceLine);
  if (itemPart) {
    return `${pgprintOrderId}_${customerOrderId || ""}_${itemPart}`;
  }
  return fallbackIdx !== undefined
    ? `${pgprintOrderId}_${customerOrderId || ""}_${fallbackIdx}`
    : `${pgprintOrderId}_${customerOrderId || ""}`;
}

/**
 * Upsert Orders into sheet tab `Orders`
 */
export async function writeOrdersToSheet(
  spreadsheetId: string,
  accessToken: string,
  newRows: MicromOrderRow[],
): Promise<{ writtenCount: number; fingerprint: string }> {
  await validateSheetHeaders(spreadsheetId, accessToken, MICROM_TABS.ORDERS);

  const existingRows = await fetchSheetRows(
    spreadsheetId,
    accessToken,
    MICROM_TABS.ORDERS,
    "A2:N",
  );

  // Map by Shopify ID (index 1)
  const rowsMap = new Map<string, unknown[]>();
  for (const r of existingRows) {
    const shopifyId = String(r[1] ?? "").trim();
    if (shopifyId) {
      r[2] = normalizeSheetDate(r[2]);
      r[3] = normalizePeriod(r[3], String(r[2]));
      rowsMap.set(shopifyId, r);
    }
  }

  // Merge new rows
  for (const r of newRows) {
    const rowArray = [
      r.orderId,
      r.shopifyId,
      r.ngayTao,
      r.ky,
      r.trangThaiThanhToan,
      r.fulfillment,
      r.currency,
      r.subtotal,
      r.discount,
      r.shipping,
      r.tax,
      r.grossOrder,
      r.doanhThuHopLeEur,
      r.nguonDong,
    ];
    rowsMap.set(r.shopifyId, rowArray);
  }

  // Sort descending by Ngày tạo
  const finalRows = Array.from(rowsMap.values()).sort((a, b) => {
    const dateA = String(a[2] ?? "");
    const dateB = String(b[2] ?? "");
    return dateB.localeCompare(dateA);
  });

  await clearTabDataRows(spreadsheetId, accessToken, MICROM_TABS.ORDERS, "N");

  const range = `${MICROM_TABS.ORDERS}!A2:N${finalRows.length + 1}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range,
  )}?valueInputOption=USER_ENTERED`;

  const updateRes = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: finalRows }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(
      `Failed to write Orders to sheet: HTTP ${updateRes.status} - ${errText}`,
    );
  }

  const fingerprint = computeTabFingerprint(finalRows);
  return { writtenCount: finalRows.length, fingerprint };
}

/**
 * Upsert COGS into sheet tab `COGS`
 */
export async function writeCogsToSheet(
  spreadsheetId: string,
  accessToken: string,
  newRows: MicromCogsRow[],
): Promise<{ writtenCount: number; fingerprint: string }> {
  await validateSheetHeaders(spreadsheetId, accessToken, MICROM_TABS.COGS);

  const existingRows = await fetchSheetRows(
    spreadsheetId,
    accessToken,
    MICROM_TABS.COGS,
    "A2:M",
  );

  // Map by composite key (PGPrint Order ID + Customer Order ID + Child Item Identifier)
  const rowsMap = new Map<string, unknown[]>();
  for (let idx = 0; idx < existingRows.length; idx++) {
    const r = existingRows[idx];
    const pgId = String(r[0] ?? "").trim();
    const custId = String(r[2] ?? "").trim();
    const srcLine = String(r[11] ?? "").trim();
    if (pgId) {
      r[3] = normalizeSheetDate(r[3]);
      r[4] = normalizePeriod(r[4], String(r[3]));
      const key = buildCogsRowKey(pgId, custId, srcLine, idx);
      rowsMap.set(key, r);
    }
  }

  for (let idx = 0; idx < newRows.length; idx++) {
    const r = newRows[idx];
    const key = buildCogsRowKey(
      r.pgprintOrderId,
      r.customerOrderId,
      r.nguonDong,
      idx,
    );
    const rowArray = [
      r.pgprintOrderId,
      r.pgcOrderId,
      r.customerOrderId,
      r.ngayTao,
      r.ky,
      r.statusSource,
      r.currency,
      r.production,
      r.shipping,
      r.cogsSourceUsd,
      r.cogsDuDieuKienUsd,
      r.nguonDong,
      r.kiemSoat,
    ];
    rowsMap.set(key, rowArray);
  }

  const finalRows = Array.from(rowsMap.values()).sort((a, b) => {
    const dateA = String(a[3] ?? "");
    const dateB = String(b[3] ?? "");
    return dateB.localeCompare(dateA);
  });

  await clearTabDataRows(spreadsheetId, accessToken, MICROM_TABS.COGS, "M");

  const range = `${MICROM_TABS.COGS}!A2:M${finalRows.length + 1}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range,
  )}?valueInputOption=USER_ENTERED`;

  const updateRes = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: finalRows }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(
      `Failed to write COGS to sheet: HTTP ${updateRes.status} - ${errText}`,
    );
  }

  const fingerprint = computeTabFingerprint(finalRows);
  return { writtenCount: finalRows.length, fingerprint };
}

/**
 * Upsert Ads into sheet tab `Ads`
 */
export async function writeAdsToSheet(
  spreadsheetId: string,
  accessToken: string,
  newRows: MicromAdRow[],
): Promise<{ writtenCount: number; fingerprint: string }> {
  await validateSheetHeaders(spreadsheetId, accessToken, MICROM_TABS.ADS);

  const existingRows = await fetchSheetRows(
    spreadsheetId,
    accessToken,
    MICROM_TABS.ADS,
    "A2:J",
  );

  // Key: (AccountId, Date)
  const rowsMap = new Map<string, unknown[]>();
  for (const r of existingRows) {
    const accId = String(r[1] ?? "").trim();
    const date = normalizeSheetDate(r[2]);
    if (accId && date) {
      r[2] = date;
      r[3] = normalizePeriod(r[3], date);
      rowsMap.set(`${accId}_${date}`, r);
    }
  }

  for (const r of newRows) {
    const key = `${r.accountId}_${r.ngay}`;
    const rowArray = [
      r.account,
      r.accountId,
      r.ngay,
      r.ky,
      r.spendUsd,
      r.impressions,
      r.clicks,
      r.purchases,
      r.nguonDong,
      r.kiemSoat,
    ];
    rowsMap.set(key, rowArray);
  }

  const finalRows = Array.from(rowsMap.values()).sort((a, b) => {
    const dateA = String(a[2] ?? "");
    const dateB = String(b[2] ?? "");
    return (
      dateB.localeCompare(dateA) || String(a[1]).localeCompare(String(b[1]))
    );
  });

  await clearTabDataRows(spreadsheetId, accessToken, MICROM_TABS.ADS, "J");

  const range = `${MICROM_TABS.ADS}!A2:J${finalRows.length + 1}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range,
  )}?valueInputOption=USER_ENTERED`;

  const updateRes = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: finalRows }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(
      `Failed to write Ads to sheet: HTTP ${updateRes.status} - ${errText}`,
    );
  }

  const fingerprint = computeTabFingerprint(finalRows);
  return { writtenCount: finalRows.length, fingerprint };
}

/**
 * Upsert Shopify_Items into sheet tab `Shopify_Items`
 */
export async function writeShopifyItemsToSheet(
  spreadsheetId: string,
  accessToken: string,
  newRows: MicromShopifyItemRow[],
): Promise<{ writtenCount: number; fingerprint: string }> {
  await validateSheetHeaders(
    spreadsheetId,
    accessToken,
    MICROM_TABS.SHOPIFY_ITEMS,
  );

  const existingRows = await fetchSheetRows(
    spreadsheetId,
    accessToken,
    MICROM_TABS.SHOPIFY_ITEMS,
    "A2:I",
  );

  // Key: Line Item ID (col 1)
  const rowsMap = new Map<string, unknown[]>();
  for (const r of existingRows) {
    const itemId = String(r[1] ?? "").trim();
    if (itemId) {
      rowsMap.set(itemId, r);
    }
  }

  for (const r of newRows) {
    const rowArray = [
      r.orderId,
      r.lineItemId,
      r.tenSanPham,
      r.sku,
      r.quantity,
      r.lineTotal,
      r.currency,
      r.fulfillment,
      r.nguonDong,
    ];
    rowsMap.set(r.lineItemId, rowArray);
  }

  const finalRows = Array.from(rowsMap.values()).sort((a, b) => {
    return String(a[0]).localeCompare(String(b[0]));
  });

  await clearTabDataRows(
    spreadsheetId,
    accessToken,
    MICROM_TABS.SHOPIFY_ITEMS,
    "I",
  );

  const range = `${MICROM_TABS.SHOPIFY_ITEMS}!A2:I${finalRows.length + 1}`;
  const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
    range,
  )}?valueInputOption=USER_ENTERED`;

  const updateRes = await fetch(updateUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ values: finalRows }),
  });

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    throw new Error(
      `Failed to write Shopify_Items to sheet: HTTP ${updateRes.status} - ${errText}`,
    );
  }

  const fingerprint = computeTabFingerprint(finalRows);
  return { writtenCount: finalRows.length, fingerprint };
}
