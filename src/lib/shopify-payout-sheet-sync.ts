import { getGoogleDriveAccess } from "@/lib/ec-drive";

const SPREADSHEET_ID =
  process.env.EC_SHOPIFY_PAYOUT_SPREADSHEET_ID ||
  "1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU";
const SHEET_NAME = "Store — Deerlys";
const FIRST_DATA_ROW = 9;
const PAGE_SIZE = 250;
const MAX_CONCURRENT_PAYOUTS = 4;

type JsonRecord = Record<string, unknown>;
type SheetValue = string | number;

class GoogleSheetsRequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function stringValue(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function getShopifyEndpoint(path: string): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env.SHOPIFY_ACCESS_TOKEN?.trim();
  if (!domain || !token) throw new Error("Shopify credentials are missing.");
  return `https://${domain}/admin/api/${process.env.SHOPIFY_API_VERSION || "2026-07"}/${path}`;
}

function nextPageUrl(response: Response): string | null {
  return (
    response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null
  );
}

async function shopifyPage(
  url: string,
): Promise<{ payload: JsonRecord; next: string | null }> {
  const token = process.env.SHOPIFY_ACCESS_TOKEN?.trim();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: { "X-Shopify-Access-Token": token || "" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status === 429 && attempt < 2) {
      const retryAfter = Number(response.headers.get("retry-after")) || 2;
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(retryAfter, 10) * 1_000),
      );
      continue;
    }
    const payload = record(await response.json());
    if (!response.ok) {
      throw new Error(
        `Shopify Payments API ${response.status}: ${stringValue(record(payload.errors).message) || "Request failed."}`,
      );
    }
    return { payload, next: nextPageUrl(response) };
  }
  throw new Error("Shopify Payments API rate limit persisted after retries.");
}

async function fetchCollection(
  path: string,
  key: string,
): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  let url: string | null = getShopifyEndpoint(path);
  while (url) {
    const page = await shopifyPage(url);
    const pageRows = page.payload[key];
    if (Array.isArray(pageRows)) rows.push(...pageRows.map(record));
    url = page.next;
  }
  return rows;
}

function dateInVietnam(value: unknown): string | null {
  if (typeof value !== "string" || !value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value]),
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function transactionDateDisplay(dates: string[]): string {
  const uniqueDates = [...new Set(dates)].sort();
  const groups: string[][] = [];
  for (const date of uniqueDates) {
    const current = new Date(`${date}T00:00:00.000Z`).getTime();
    const previous = groups.at(-1)?.at(-1);
    if (
      previous &&
      current - new Date(`${previous}T00:00:00.000Z`).getTime() === 86_400_000
    ) {
      groups.at(-1)?.push(date);
    } else {
      groups.push([date]);
    }
  }
  return groups
    .map(([first, ...rest]) =>
      rest.length ? `${first} - ${rest.at(-1)}` : first,
    )
    .join(", ");
}

async function mapConcurrent<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      while (nextIndex < values.length) {
        const index = nextIndex;
        nextIndex += 1;
        results[index] = await mapper(values[index]);
      }
    }),
  );
  return results;
}

async function fetchTransactionsForPayout(
  payoutId: string,
): Promise<JsonRecord[]> {
  return fetchCollection(
    `shopify_payments/balance/transactions.json?payout_id=${encodeURIComponent(payoutId)}&limit=${PAGE_SIZE}`,
    "transactions",
  );
}

export async function fetchShopifyPayoutSheetRows(
  month: string,
): Promise<SheetValue[][]> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Tháng không hợp lệ.");
  }
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const payouts = (
    await fetchCollection(
      `shopify_payments/payouts.json?date_min=${month}-01&date_max=${month}-${String(lastDay).padStart(2, "0")}&limit=${PAGE_SIZE}`,
      "payouts",
    )
  ).filter((payout) => stringValue(payout.date).startsWith(`${month}-`));

  const rows = await mapConcurrent(
    payouts,
    MAX_CONCURRENT_PAYOUTS,
    async (payout) => {
      const payoutId = stringValue(payout.id);
      const payoutDate = stringValue(payout.date);
      const status = stringValue(payout.status);
      if (
        !payoutId ||
        !payoutDate ||
        !status ||
        payout.amount == null ||
        payout.amount === ""
      ) {
        throw new Error(
          "Shopify returned a payout without required source fields.",
        );
      }
      const transactions = await fetchTransactionsForPayout(payoutId);
      const dates = transactions
        .filter(
          (transaction) =>
            stringValue(transaction.type).toLowerCase() !== "payout",
        )
        .map((transaction) => dateInVietnam(transaction.processed_at))
        .filter((date): date is string => date !== null);
      const amount = Number(payout.amount);
      if (!Number.isFinite(amount)) {
        throw new Error(
          `Shopify returned an invalid amount for payout ${payoutId}.`,
        );
      }
      return {
        date: payoutDate,
        values: [
          payoutDate,
          transactionDateDisplay(dates),
          "Shopify Payments",
          status,
          amount,
        ] satisfies SheetValue[],
      };
    },
  );

  return rows
    .sort((left, right) => right.date.localeCompare(left.date))
    .map((row) => row.values);
}

async function sheetsRequest(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`,
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
    throw new GoogleSheetsRequestError(
      `Google Sheets API ${response.status}: ${stringValue(record(payload.error).message) || "Request failed."}`,
      response.status,
    );
  }
  return response;
}

async function writeRowsWithToken(
  accessToken: string,
  month: string,
  monthRows: SheetValue[][],
): Promise<number> {
  const range = encodeURIComponent(`${SHEET_NAME}!A${FIRST_DATA_ROW}:E`);
  const existingResponse = await sheetsRequest(
    accessToken,
    `/values/${range}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  const existingPayload = record(await existingResponse.json());
  const existingRows = Array.isArray(existingPayload.values)
    ? existingPayload.values
        .filter(Array.isArray)
        .map((row) => row as SheetValue[])
    : [];
  const preservedRows = existingRows.filter(
    (row) => !stringValue(row[0]).startsWith(`${month}-`),
  );
  const combined = [...preservedRows, ...monthRows].sort((left, right) =>
    stringValue(right[0]).localeCompare(stringValue(left[0])),
  );
  const lastExistingRow = FIRST_DATA_ROW + existingRows.length - 1;
  const lastCombinedRow = FIRST_DATA_ROW + combined.length - 1;

  if (combined.length) {
    await sheetsRequest(accessToken, "/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: [
          {
            range: `${SHEET_NAME}!A${FIRST_DATA_ROW}:E${lastCombinedRow}`,
            majorDimension: "ROWS",
            values: combined,
          },
        ],
      }),
    });
  }
  if (lastExistingRow > lastCombinedRow) {
    await sheetsRequest(
      accessToken,
      `/values/${encodeURIComponent(`${SHEET_NAME}!A${Math.max(FIRST_DATA_ROW, lastCombinedRow + 1)}:E${lastExistingRow}`)}:clear`,
      { method: "POST", body: "{}" },
    );
  }
  return monthRows.length;
}

export async function syncShopifyPayoutMonthToSheet(
  month: string,
): Promise<number> {
  const rows = await fetchShopifyPayoutSheetRows(month);
  const { accessToken } = await getGoogleDriveAccess();
  try {
    return await writeRowsWithToken(accessToken, month, rows);
  } catch (error) {
    if (!(error instanceof GoogleSheetsRequestError) || error.status !== 401) {
      throw error;
    }
    const refreshed = await getGoogleDriveAccess({ forceRefresh: true });
    return writeRowsWithToken(refreshed.accessToken, month, rows);
  }
}
