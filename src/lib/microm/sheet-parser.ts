import { DEFAULT_FX_EUR_TO_USD } from "./constants";
import { normalizePeriod, normalizeSheetDate } from "./date-utils";

export interface ParsedMicromOrder {
  sourceRow: number;
  orderId: string;
  shopifyId: string;
  orderDate: Date;
  period: string;
  financialStatus: string;
  fulfillmentStatus: string | null;
  currency: string;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  grossOrder: number;
  eligibleRevenueEur: number;
  fxRate: number;
  eligibleRevenueUsdCalc: number;
  grossOrderUsdCalc: number;
  sourceLine: string | null;
  rawValues: unknown[];
}

export interface ParsedMicromCogs {
  sourceRow: number;
  pgprintOrderId: string;
  pgcOrderId: string | null;
  customerOrderId: string | null;
  costDate: Date;
  period: string;
  sourceStatus: string | null;
  currency: string;
  production: number;
  shipping: number;
  cogsSourceUsd: number;
  eligibleCogsUsd: number;
  sourceLine: string | null;
  controlNote: string | null;
  rowKey: string;
  rawValues: unknown[];
}

export interface ParsedMicromAd {
  sourceRow: number;
  accountName: string;
  accountId: string;
  date: Date;
  period: string;
  currency: string;
  spendUsd: number;
  impressions: number;
  clicks: number;
  purchases: number;
  sourceLine: string | null;
  controlNote: string | null;
  rowKey: string;
  rawValues: unknown[];
}

export interface ParsedMicromShopifyItem {
  sourceRow: number;
  orderId: string;
  lineItemId: string;
  productName: string;
  sku: string | null;
  quantity: number;
  lineTotal: number;
  currency: string;
  fulfillment: string | null;
  sourceLine: string | null;
  rawValues: unknown[];
}

export function parseNumber(val: unknown, fallback = 0): number {
  if (val === null || val === undefined || val === "") return fallback;
  if (typeof val === "number") return val;
  const str = String(val).trim().replace(/\s/g, "").replace(",", ".");
  const num = Number(str);
  return Number.isNaN(num) ? fallback : num;
}

export function parseInteger(val: unknown, fallback = 0): number {
  return Math.round(parseNumber(val, fallback));
}

export function parseMicromOrders(rows: unknown[][]): ParsedMicromOrder[] {
  const result: ParsedMicromOrder[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sourceRow = i + 2; // header is row 1
    const orderId = String(r[0] ?? "").trim();
    const shopifyId = String(r[1] ?? "").trim();

    if (!shopifyId && !orderId) continue;
    if (!shopifyId) {
      throw new Error(`Orders row ${sourceRow} is missing Shopify ID.`);
    }

    if (seenKeys.has(shopifyId)) {
      throw new Error(
        `Duplicate Shopify ID "${shopifyId}" at row ${sourceRow}.`,
      );
    }
    seenKeys.add(shopifyId);

    const dateStr = normalizeSheetDate(r[2]);
    if (!dateStr) {
      throw new Error(`Orders row ${sourceRow} has invalid or missing date.`);
    }
    const orderDate = new Date(`${dateStr}T00:00:00.000Z`);
    const period = normalizePeriod(r[3], dateStr);

    const financialStatus = String(r[4] ?? "")
      .trim()
      .toLowerCase();
    const fulfillmentStatus = r[5] ? String(r[5]).trim() : null;
    const currency = String(r[6] ?? "EUR").trim();

    const subtotal = parseNumber(r[7]);
    const discount = parseNumber(r[8]);
    const shipping = parseNumber(r[9]);
    const tax = parseNumber(r[10]);
    const grossOrder = parseNumber(r[11]);
    const eligibleRevenueEur = parseNumber(r[12]);

    const fxRate = DEFAULT_FX_EUR_TO_USD;
    const eligibleRevenueUsdCalc = Number(
      (eligibleRevenueEur * fxRate).toFixed(4),
    );
    const grossOrderUsdCalc = Number((grossOrder * fxRate).toFixed(4));
    const sourceLine = r[13] ? String(r[13]).trim() : null;

    result.push({
      sourceRow,
      orderId,
      shopifyId,
      orderDate,
      period,
      financialStatus,
      fulfillmentStatus,
      currency,
      subtotal,
      discount,
      shipping,
      tax,
      grossOrder,
      eligibleRevenueEur,
      fxRate,
      eligibleRevenueUsdCalc,
      grossOrderUsdCalc,
      sourceLine,
      rawValues: r,
    });
  }

  return result;
}

