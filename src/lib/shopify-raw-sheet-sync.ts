import { getGoogleDriveAccess } from "@/lib/ec-drive";

const SPREADSHEET_ID =
  process.env.EC_SHOPIFY_RAW_SPREADSHEET_ID ||
  "1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU";
const SHEET_NAME = "RAW sàn";
const PAGE_SIZE = 250;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const TIME_ZONE = "Asia/Ho_Chi_Minh";
const HEADERS = [
  "Ngày giao dịch",
  "Transaction dates (phạm vi giao dịch)",
  "Dự án",
  "Store",
  "Sàn/cổng thanh toán",
  "Pháp nhân",
  "Tiền tệ",
  "Mã order",
  "Mã payout/deposit",
  "Loại giao dịch",
  "Trạng thái gốc",
  "Nhóm trạng thái",
  "Số tiền gross",
  "Phí",
  "Thuế",
  "Hoàn/chargeback",
  "Reserve/hold",
  "Net payout",
  "Ngày dự kiến",
  "Ngày gửi",
  "Nguồn file",
  "Dòng nguồn",
  "Ghi chú",
  "Payment provider",
  "Lấy lúc (múi giờ)",
] as const;

type JsonRecord = Record<string, unknown>;
type SheetValue = string | number;
type ShopifyTransaction = JsonRecord & {
  id?: string | number;
  type?: string;
  processed_at?: string;
  currency?: string;
  amount?: string | number;
  fee?: string | number;
  net?: string | number;
  payout_id?: string | number;
  payout_status?: string;
  source_order_id?: string | number;
  adjustment_reason?: string;
};
type ShopifyPayout = JsonRecord & {
  id?: string | number;
  status?: string;
  date?: string;
  currency?: string;
  summary?: JsonRecord;
};
type ShopifyOrder = {
  id: string;
  name: string;
  currentTotalTaxSet?: { shopMoney?: { amount?: string } };
};

class ApiRequestError extends Error {
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

function numericValue(value: unknown): number | "" {
  if (value === null || value === undefined || value === "") return "";
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : "";
}

function getShopifyEndpoint(path: string): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.trim()
    .replace(/^https?:\/\//, "")
    .replace(/\/$/, "");
  const token = process.env.SHOPIFY_ACCESS_TOKEN?.trim();
  if (!domain || !token) throw new Error("Shopify credentials are missing.");
  return `https://${domain}/admin/api/${SHOPIFY_API_VERSION}/${path}`;
}

function getShopifyHeaders(): HeadersInit {
  const token = process.env.SHOPIFY_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN must be configured.");
  return { "X-Shopify-Access-Token": token };
}

function monthUtcRange(month: string): {
  start: Date;
  end: Date;
  lastDay: number;
} {
  const [year, monthNumber] = month.split("-").map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).getUTCDate();
  const end = new Date(`${month}-01T00:00:00+07:00`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  return {
    start: new Date(`${month}-01T00:00:00+07:00`),
    end,
    lastDay,
  };
}

function formatDateTimeInVietnam(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatDateInVietnam(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function statusGroup(status: unknown): string {
  const value = stringValue(status).toLowerCase();
  if (value === "paid") return "Đã thanh toán";
  if (["pending", "scheduled", "in_transit"].includes(value))
    return "Đang xử lý";
  if (value === "failed") return "Thất bại";
  if (["canceled", "cancelled"].includes(value)) return "Đã hủy";
  return "";
}

function transactionDateRange(dates: Iterable<string>): string {
  const sortedDates = [...new Set(dates)].sort();
  const groups: string[][] = [];
  for (const date of sortedDates) {
    const currentDay = new Date(`${date}T00:00:00.000Z`).getTime();
    const previousDate = groups.at(-1)?.at(-1);
    if (
      previousDate &&
      currentDay - new Date(`${previousDate}T00:00:00.000Z`).getTime() ===
        86_400_000
    ) {
      groups.at(-1)?.push(date);
    } else {
      groups.push([date]);
    }
  }
  return groups
    .map((group) =>
      group.length > 1 ? `${group[0]} - ${group.at(-1)}` : group[0],
    )
    .join(", ");
}

function getNextPage(response: Response): string | null {
  return (
    response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null
  );
}

async function shopifyJson(url: string): Promise<{
  payload: JsonRecord;
  next: string | null;
}> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      headers: getShopifyHeaders(),
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
      throw new ApiRequestError(
        `Shopify API ${response.status}: ${stringValue(record(payload.errors).message) || "Request failed."}`,
        response.status,
      );
    }
    return { payload, next: getNextPage(response) };
  }
  throw new Error("Shopify API rate limit persisted after retries.");
}

