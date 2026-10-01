import { getGoogleDriveAccess } from "@/lib/ec-drive";

const SPREADSHEET_ID =
  process.env.EC_SHOPIFY_RAW_SPREADSHEET_ID ||
  "1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU";
const SHEET_NAME = "RAW sàn";
const PAGE_SIZE = 250;
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION || "2026-07";
const TIME_ZONE = "Asia/Ho_Chi_Minh";

export const HEADERS = [
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

export const GRAPHQL_ORDER_BATCH_SIZE = 250;

export type JsonRecord = Record<string, unknown>;
export type SheetValue = string | number;
export type ShopifyTransaction = JsonRecord & {
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
export type ShopifyPayout = JsonRecord & {
  id?: string | number;
  status?: string;
  date?: string;
  currency?: string;
  summary?: JsonRecord;
};
export type ShopifyOrder = {
  id: string;
  name: string;
  currentTotalTaxSet?: { shopMoney?: { amount?: string } };
};

export type ShopifySyncContext = {
  getGoogleDriveAccess?: (options?: { forceRefresh?: boolean }) => Promise<{
    accessToken: string;
    rootFolderId?: string;
  }>;
  googleRequest?: typeof googleRequest;
  shopifyFetch?: typeof fetch;
  now?: () => string;
  bypassPayoutCache?: boolean;
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

function isValidDateString(str: string): boolean {
  if (!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(str)) {
    return false;
  }
  const date = new Date(`${str}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;
  return date.toISOString().slice(0, 10) === str;
}

export function isValidTransactionDateRange(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;

  const segments = trimmed.split(", ");
  if (segments.length === 0) return false;

  let lastDate = "";
  for (const segment of segments) {
    const match = segment.match(
      /^(\d{4}-\d{2}-\d{2})(?: - (\d{4}-\d{2}-\d{2}))?$/,
    );
    if (!match) return false;
    const startDate = match[1];
    const endDate = match[2];

    if (!isValidDateString(startDate)) return false;

    if (endDate) {
      if (!isValidDateString(endDate)) return false;
      if (startDate >= endDate) return false;
      if (lastDate && startDate <= lastDate) return false;
      lastDate = endDate;
    } else {
      if (lastDate && startDate <= lastDate) return false;
      lastDate = startDate;
    }
  }

  return true;
}

export function isDateCoveredByRange(
  date: string,
  rangeString: string,
): boolean {
  if (!isValidDateString(date) || !isValidTransactionDateRange(rangeString)) {
    return false;
  }
  const segments = rangeString.split(", ");
  for (const segment of segments) {
    const match = segment.match(
      /^(\d{4}-\d{2}-\d{2})(?: - (\d{4}-\d{2}-\d{2}))?$/,
    );
    if (!match) continue;
    const startDate = match[1];
    const endDate = match[2];
    if (endDate) {
      if (date >= startDate && date <= endDate) return true;
    } else {
      if (date === startDate) return true;
    }
  }
  return false;
}

export function extractPayoutDateRangeCache(
  existingRows: unknown[][],
  payouts: Map<string, ShopifyPayout>,
  currentMonthTransactions?: ShopifyTransaction[],
): Map<string, string> {
  const rangesByPayout = new Map<string, Set<string>>();
  const hasEmptyOrInvalidByPayout = new Set<string>();
  const knownDaysByPayout = new Map<string, Set<string>>();

  for (let i = 1; i < existingRows.length; i += 1) {
    const row = existingRows[i];
    if (!row || !Array.isArray(row)) continue;
    const payoutId = stringValue(row[8]).trim();
    if (!payoutId) continue;

    // Thu thập tất cả các ngày giao dịch hiện có trên sheet của payout này (cột A)
    const rowDate = stringValue(row[0]).trim().slice(0, 10);
    if (isValidDateString(rowDate)) {
      const days = knownDaysByPayout.get(payoutId) ?? new Set<string>();
      days.add(rowDate);
      knownDaysByPayout.set(payoutId, days);
    }

    const rawRange = stringValue(row[1]).trim();
    if (!rawRange || !isValidTransactionDateRange(rawRange)) {
      hasEmptyOrInvalidByPayout.add(payoutId);
      continue;
    }

    const set = rangesByPayout.get(payoutId) ?? new Set<string>();
    set.add(rawRange);
    rangesByPayout.set(payoutId, set);
  }

  if (currentMonthTransactions) {
    for (const tx of currentMonthTransactions) {
      const payoutId = stringValue(tx.payout_id).trim();
      const processedAt = tx.processed_at;
      if (
        !payoutId ||
        !processedAt ||
        stringValue(tx.type).toLowerCase() === "payout"
      ) {
        continue;
      }
      const days = knownDaysByPayout.get(payoutId) ?? new Set<string>();
      days.add(formatDateInVietnam(processedAt));
      knownDaysByPayout.set(payoutId, days);
    }
  }

  const validCache = new Map<string, string>();
  for (const [payoutId, ranges] of rangesByPayout.entries()) {
    if (hasEmptyOrInvalidByPayout.has(payoutId)) {
      continue;
    }
    if (ranges.size !== 1) {
      continue;
    }
    const payout = payouts.get(payoutId);
    if (!payout) {
      continue;
    }
    const status = stringValue(payout.status).toLowerCase();
    if (status !== "paid") {
      continue;
    }

    const [singleRange] = ranges;

    // Kiểm tra tính bao phủ (coverage):
    // Các ngày giao dịch đã biết của payout này trong tháng hiện tại
    // BẮT BUỘC phải nằm trọn vẹn trong khoảng ngày candidate cache.
    // Nếu có bất kỳ ngày nào nằm ngoài cache -> cache bị thiếu/lỗi thời -> từ chối cache để gọi API.
    const knownDays = knownDaysByPayout.get(payoutId);
    if (knownDays && knownDays.size > 0) {
      let isCovered = true;
      for (const day of knownDays) {
        if (!isDateCoveredByRange(day, singleRange)) {
          isCovered = false;
          break;
        }
      }
      if (!isCovered) {
        continue;
      }
    }

    validCache.set(payoutId, singleRange);
  }

  return validCache;
}

function getNextPage(response: Response): string | null {
  return (
    response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null
  );
}

async function shopifyJson(
  url: string,
  fetchFn: typeof fetch = fetch,
): Promise<{
  payload: JsonRecord;
  next: string | null;
}> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetchFn(url, {
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
  fetchFn: typeof fetch = fetch,
): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  let url: string | null = getShopifyEndpoint(path);
  while (url) {
    const page = await shopifyJson(url, fetchFn);
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
  fetchFn: typeof fetch = fetch,
): Promise<ShopifyTransaction[]> {
  const { start, end } = monthUtcRange(month);
  const max = new Date(end.getTime() - 1).toISOString();
  const rows = await fetchCollection(
    `shopify_payments/balance/transactions.json?processed_at_min=${encodeURIComponent(start.toISOString())}&processed_at_max=${encodeURIComponent(max)}&limit=${PAGE_SIZE}`,
    "transactions",
    fetchFn,
  );
  return rows
    .map((row) => row as ShopifyTransaction)
    .filter(
      (row) =>
        Boolean(row.processed_at) &&
        formatDateInVietnam(row.processed_at as string).startsWith(`${month}-`),
    );
}

async function fetchPayout(
  payoutId: string,
  fetchFn: typeof fetch = fetch,
): Promise<ShopifyPayout | null> {
  const { payload } = await shopifyJson(
    getShopifyEndpoint(
      `shopify_payments/payouts/${encodeURIComponent(payoutId)}.json`,
    ),
    fetchFn,
  );
  const payout = payload.payout;
  return payout ? (record(payout) as ShopifyPayout) : null;
}

async function fetchPayouts(
  month: string,
  transactions: ShopifyTransaction[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, ShopifyPayout>> {
  const { lastDay } = monthUtcRange(month);
  const payouts = await fetchCollection(
    `shopify_payments/payouts.json?date_min=${month}-01&date_max=${month}-${String(lastDay).padStart(2, "0")}&limit=${PAGE_SIZE}`,
    "payouts",
    fetchFn,
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
  const missingPayouts = await mapConcurrent(missingIds, 4, (id) =>
    fetchPayout(id, fetchFn),
  );
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

export async function fetchOrders(
  transactions: ShopifyTransaction[],
  fetchFn: typeof fetch = fetch,
): Promise<Map<string, ShopifyOrder>> {
  const orderIds = [
    ...new Set(
      transactions
        .map((transaction) => orderGraphqlId(transaction.source_order_id))
        .filter((id): id is string => Boolean(id)),
    ),
  ];
  const orders = new Map<string, ShopifyOrder>();
  if (!orderIds.length) return orders;

  const endpoint = getShopifyEndpoint("graphql.json");
  for (
    let start = 0;
    start < orderIds.length;
    start += GRAPHQL_ORDER_BATCH_SIZE
  ) {
    const ids = orderIds.slice(start, start + GRAPHQL_ORDER_BATCH_SIZE);
    let payload: JsonRecord = {};
    let succeeded = false;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetchFn(endpoint, {
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

      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after")) || 2;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(retryAfter, 10) * 1_000),
        );
        continue;
      }

      payload = record(await response.json());
      const errors = payload.errors;

      const isThrottled =
        Array.isArray(errors) &&
        errors.some((err) => {
          const errRec = record(err);
          const code = record(errRec.extensions).code;
          const msg = stringValue(errRec.message).toLowerCase();
          return code === "THROTTLED" || msg.includes("throttled");
        });

      if (isThrottled && attempt < 2) {
        const extensions = record(payload.extensions);
        const cost = record(extensions.cost);
        const throttleStatus = record(cost.throttleStatus);
        const currentlyAvailable =
          Number(throttleStatus.currentlyAvailable) || 0;
        const restoreRate = Number(throttleStatus.restoreRate) || 50;
        const needed = 250;
        const waitSeconds =
          currentlyAvailable < needed
            ? Math.ceil(
                (needed - currentlyAvailable) / Math.max(restoreRate, 1),
              )
            : 2;
        await new Promise((resolve) =>
          setTimeout(resolve, Math.min(Math.max(waitSeconds, 1), 10) * 1_000),
        );
        continue;
      }

      if (!response.ok || (Array.isArray(errors) && errors.length)) {
        throw new ApiRequestError(
          `Shopify Orders GraphQL ${response.status}: ${JSON.stringify(errors || "Request failed.")}`,
          response.status,
        );
      }

      succeeded = true;
      break;
    }

    if (!succeeded) {
      throw new Error(
        "Shopify Orders GraphQL rate limit persisted after retries.",
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

export async function googleRequest(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = path.startsWith("https://")
    ? path
    : `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const payload = record(await response.json());
    throw new ApiRequestError(
      `Google API ${response.status}: ${stringValue(record(payload.error).message) || "Request failed."}`,
      response.status,
    );
  }
  return response;
}

function isProtectedRangeIntersectingData(range?: JsonRecord): boolean {
  if (!range) {
    // Không có range chỉ định nghĩa là bảo vệ toàn bộ sheet
    return true;
  }
  const startCol =
    range.startColumnIndex !== undefined ? Number(range.startColumnIndex) : 0;
  const endCol =
    range.endColumnIndex !== undefined
      ? Number(range.endColumnIndex)
      : Number.POSITIVE_INFINITY;
  const startRow =
    range.startRowIndex !== undefined ? Number(range.startRowIndex) : 0;
  const endRow =
    range.endRowIndex !== undefined
      ? Number(range.endRowIndex)
      : Number.POSITIVE_INFINITY;

  // Giao với cột A:Y ([0, 25)) và hàng 2 trở đi ([1, Infinity))
  const colIntersect = startCol < HEADERS.length && endCol > 0;
  const rowIntersect = endRow > 1 && startRow < Number.POSITIVE_INFINITY;

  return colIntersect && rowIntersect;
}

function isDataFullyUnprotected(unprotectedRanges?: JsonRecord[]): boolean {
  if (!Array.isArray(unprotectedRanges) || unprotectedRanges.length === 0) {
    return false;
  }
  return unprotectedRanges.some((upr) => {
    const startCol =
      upr.startColumnIndex !== undefined ? Number(upr.startColumnIndex) : 0;
    const endCol =
      upr.endColumnIndex !== undefined
        ? Number(upr.endColumnIndex)
        : Number.POSITIVE_INFINITY;
    const startRow =
      upr.startRowIndex !== undefined ? Number(upr.startRowIndex) : 0;
    const endRow =
      upr.endRowIndex !== undefined
        ? Number(upr.endRowIndex)
        : Number.POSITIVE_INFINITY;

    // Bao phủ toàn bộ vùng dữ liệu A2:Y
    return (
      startCol <= 0 &&
      endCol >= HEADERS.length &&
      startRow <= 1 &&
      endRow === Number.POSITIVE_INFINITY
    );
  });
}

export async function preflightGoogleSheet(
  accessToken: string,
  requestFn: typeof googleRequest = googleRequest,
): Promise<string[]> {
  // 1. Kiểm tra quyền chỉnh sửa spreadsheet của tài khoản qua Drive API capabilities(canEdit,canModifyContent) (GET read-only)
  try {
    const driveResponse = await requestFn(
      accessToken,
      `https://www.googleapis.com/drive/v3/files/${SPREADSHEET_ID}?fields=capabilities(canEdit,canModifyContent)`,
    );
    const drivePayload = record(await driveResponse.json());
    if (driveResponse.ok) {
      const capabilities = record(drivePayload.capabilities);
      if (
        capabilities.canEdit !== true ||
        capabilities.canModifyContent !== true
      ) {
        throw new Error(
          `Tài khoản không có đủ quyền chỉnh sửa nội dung spreadsheet (canEdit: ${capabilities.canEdit ?? false}, canModifyContent: ${capabilities.canModifyContent ?? false}).`,
        );
      }
    }
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw error;
    }
    throw new Error(
      `Pre-flight Google Sheet thất bại (quyền chỉnh sửa): ${
        error instanceof Error ? error.message : "Không có quyền chỉnh sửa."
      }`,
    );
  }

  // 2. Kiểm tra tab RAW sàn và các vùng bảo vệ (protected ranges) qua Sheets metadata (GET read-only)
  try {
    const metaResponse = await requestFn(
      accessToken,
      "?fields=sheets(properties(sheetId,title),protectedRanges)",
    );
    const metaPayload = record(await metaResponse.json());
    if (metaResponse.ok) {
      const sheets = Array.isArray(metaPayload.sheets)
        ? metaPayload.sheets
        : [];
      const targetSheet = sheets.find(
        (s) => record(record(s).properties).title === SHEET_NAME,
      );
      if (!targetSheet) {
        throw new Error(
          `Không tìm thấy tab "${SHEET_NAME}" trong spreadsheet.`,
        );
      }

      const protectedRanges = Array.isArray(record(targetSheet).protectedRanges)
        ? (record(targetSheet).protectedRanges as JsonRecord[])
        : [];
      for (const pr of protectedRanges) {
        // warningOnly = true thì Google Sheet chỉ hiện cảnh báo, không chặn ghi dữ liệu qua API
        if (pr.warningOnly === true) {
          continue;
        }
        // requestingUserCanEdit = true thì user có quyền chỉnh sửa protected range này
        if (pr.requestingUserCanEdit !== false) {
          continue;
        }

        const prRange = pr.range ? record(pr.range) : undefined;
        // Kiểm tra xem protected range có giao với vùng dữ liệu A2:Y không
        if (!isProtectedRangeIntersectingData(prRange)) {
          // Chỉ khóa cột ngoài A:Y (ví dụ cột Z trở đi) hoặc chỉ khóa hàng tiêu đề A1:Y1 -> không ảnh hưởng A2:Y
          continue;
        }

        // Nếu là protected sheet có thiết lập unprotectedRanges cho toàn bộ A2:Y thì vẫn cho phép sửa
        const unprotected = Array.isArray(pr.unprotectedRanges)
          ? (pr.unprotectedRanges as JsonRecord[])
          : undefined;
        if (isDataFullyUnprotected(unprotected)) {
          continue;
        }

        throw new Error(
          `Tab "${SHEET_NAME}" có vùng bảo vệ không cho phép chỉnh sửa dữ liệu A2:Y.`,
        );
      }
    }
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw error;
    }
    throw new Error(
      `Pre-flight Google Sheet thất bại (metadata tab): ${
        error instanceof Error ? error.message : "Lỗi kiểm tra metadata tab."
      }`,
    );
  }

  // 3. Đọc và kiểm tra cấu trúc 25 cột header A1:Y1 (GET read-only)
  const sheetRange = `'${SHEET_NAME}'`;
  const encodedRange = encodeURIComponent(`${sheetRange}!A1:Y1`);
  let headerResponse: Response;
  try {
    headerResponse = await requestFn(
      accessToken,
      `/values/${encodedRange}?valueRenderOption=UNFORMATTED_VALUE`,
    );
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 401) {
      throw error;
    }
    throw new Error(
      `Pre-flight Google Sheet thất bại (đọc header): ${
        error instanceof Error ? error.message : "Không thể đọc header."
      }`,
    );
  }

  const payload = record(await headerResponse.json());
  if (!headerResponse.ok) {
    const errorMsg =
      stringValue(record(payload.error).message) ||
      stringValue(payload.error) ||
      `HTTP ${headerResponse.status}`;
    if (headerResponse.status === 401) {
      throw new ApiRequestError(`Google Sheets API 401: ${errorMsg}`, 401);
    }
    throw new Error(
      `Pre-flight Google Sheet thất bại: Google Sheets API ${headerResponse.status}: ${errorMsg}`,
    );
  }

  const values = Array.isArray(payload.values) ? payload.values : [];
  const firstRow = Array.isArray(values[0]) ? values[0] : [];
  const currentHeaders = firstRow.map(stringValue);

  if (currentHeaders.length !== HEADERS.length) {
    throw new Error(
      `Header tab ${SHEET_NAME} không đủ 25 cột: mong đợi ${HEADERS.length} cột, nhận được ${currentHeaders.length} cột.`,
    );
  }

  for (let i = 0; i < HEADERS.length; i += 1) {
    if (currentHeaders[i] !== HEADERS[i]) {
      throw new Error(
        `Header tab ${SHEET_NAME} sai ở cột ${i + 1}: mong đợi "${HEADERS[i]}", nhận được "${currentHeaders[i]}".`,
      );
    }
  }

  return currentHeaders;
}