export function parseMicromCogs(rows: unknown[][]): ParsedMicromCogs[] {
  const result: ParsedMicromCogs[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sourceRow = i + 2;
    const pgprintOrderId = String(r[0] ?? "").trim();
    const pgcOrderId = r[1] ? String(r[1]).trim() : null;
    const customerOrderId = r[2] ? String(r[2]).trim() : null;

    if (!pgprintOrderId) continue;

    const dateStr = normalizeSheetDate(r[3]);
    if (!dateStr) {
      throw new Error(`COGS row ${sourceRow} has invalid or missing date.`);
    }
    const costDate = new Date(`${dateStr}T00:00:00.000Z`);
    const period = normalizePeriod(r[4], dateStr);
    const sourceStatus = r[5] ? String(r[5]).trim() : null;
    const currency = String(r[6] ?? "USD").trim();

    const production = parseNumber(r[7]);
    const shipping = parseNumber(r[8]);
    const cogsSourceUsd = parseNumber(r[9]);
    const eligibleCogsUsd = parseNumber(r[10]);
    const sourceLine = r[11] ? String(r[11]).trim() : null;
    const controlNote = r[12] ? String(r[12]).trim() : null;

    const itemMatch = sourceLine
      ? sourceLine.match(/\|\s*Item\s*([^|]+)/i)
      : null;
    const itemSuffix = itemMatch ? `_${itemMatch[1].trim()}` : "";
    let rowKey = `${pgprintOrderId}_${customerOrderId || ""}${itemSuffix}`;
    if (seenKeys.has(rowKey)) {
      rowKey = `${rowKey}_${sourceRow}`;
    }
    seenKeys.add(rowKey);

    result.push({
      sourceRow,
      pgprintOrderId,
      pgcOrderId,
      customerOrderId,
      costDate,
      period,
      sourceStatus,
      currency,
      production,
      shipping,
      cogsSourceUsd,
      eligibleCogsUsd,
      sourceLine,
      controlNote,
      rowKey,
      rawValues: r,
    });
  }

  return result;
}

export function parseMicromAds(rows: unknown[][]): ParsedMicromAd[] {
  const result: ParsedMicromAd[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sourceRow = i + 2;
    const accountName = String(r[0] ?? "").trim();
    const accountId = String(r[1] ?? "").trim();

    if (!accountId) continue;

    const dateStr = normalizeSheetDate(r[2]);
    if (!dateStr) {
      throw new Error(`Ads row ${sourceRow} has invalid or missing date.`);
    }
    const date = new Date(`${dateStr}T00:00:00.000Z`);
    const period = normalizePeriod(r[3], dateStr);

    const spendUsd = parseNumber(r[4]);
    const impressions = parseInteger(r[5]);
    const clicks = parseInteger(r[6]);
    const purchases = parseInteger(r[7]);
    const sourceLine = r[8] ? String(r[8]).trim() : null;
    const controlNote = r[9] ? String(r[9]).trim() : null;

    const rowKey = `${accountId}_${dateStr}`;
    if (seenKeys.has(rowKey)) {
      throw new Error(
        `Duplicate Ads account-day "${rowKey}" at row ${sourceRow}.`,
      );
    }
    seenKeys.add(rowKey);

    result.push({
      sourceRow,
      accountName,
      accountId,
      date,
      period,
      currency: "USD",
      spendUsd,
      impressions,
      clicks,
      purchases,
      sourceLine,
      controlNote,
      rowKey,
      rawValues: r,
    });
  }

  return result;
}

export function parseMicromShopifyItems(
  rows: unknown[][],
): ParsedMicromShopifyItem[] {
  const result: ParsedMicromShopifyItem[] = [];
  const seenKeys = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const sourceRow = i + 2;
    const orderId = String(r[0] ?? "").trim();
    const lineItemId = String(r[1] ?? "").trim();

    if (!lineItemId) continue;
    if (seenKeys.has(lineItemId)) {
      throw new Error(
        `Duplicate Line Item ID "${lineItemId}" at row ${sourceRow}.`,
      );
    }
    seenKeys.add(lineItemId);

    const productName = String(r[2] ?? "").trim();
    const sku = r[3] ? String(r[3]).trim() : null;
    const quantity = parseInteger(r[4], 1);
    const lineTotal = parseNumber(r[5]);
    const currency = String(r[6] ?? "EUR").trim();
    const fulfillment = r[7] ? String(r[7]).trim() : null;
    const sourceLine = r[8] ? String(r[8]).trim() : null;

    result.push({
      sourceRow,
      orderId,
      lineItemId,
      productName,
      sku,
      quantity,
      lineTotal,
      currency,
      fulfillment,
      sourceLine,
      rawValues: r,
    });
  }

  return result;
}