async function fetchCollection(
  path: string,
  key: string,
): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  let url: string | null = getShopifyEndpoint(path);
  while (url) {
    const page = await shopifyJson(url);
    const pageRows = page.payload[key];
    if (Array.isArray(pageRows)) rows.push(...pageRows.map(record));
    url = page.next;
  }
  return rows;
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

async function fetchMonthTransactions(
  month: string,
): Promise<ShopifyTransaction[]> {
  const { start, end } = monthUtcRange(month);
  const max = new Date(end.getTime() - 1).toISOString();
  const rows = await fetchCollection(
    `shopify_payments/balance/transactions.json?processed_at_min=${encodeURIComponent(start.toISOString())}&processed_at_max=${encodeURIComponent(max)}&limit=${PAGE_SIZE}`,
    "transactions",
  );
  return rows
    .map((row) => row as ShopifyTransaction)
    .filter(
      (row) =>
        Boolean(row.processed_at) &&
        formatDateInVietnam(row.processed_at as string).startsWith(`${month}-`),
    );
}

async function fetchPayout(payoutId: string): Promise<ShopifyPayout | null> {
  const { payload } = await shopifyJson(
    getShopifyEndpoint(
      `shopify_payments/payouts/${encodeURIComponent(payoutId)}.json`,
    ),
  );
  const payout = payload.payout;
  return payout ? (record(payout) as ShopifyPayout) : null;
}

async function fetchPayouts(
  month: string,
  transactions: ShopifyTransaction[],
): Promise<Map<string, ShopifyPayout>> {
  const { lastDay } = monthUtcRange(month);
  const payouts = await fetchCollection(
    `shopify_payments/payouts.json?date_min=${month}-01&date_max=${month}-${String(lastDay).padStart(2, "0")}&limit=${PAGE_SIZE}`,
    "payouts",
  );
  const byId = new Map<string, ShopifyPayout>();
  for (const row of payouts as ShopifyPayout[]) {
    if (row.id !== undefined) byId.set(String(row.id), row);
  }

  const missingIds = [
    ...new Set(
      transactions
        .map((transaction) => stringValue(transaction.payout_id))
        .filter((id) => id && !byId.has(id)),
    ),
  ];
  const missingPayouts = await mapConcurrent(missingIds, 4, fetchPayout);
  for (const payout of missingPayouts) {
    if (payout?.id !== undefined) byId.set(String(payout.id), payout);
  }
  return byId;
}

function orderGraphqlId(value: unknown): string | null {
  const id = stringValue(value);
  if (!id) return null;
  return id.startsWith("gid://") ? id : `gid://shopify/Order/${id}`;
}