async function withGoogleAccess<T>(
  operation: (accessToken: string) => Promise<T>,
  options?: {
    getGoogleDriveAccess?: (options?: { forceRefresh?: boolean }) => Promise<{
      accessToken: string;
      rootFolderId?: string;
    }>;
  },
): Promise<T> {
  const getAccess = options?.getGoogleDriveAccess || getGoogleDriveAccess;
  const { accessToken } = await getAccess();
  try {
    return await operation(accessToken);
  } catch (error) {
    if (!(error instanceof ApiRequestError) || error.status !== 401)
      throw error;
    const refreshed = await getAccess({ forceRefresh: true });
    return operation(refreshed.accessToken);
  }
}

async function writeMonth(
  month: string,
  monthRows: SheetValue[][],
  options?: {
    accessToken?: string;
    existingRows?: SheetValue[][];
    payoutDateRanges?: Map<string, string>;
    googleRequestFn?: typeof googleRequest;
    getGoogleDriveAccessFn?: (options?: { forceRefresh?: boolean }) => Promise<{
      accessToken: string;
      rootFolderId?: string;
    }>;
  },
): Promise<{ replacedRows: number }> {
  const reqFn = options?.googleRequestFn || googleRequest;
  const getAccessFn = options?.getGoogleDriveAccessFn || getGoogleDriveAccess;

  const performWrite = async (
    accessToken: string,
    existingRowsArg?: SheetValue[][],
  ) => {
    const sheetRange = `'${SHEET_NAME}'`;
    let existingRows = existingRowsArg;

    if (!existingRows) {
      const encodedReadRange = encodeURIComponent(`${sheetRange}!A1:Y`);
      const readResponse = await reqFn(
        accessToken,
        `/values/${encodedReadRange}?valueRenderOption=UNFORMATTED_VALUE`,
      );
      const payload = record(await readResponse.json());
      existingRows = Array.isArray(payload.values)
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
    }

    const rows = existingRows.slice(1);
    const preservedRows = rows.filter(
      (row) => !String(row[0] || "").startsWith(`${month}-`),
    );

    // Backfill: đồng bộ cột B (Transaction dates) cho toàn bộ các dòng thuộc các tháng khác
    // có cùng payout ID nếu payout đó được tính toán/xác nhận date range trong lần sync này.
    if (options?.payoutDateRanges) {
      for (const preservedRow of preservedRows) {
        const payoutId = stringValue(preservedRow[8]).trim();
        if (payoutId && options.payoutDateRanges.has(payoutId)) {
          const fullRange = options.payoutDateRanges.get(payoutId);
          if (fullRange && preservedRow[1] !== fullRange) {
            preservedRow[1] = fullRange;
          }
        }
      }
    }

    const combined = [...preservedRows, ...monthRows].sort((left, right) =>
      String(right[0] || "").localeCompare(String(left[0] || "")),
    );
    const lastExistingRow = rows.length + 1;
    const lastCombinedRow = combined.length + 1;

    if (combined.length) {
      await reqFn(accessToken, "/values:batchUpdate", {
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
      await reqFn(
        accessToken,
        `/values/${encodeURIComponent(`${sheetRange}!A${lastCombinedRow + 1}:Y${lastExistingRow}`)}:clear`,
        { method: "POST", body: "{}" },
      );
    }

    const verifyResponse = await reqFn(
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
  };

  if (options?.accessToken) {
    try {
      return await performWrite(options.accessToken, options.existingRows);
    } catch (error) {
      if (!(error instanceof ApiRequestError) || error.status !== 401) {
        throw error;
      }
      return withGoogleAccess(
        (refreshedToken) => performWrite(refreshedToken),
        { getGoogleDriveAccess: getAccessFn },
      );
    }
  }

  return withGoogleAccess(
    (accessToken) => performWrite(accessToken, options?.existingRows),
    { getGoogleDriveAccess: getAccessFn },
  );
}

let isSyncInProgress = false;

export async function syncShopifyRawMonthToSheet(
  month: string,
  context?: ShopifySyncContext,
): Promise<{ rowsWritten: number; replacedRows: number }> {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Vui lòng chọn tháng hợp lệ.");
  }

  if (isSyncInProgress) {
    throw new Error(
      "Một tiến trình đồng bộ khác đang chạy trên tab RAW sàn. Vui lòng đợi tiến trình hoàn tất trước khi chạy tiếp.",
    );
  }

  isSyncInProgress = true;
  try {
    const getDriveAccessFn =
      context?.getGoogleDriveAccess || getGoogleDriveAccess;
    const googleRequestFn = context?.googleRequest || googleRequest;
    const shopifyFetchFn = context?.shopifyFetch || fetch;
    const nowIso = context?.now ? context.now() : new Date().toISOString();

    // 1. Pre-flight Google Sheet first before any Shopify API calls
    const { accessToken } = await withGoogleAccess(
      async (token) => {
        await preflightGoogleSheet(token, googleRequestFn);
        return { accessToken: token };
      },
      { getGoogleDriveAccess: getDriveAccessFn },
    );

    // 2. Fetch month transactions from Shopify
    const transactions = await fetchMonthTransactions(month, shopifyFetchFn);
    if (!transactions.length) {
      throw new Error(
        `Shopify không trả giao dịch nào cho tháng ${month}; sheet chưa thay đổi.`,
      );
    }

    // 3. Fetch payouts and orders (with 250 batching & throttled retry)
    const [payouts, orders] = await Promise.all([
      fetchPayouts(month, transactions, shopifyFetchFn),
      fetchOrders(transactions, shopifyFetchFn),
    ]);

    const payoutIds = [
      ...new Set(
        transactions.map((row) => stringValue(row.payout_id)).filter(Boolean),
      ),
    ];

    // 4. Read existing sheet rows for payout date range caching
    const sheetRange = `'${SHEET_NAME}'`;
    const encodedReadRange = encodeURIComponent(`${sheetRange}!A1:Y`);
    const readResponse = await googleRequestFn(
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

    const payoutCache = context?.bypassPayoutCache
      ? new Map<string, string>()
      : extractPayoutDateRangeCache(existingRows, payouts, transactions);

    // 5. Fetch transactions only for uncached payouts
    const uncachedPayoutIds = payoutIds.filter((id) => !payoutCache.has(id));
    const uncachedPayoutTransactions = await mapConcurrent(
      uncachedPayoutIds,
      4,
      async (payoutId) =>
        fetchCollection(
          `shopify_payments/balance/transactions.json?payout_id=${encodeURIComponent(payoutId)}&limit=${PAGE_SIZE}`,
          "transactions",
          shopifyFetchFn,
        ),
    );

    const dateRangesByPayout = new Map<string, string>();
    for (let i = 0; i < uncachedPayoutIds.length; i += 1) {
      const payoutId = uncachedPayoutIds[i];
      const days = new Set<string>();
      for (const raw of uncachedPayoutTransactions[i]) {
        if (
          stringValue(raw.type).toLowerCase() === "payout" ||
          typeof raw.processed_at !== "string"
        ) {
          continue;
        }
        days.add(formatDateInVietnam(raw.processed_at));
      }
      dateRangesByPayout.set(payoutId, transactionDateRange(days));
    }

    for (const [payoutId, cachedRange] of payoutCache.entries()) {
      dateRangesByPayout.set(payoutId, cachedRange);
    }

    // 6. Build sheet rows
    const rows = buildRows(transactions, payouts, orders, "");
    for (let index = 0; index < transactions.length; index += 1) {
      const payoutId = stringValue(transactions[index].payout_id);
      rows[index][1] = payoutId ? (dateRangesByPayout.get(payoutId) ?? "") : "";
      rows[index][24] = formatDateTimeInVietnam(nowIso);
    }

    // 7. Write to Google Sheet (re-reads fresh sheet rows right before write to avoid overwriting concurrent edits, backfilling column B across all rows for synced payouts)
    const result = await writeMonth(month, rows, {
      accessToken,
      payoutDateRanges: dateRangesByPayout,
      googleRequestFn,
      getGoogleDriveAccessFn: getDriveAccessFn,
    });

    return { rowsWritten: rows.length, replacedRows: result.replacedRows };
  } finally {
    isSyncInProgress = false;
  }
}
