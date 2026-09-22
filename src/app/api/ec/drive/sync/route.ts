import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { fetchCogsFromSourceApis } from "@/lib/cogs-sync";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  vietnamMonthRange,
} from "@/lib/date-time";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";
import { fetchMetaDailyFinancialsFromApi } from "@/lib/meta-daily-financials-sync";
import { prisma } from "@/lib/prisma";
import { fetchShopifyPaymentTransactionsFromApi } from "@/lib/shopify-payments-rest-sync";
import { fetchShopifyOrdersFromApi } from "@/lib/shopify-raw-order-sync";

const REPORT_SPREADSHEET_ID =
  process.env.EC_REPORT_SPREADSHEET_ID ||
  "19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8";

const REPORT_SHEETS = {
  Orders: { lastColumn: "L", dateIndex: 3, source: "all-data / RAW.ORDER" },
  COGS: { lastColumn: "K", dateIndex: 3, source: "all-data / RAW.COGS" },
  Ads: { lastColumn: "K", dateIndex: 3, source: "all-data / META_ADS" },
  Payouts: {
    lastColumn: "P",
    dateIndex: 9,
    source: "all-data / RAW.PAYOUT_DETAIL",
  },
} as const;

type ReportSheet = keyof typeof REPORT_SHEETS;
type SheetValue = string | number | null;

function isReportSheet(value: string): value is ReportSheet {
  return value in REPORT_SHEETS;
}

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

function vietnamDayStart(value: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("Date must use YYYY-MM-DD.");
  }
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day) - 7 * 60 * 60 * 1_000);
  if (Number.isNaN(date.getTime())) throw new Error("Invalid date.");
  return date;
}

function parseRange(payload: {
  month?: string;
  fromMonth?: string;
  toMonth?: string;
  fromDate?: string;
  toDate?: string;
  rangeType?: string;
}): { from: Date; to: Date } {
  if (payload.rangeType === "date") {
    if (!payload.fromDate || !payload.toDate)
      throw new Error("Date range is required.");
    const from = vietnamDayStart(payload.fromDate);
    const to = new Date(vietnamDayStart(payload.toDate).getTime() + 86_400_000);
    if (to <= from) throw new Error("End date must not be before start date.");
    return { from, to };
  }
  const fromMonth = payload.fromMonth || payload.month;
  const toMonth = payload.toMonth || fromMonth;
  if (!fromMonth || !toMonth) throw new Error("Month range is required.");
  const from = vietnamMonthRange(fromMonth);
  const to = vietnamMonthRange(toMonth);
  if (to.from < from.from)
    throw new Error("End month must not be before start month.");
  return { from: from.from, to: to.to };
}