async function fetchOrders(
  transactions: ShopifyTransaction[],
): Promise<Map<string, ShopifyOrder>> {
  const orderIds = [
    ...new Set(
      transactions
        .map((transaction) => orderGraphqlId(transaction.source_order_id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const orders = new Map<string, ShopifyOrder>();
  const endpoint = getShopifyEndpoint("graphql.json");
  for (let start = 0; start < orderIds.length; start += 100) {
    const ids = orderIds.slice(start, start + 100);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { ...getShopifyHeaders(), "Content-Type": "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        query: `query RawSheetOrders($ids: [ID!]!) {
          nodes(ids: $ids) {
            ... on Order {
              id
              name
              currentTotalTaxSet { shopMoney { amount } }
            }
          }
        }`,
        variables: { ids },
      }),
    });
    const payload = record(await response.json());
    const errors = payload.errors;
    if (!response.ok || (Array.isArray(errors) && errors.length)) {
      throw new ApiRequestError(
        `Shopify Orders GraphQL ${response.status}: ${JSON.stringify(errors || "Request failed.")}`,
        response.status,
      );
    }
    const data = record(payload.data);
    const nodes = Array.isArray(data.nodes) ? data.nodes : [];
    for (const value of nodes) {
      if (!value) continue;
      const order = record(value) as unknown as ShopifyOrder;
      const id = order.id.split("/").at(-1);
      if (id) orders.set(id, order);
    }
  }
  return orders;
}

function buildRows(
  transactions: ShopifyTransaction[],
  payouts: Map<string, ShopifyPayout>,
  orders: Map<string, ShopifyOrder>,
  fetchedAt: string,
): SheetValue[][] {
  const daysByPayout = new Map<string, Set<string>>();
  for (const transaction of transactions) {
    const payoutId = stringValue(transaction.payout_id);
    const processedAt = transaction.processed_at;
    if (
      !payoutId ||
      !processedAt ||
      stringValue(transaction.type).toLowerCase() === "payout"
    ) {
      continue;
    }
    const days = daysByPayout.get(payoutId) ?? new Set<string>();
    days.add(formatDateInVietnam(processedAt));
    daysByPayout.set(payoutId, days);
  }

  const storeName =
    process.env.EC_SHOPIFY_RAW_STORE_NAME?.trim() || "The Deerly";
  return transactions.map((transaction) => {
    const type = stringValue(transaction.type);
    const payoutId = stringValue(transaction.payout_id);
    const sourceOrderId = stringValue(transaction.source_order_id);
    const orderId = sourceOrderId.split("/").at(-1) || "";
    const order = orders.get(orderId);
    const payout = payouts.get(payoutId);
    const amount = numericValue(transaction.amount);
    let tax: number | "" = "";
    const orderTax = numericValue(order?.currentTotalTaxSet?.shopMoney?.amount);
    if (
      type.toLowerCase() === "debit" &&
      orderTax !== "" &&
      orderTax > 0 &&
      amount !== "" &&
      Math.abs(Math.abs(amount) - orderTax) < 0.00001
    ) {
      tax = orderTax;
    }
    const isRefundOrChargeback = ["refund", "dispute", "chargeback"].includes(
      type.toLowerCase(),
    );
    const transactionRange = transactionDateRange(
      daysByPayout.get(payoutId) ?? [],
    );

    return [
      transaction.processed_at
        ? formatDateTimeInVietnam(transaction.processed_at)
        : "",
      transactionRange,
      "",
      storeName,
      "Shopify Payments",
      "",
      stringValue(transaction.currency),
      order?.name || sourceOrderId,
      payoutId,
      type,
      stringValue(transaction.payout_status),
      statusGroup(transaction.payout_status),
      amount,
      numericValue(transaction.fee),
      tax,
      isRefundOrChargeback ? amount : "",
      "",
      numericValue(transaction.net),
      "",
      stringValue(payout?.date),
      "",
      "",
      stringValue(transaction.adjustment_reason),
      "Shopify Payments",
      fetchedAt,
    ];
  });
}

async function googleRequest(
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
      cache: "no-store",
    },
  );
  if (!response.ok) {
    const payload = record(await response.json());
    throw new ApiRequestError(
      `Google Sheets API ${response.status}: ${stringValue(record(payload.error).message) || "Request failed."}`,
      response.status,
    );
  }
  return response;
}

async function withGoogleAccess<T>(
  operation: (accessToken: string) => Promise<T>,
): Promise<T> {
  const { accessToken } = await getGoogleDriveAccess();
  try {
    return await operation(accessToken);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401)
      throw error;
    const refreshed = await getGoogleDriveAccess({ forceRefresh: true });
    return operation(refreshed.accessToken);
  }
}

async function writeMonth(
  month: string,
  monthRows: SheetValue[][],
): Promise<{ replacedRows: number }> {
  return withGoogleAccess(async (accessToken) => {
    const sheetRange = `'${SHEET_NAME}'`;
    const encodedReadRange = encodeURIComponent(`${sheetRange}!A1:Y`);
    const readResponse = await googleRequest(
      accessToken,
      `/values/${encodedReadRange}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const payload = record(await readResponse.json());
    const existingRows = Array.isArray(payload.values)
      ? (payload.values as unknown[][]).map((row) =>
          Array.from(
            { length: HEADERS.length },
            (_, index) => (row[index] as SheetValue | undefined) ?? "",
          ),
        )
      : [];
    const currentHeaders = existingRows[0] ?? [];
    if (JSON.stringify(currentHeaders) !== JSON.stringify(HEADERS)) {
      throw new Error(
        "Header tab RAW sàn không khớp cấu trúc 25 cột; chưa ghi dữ liệu.",
      );
    }

    const rows = existingRows.slice(1);
    const preservedRows = rows.filter(
      (row) => !String(row[0] || "").startsWith(`${month}-`),
    );
    const combined = [...preservedRows, ...monthRows].sort((left, right) =>
      String(right[0] || "").localeCompare(String(left[0] || "")),
    );
    const lastExistingRow = rows.length + 1;
    const lastCombinedRow = combined.length + 1;

    if (combined.length) {
      await googleRequest(accessToken, "/values:batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: [
            {
              range: `${sheetRange}!A2:Y${lastCombinedRow}`,
              majorDimension: "ROWS",
              values: combined,
            },
          ],
        }),
      });
    }

    if (lastExistingRow > lastCombinedRow) {
      await googleRequest(
        accessToken,
        `/values/${encodeURIComponent(`${sheetRange}!A${lastCombinedRow + 1}:Y${lastExistingRow}`)}:clear`,
        { method: "POST", body: "{}" },
      );
    }

    const verifyResponse = await googleRequest(
      accessToken,
      `/values/${encodeURIComponent(`${sheetRange}!A2:Y${lastCombinedRow}`)}?valueRenderOption=UNFORMATTED_VALUE`,
    );
    const verifyPayload = record(await verifyResponse.json());
    const verifiedRows = Array.isArray(verifyPayload.values)
      ? (verifyPayload.values as unknown[][])
      : [];
    const verifiedMonthRows = verifiedRows.filter((row) =>
      String(row[0] || "").startsWith(`${month}-`),
    );
    if (verifiedMonthRows.length !== monthRows.length) {
      throw new Error(
        `Đã ghi nhưng xác minh thấy ${verifiedMonthRows.length}/${monthRows.length} dòng của tháng ${month}.`,
      );
    }
    return { replacedRows: rows.length - preservedRows.length };
  });
}

export async function syncShopifyRawMonthToSheet(
  month: string,
): Promise<{ rowsWritten: number; replacedRows: number }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Vui lòng chọn tháng hợp lệ.");
  }

  const transactions = await fetchMonthTransactions(month);
  if (!transactions.length) {
    throw new Error(
      `Shopify không trả giao dịch nào cho tháng ${month}; sheet chưa thay đổi.`,
    );
  }
  const [payouts, orders] = await Promise.all([
    fetchPayouts(month, transactions),
    fetchOrders(transactions),
  ]);
  const payoutIds = [
    ...new Set(
      transactions.map((row) => stringValue(row.payout_id)).filter(Boolean),
    ),
  ];
  const payoutTransactions = await mapConcurrent(
    payoutIds,
    4,
    async (payoutId) =>
      fetchCollection(
        `shopify_payments/balance/transactions.json?payout_id=${encodeURIComponent(payoutId)}&limit=${PAGE_SIZE}`,
        "transactions",
      ),
  );
  const daySets = new Map<string, Set<string>>();
  for (let index = 0; index < payoutIds.length; index += 1) {
    const payoutId = payoutIds[index];
    const days = new Set<string>();
    for (const raw of payoutTransactions[index]) {
      if (
        stringValue(raw.type).toLowerCase() === "payout" ||
        typeof raw.processed_at !== "string"
      ) {
        continue;
      }
      days.add(formatDateInVietnam(raw.processed_at));
    }
    daySets.set(payoutId, days);
  }
  const rows = buildRows(transactions, payouts, orders, "");
  for (let index = 0; index < transactions.length; index += 1) {
    const payoutId = stringValue(transactions[index].payout_id);
    rows[index][1] = transactionDateRange(daySets.get(payoutId) ?? []);
    rows[index][24] = formatDateTimeInVietnam(new Date().toISOString());
  }
  const result = await writeMonth(month, rows);
  return { rowsWritten: rows.length, replacedRows: result.replacedRows };
}