async function valuesFor(
  sheet: ReportSheet,
  from: Date,
  to: Date,
): Promise<SheetValue[][]> {
  switch (sheet) {
    case "Orders": {
      const rows = await fetchShopifyOrdersFromApi({ from, to });
      return rows.map((row, index) => {
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
        return [
          monthOf(orderDate),
          index + 2,
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
        ];
      });
    }
    case "COGS": {
      const rows = await fetchCogsFromSourceApis({ from, to });
      return rows.map((row, index) => [
        monthOf(row.date),
        index + 2,
        row.supplier,
        formatVietnamDate(row.date),
        row.referenceOrderId,
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
      return rows.map((payload, index) => {
        const date = new Date(`${text(payload.date_start)}T00:00:00.000Z`);
        return [
          monthOf(date),
          index + 2,
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
      return rows.map((row, index) => {
        const date = new Date(
          text(row.processed_at || row.date || row.initiated_at),
        );
        return [
          monthOf(date),
          index + 2,
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

async function sheetsRequest(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );
  if (!response.ok) {
    const payload = record(await response.json());
    throw new Error(
      `Google Sheets API ${response.status}: ${text(record(payload.error).message) || "Request failed."}`,
    );
  }
  return response;
}

async function writeSheet(
  accessToken: string,
  sheet: ReportSheet,
  values: SheetValue[][],
  from: Date,
  to: Date,
): Promise<void> {
  const { dateIndex, lastColumn } = REPORT_SHEETS[sheet];
  const existingResponse = await sheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(`${sheet}!A2:${lastColumn}`)}?valueRenderOption=FORMATTED_VALUE`,
  );
  const existingPayload = record(await existingResponse.json());
  const existing = Array.isArray(existingPayload.values)
    ? existingPayload.values.filter(Array.isArray)
    : [];
  const preserved = existing.filter((row) => {
    const dateValue = text(row[dateIndex]);
    const date = new Date(
      dateValue.includes("T") ? dateValue : `${dateValue}T00:00:00.000Z`,
    );
    return Number.isNaN(date.getTime()) || date < from || date >= to;
  });
  const numbered = [...preserved, ...values]
    .sort((left, right) =>
      text(left[dateIndex]).localeCompare(text(right[dateIndex])),
    )
    .map((row, index) => {
      const next = [...row];
      next[1] = index + 2;
      return next;
    });
  const spreadsheetResponse = await sheetsRequest(
    accessToken,
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
    currentRows < numbered.length + 1
  ) {
    await sheetsRequest(accessToken, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId: sheetProperties.sheetId,
                gridProperties: { rowCount: numbered.length + 1_000 },
              },
              fields: "gridProperties.rowCount",
            },
          },
        ],
      }),
    });
  }
  const range = `${sheet}!A2:${lastColumn}`;
  await sheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(range)}:clear`,
    {
      method: "POST",
      body: "{}",
    },
  );
  const chunkSize = 1_000;
  const data = [];
  for (let offset = 0; offset < numbered.length; offset += chunkSize) {
    data.push({
      range: `${sheet}!A${offset + 2}`,
      majorDimension: "ROWS",
      values: numbered.slice(offset, offset + chunkSize),
    });
  }
  if (data.length) {
    await sheetsRequest(accessToken, "/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
  }

  const verificationResponse = await sheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  const verification = record(await verificationResponse.json());
  const writtenRows = Array.isArray(verification.values)
    ? verification.values.filter(Array.isArray).length
    : 0;
  if (writtenRows !== numbered.length) {
    throw new Error(
      `${sheet} wrote ${writtenRows} of ${numbered.length} expected rows.`,
    );
  }
}

async function syncReportSheet(
  runId: string,
  sheet: ReportSheet,
  from: Date,
  to: Date,
  accessToken: string,
): Promise<void> {
  try {
    const values = await valuesFor(sheet, from, to);
    await writeSheet(accessToken, sheet, values, from, to);
    await prisma.ecDriveSyncRun.update({
      where: { id: runId },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        rowCount: values.length,
        driveFileId: REPORT_SPREADSHEET_ID,
        driveFileName: "EcomCreate_TheDeerly_PL_FINAL",
        driveFileUrl: `https://docs.google.com/spreadsheets/d/${REPORT_SPREADSHEET_ID}/edit`,
        errorMessage: null,
      },
    });
  } catch (error) {
    await prisma.ecDriveSyncRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage:
          error instanceof Error ? error.message : "Google Sheet sync failed.",
      },
    });
  }
}

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  const payload = (await request.json()) as {
    shop?: string;
    month?: string;
    fromMonth?: string;
    toMonth?: string;
    fromDate?: string;
    toDate?: string;
    rangeType?: string;
    sources?: string[];
  };
  const shop = payload.shop?.trim();
  const sheets = [
    ...new Set(payload.sources?.filter(isReportSheet) ?? []),
  ] as ReportSheet[];
  if (!shop || !sheets.length) {
    return NextResponse.json(
      { error: "Shop and at least one report sheet are required." },
      { status: 400 },
    );
  }
  let range: { from: Date; to: Date };
  try {
    range = parseRange(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Invalid date range." },
      { status: 400 },
    );
  }
  const runs = await Promise.all(
    sheets.map((source) =>
      prisma.ecDriveSyncRun.create({
        data: {
          shop,
          source,
          rangeFrom: range.from,
          rangeTo: range.to,
          status: "RUNNING",
          requestedBy: user.email,
          startedAt: new Date(),
        },
      }),
    ),
  );
  try {
    const { accessToken } = await getGoogleDriveAccess();
    await Promise.all(
      runs.map((run) =>
        syncReportSheet(
          run.id,
          run.source as ReportSheet,
          range.from,
          range.to,
          accessToken,
        ),
      ),
    );
  } catch (error) {
    await Promise.all(
      runs.map((run) =>
        prisma.ecDriveSyncRun.update({
          where: { id: run.id },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage:
              error instanceof Error
                ? error.message
                : "Google Sheet sync failed.",
          },
        }),
      ),
    );
  }
  return NextResponse.json({ success: true });
}
