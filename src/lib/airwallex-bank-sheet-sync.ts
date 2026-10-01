import { getGoogleDriveAccess } from "@/lib/ec-drive";

const AIRWALLEX_API =
  process.env.AIRWALLEX_ENV === "sandbox"
    ? "https://api.sandbox.airwallex.com"
    : "https://api.airwallex.com";
const SPREADSHEET_ID =
  process.env.EC_RAW_BANK_SPREADSHEET_ID ||
  "1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU";
const SHEET_NAME = "RAW ngân hàng";
const SOURCE = "/api/v1/financial_transactions";
const SHOPIFY_SOURCE = "Shopify Payments API";
const FIRST_DATE = new Date("2026-01-01T00:00:00+07:00");
const DAY = 86_400_000;

export const BANK_HEADERS = [
  "Ngày ghi sổ",
  "Giờ/múi giờ",
  "Pháp nhân",
  "Tài khoản/thẻ",
  "Card ID",
  "Tiền tệ",
  "Thu",
  "Chi",
  "Tồn",
  "Dự án",
  "Store",
  "Loại giao dịch",
  "Mã chuyển nội bộ",
  "Mã payout/deposit",
  "Mã giao dịch",
  "Diễn giải",
  "Nguồn file",
  "Dòng nguồn",
  "Đối soát",
  "Ghi chú",
  "Số thẻ/tài khoản",
  "Tên thẻ",
] as const;

export type RecordValue = Record<string, unknown>;
export type Cell = string | number;
export type BankRow = { id: string; values: Cell[] };
export type DateWindow = { from: Date; to: Date };

export function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

export function string(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

export function extractMerchantName(merchant: unknown): string {
  if (!merchant) return "";
  if (typeof merchant === "object" && merchant !== null) {
    return string((merchant as Record<string, unknown>).name);
  }
  if (typeof merchant === "string") {
    try {
      const parsed = JSON.parse(merchant);
      if (parsed && typeof parsed === "object" && parsed !== null) {
        return string((parsed as Record<string, unknown>).name);
      }
    } catch {
      return merchant;
    }
  }
  return "";
}

export function finiteNumber(value: unknown, field: string): number {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Airwallex trả thiếu ${field}.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`Airwallex trả ${field} không hợp lệ.`);
  return parsed;
}

export function monthWindow(month: string): DateWindow {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    throw new Error("Tháng đồng bộ không hợp lệ.");
  }
  const [year, number] = month.split("-").map(Number);
  const nextYear = number === 12 ? year + 1 : year;
  const nextMonth = number === 12 ? 1 : number + 1;
  return {
    from: new Date(`${month}-01T00:00:00+07:00`),
    to: new Date(
      `${nextYear}-${String(nextMonth).padStart(2, "0")}-01T00:00:00+07:00`,
    ),
  };
}

export function windowFor(selection: string): DateWindow {
  if (selection !== "all") return monthWindow(selection);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return {
    from: FIRST_DATE,
    to: monthWindow(`${parts.year}-${parts.month}`).to,
  };
}

export function vietnamDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new Error("Airwallex posted_at không hợp lệ.");
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function amountKey(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : "";
}

export function historyKey(
  source: unknown,
  type: unknown,
  amount: unknown,
): string {
  return JSON.stringify([string(source), string(type), amountKey(amount)]);
}

async function airwallexLogin(): Promise<string> {
  const apiKey = process.env.AIRWALLEX_API_KEY;
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const accountId = process.env.AIRWALLEX_ACCOUNT_ID;
  if (!apiKey || !clientId || !accountId) {
    throw new Error("Thiếu cấu hình kết nối Airwallex.");
  }
  const response = await fetch(`${AIRWALLEX_API}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-client-id": clientId,
      "x-login-as": accountId,
    },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
  const payload = record(await response.json());
  if (!response.ok || !payload.token) {
    throw new Error(`Airwallex authentication failed (${response.status}).`);
  }
  return string(payload.token);
}

export async function airwallexGet(
  token: string,
  path: string,
  params: Record<string, string> = {},
): Promise<RecordValue> {
  const url = new URL(`${AIRWALLEX_API}${path}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
  const baseDelay = process.env.AIRWALLEX_RETRY_BASE_MS
    ? Number(process.env.AIRWALLEX_RETRY_BASE_MS)
    : 1_000;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60_000),
      cache: "no-store",
    });
    const payload = record(await response.json());
    if (response.ok) return payload;
    if (![429, 500, 502, 503, 504].includes(response.status) || attempt === 4) {
      throw new Error(`Airwallex ${path} failed (${response.status}).`);
    }
    await new Promise((resolve) =>
      setTimeout(resolve, baseDelay * 2 ** attempt),
    );
  }
  throw new Error(`Airwallex ${path} failed after retries.`);
}

async function numberedPages(
  token: string,
  path: string,
  params: Record<string, string>,
  pageSize = "100",
  getter = airwallexGet,
): Promise<RecordValue[]> {
  const rows: RecordValue[] = [];
  for (let page = 0; page < 100; page += 1) {
    const payload = await getter(token, path, {
      ...params,
      page_num: String(page),
      page_size: pageSize,
    });
    rows.push(
      ...(Array.isArray(payload.items) ? payload.items.map(record) : []),
    );
    if (!payload.has_more) return rows;
  }
  throw new Error(`Airwallex ${path}: vượt giới hạn phân trang.`);
}

export function dateWindows(range: DateWindow, days: number): DateWindow[] {
  const windows: DateWindow[] = [];
  for (
    let start = range.from.getTime();
    start < range.to.getTime();
    start += days * DAY
  ) {
    windows.push({
      from: new Date(start),
      to: new Date(Math.min(start + days * DAY, range.to.getTime())),
    });
  }
  return windows;
}

async function historyRows(
  token: string,
  range: DateWindow,
  currencies: string[],
  getter = airwallexGet,
): Promise<RecordValue[]> {
  const tasks = currencies.flatMap((currency) =>
    dateWindows(range, 7).map((period) => ({ currency, period })),
  );
  const rows: RecordValue[] = [];
  for (let offset = 0; offset < tasks.length; offset += 3) {
    const batch = await Promise.all(
      tasks.slice(offset, offset + 3).map(async ({ currency, period }) => {
        const pageRows: RecordValue[] = [];
        let cursor = "";
        for (let page = 0; page < 100; page += 1) {
          const params: Record<string, string> = {
            account_type: "cash",
            currency,
            from_post_at: period.from.toISOString(),
            to_post_at: new Date(period.to.getTime() - 1).toISOString(),
            page_size: "100",
          };
          if (cursor) params.page = cursor;
          const payload = await getter(
            token,
            "/api/v1/balances/history",
            params,
          );
          pageRows.push(
            ...(Array.isArray(payload.items) ? payload.items.map(record) : []),
          );
          const next = string(payload.page_after);
          if (!next) return pageRows;
          if (next === cursor)
            throw new Error("Airwallex balance history cursor không tiến.");
          cursor = next;
        }
        throw new Error("Airwallex balance history vượt giới hạn phân trang.");
      }),
    );
    rows.push(...batch.flat());
  }
  const byId = new Map(rows.map((row) => [string(row.id), row]));
  if (byId.size !== rows.length)
    throw new Error("Airwallex balance history trả ID trùng.");
  return rows;
}

export async function deposits(
  token: string,
  toOrRange: Date | DateWindow,
  fetchPages = numberedPages,
): Promise<RecordValue[]> {
  const window: DateWindow =
    toOrRange instanceof Date ? { from: FIRST_DATE, to: toOrRange } : toOrRange;
  const windows = dateWindows(window, 30);
  const rows: RecordValue[] = [];
  for (let offset = 0; offset < windows.length; offset += 3) {
    const batch = await Promise.all(
      windows.slice(offset, offset + 3).map((period) =>
        fetchPages(token, "/api/v1/deposits", {
          from_created_at: period.from.toISOString(),
          to_created_at: new Date(period.to.getTime() - 1).toISOString(),
        }),
      ),
    );
    rows.push(...batch.flat());
  }
  return [
    ...new Map(
      rows.map((row) => [string(row.deposit_id || row.id), row]),
    ).values(),
  ];
}

export type AirwallexApiContext = {
  login?: () => Promise<string>;
  get?: (
    token: string,
    path: string,
    params?: Record<string, string>,
  ) => Promise<RecordValue>;
  numberedPages?: (
    token: string,
    path: string,
    params: Record<string, string>,
    pageSize?: string,
  ) => Promise<RecordValue[]>;
  historyRows?: (
    token: string,
    range: DateWindow,
    currencies: string[],
  ) => Promise<RecordValue[]>;
  deposits?: (
    token: string,
    toOrRange: Date | DateWindow,
  ) => Promise<RecordValue[]>;
  globalAccounts?: (token: string) => Promise<RecordValue[]>;
};

export async function fetchAirwallexBankRows(
  selection: string,
  context: AirwallexApiContext = {},
): Promise<BankRow[]> {
  const range = windowFor(selection);
  if (range.from < FIRST_DATE || range.to > new Date(Date.now() + 35 * DAY)) {
    throw new Error("Khoảng đồng bộ Airwallex không hợp lệ.");
  }

  const loginFn = context.login || airwallexLogin;
  const getFn = context.get || airwallexGet;
  const pagesFn =
    context.numberedPages ||
    ((token, path, params, pageSize) =>
      numberedPages(token, path, params, pageSize, getFn));
  const historyFn =
    context.historyRows || ((token, r, c) => historyRows(token, r, c, getFn));
  const depositsFn =
    context.deposits ||
    ((token, toOrRange) => deposits(token, toOrRange, pagesFn));
  const globalAccountsFn =
    context.globalAccounts ||
    ((token) => pagesFn(token, "/api/v1/global_accounts", {}, "100"));

  const token = await loginFn();

  // 1. Initial query: account verification, financial transactions, issuing transactions
  // Financial transactions must start from FIRST_DATE to avoid missing transactions created in previous months but posted in this period.
  const [account, financial, cardTransactions] = await Promise.all([
    getFn(token, "/api/v1/account"),
    pagesFn(
      token,
      "/api/v1/financial_transactions",
      {
        from_created_at: FIRST_DATE.toISOString(),
        to_created_at: new Date(range.to.getTime() - 1).toISOString(),
      },
      "1000",
    ),
    pagesFn(token, "/api/v1/issuing/transactions", {
      from_created_at: FIRST_DATE.toISOString(),
      to_created_at: new Date(range.to.getTime() - 1).toISOString(),
    }),
  ]);

  if (string(account.id) !== process.env.AIRWALLEX_ACCOUNT_ID) {
    throw new Error("Airwallex account ID không khớp cấu hình.");
  }
  const legalName = string(
    record(record(account.account_details).business_details).business_name,
  );
  if (!legalName) throw new Error("Airwallex không trả tên pháp nhân.");

  const settled = financial.filter(
    (row) => string(row.status).toUpperCase() === "SETTLED",
  );
  const financialById = new Map(settled.map((row) => [string(row.id), row]));
  if (financialById.size !== settled.length || settled.some((row) => !row.id)) {
    throw new Error("Airwallex financial transactions có ID trùng hoặc trống.");
  }

  const currencies = [
    ...new Set(settled.map((row) => string(row.currency))),
  ].filter(Boolean);

  // 2. Fetch balance history for the target range + forward buffer
  // A transaction settled near month boundary (e.g. 30/09) can have its balance history posted in the next month (e.g. 01/10).
  // Querying with a 7-day buffer allows discovering posted_at in the next month and safely deferring it.
  const historyRange: DateWindow =
    selection === "all"
      ? range
      : {
          from: range.from,
          to: new Date(range.to.getTime() + 7 * DAY),
        };
  const history = await historyFn(token, historyRange, currencies);
  const historyByKey = new Map<string, RecordValue[]>();
  for (const row of history) {
    const key = historyKey(row.source, row.transaction_type, row.amount);
    historyByKey.set(key, [...(historyByKey.get(key) || []), row]);
  }

  const cardByTransaction = new Map(
    cardTransactions.map((row) => [string(row.transaction_id), row]),
  );

  // 3. Match transactions with balance history and filter to selected period BEFORE enrichment
  type MatchedTransaction = {
    transaction: RecordValue;
    historyRow: RecordValue;
    card?: RecordValue;
    id: string;
    postedAt: string;
  };

  const matched: MatchedTransaction[] = [];
  const usedHistoryIds = new Set<string>();

  for (const transaction of settled) {
    const id = string(transaction.id);
    const card = cardByTransaction.get(id);
    const sourceIds = [
      card?.retrieval_ref,
      transaction.id,
      transaction.source_id,
    ]
      .map(string)
      .filter(Boolean);

    const allCandidates = [
      ...new Map(
        sourceIds
          .flatMap(
            (sourceId) =>
              historyByKey.get(
                historyKey(
                  sourceId,
                  transaction.transaction_type,
                  transaction.net,
                ),
              ) || [],
          )
          .filter(
            (candidate) =>
              string(candidate.currency) === string(transaction.currency) &&
              string(candidate.account_type) === "cash",
          )
          .map((candidate) => [string(candidate.id), candidate]),
      ).values(),
    ];

    const matchingHistory = allCandidates.filter((candidate) => {
      const postedAt = new Date(string(candidate.posted_at));
      return postedAt >= range.from && postedAt < range.to;
    });

    if (!matchingHistory.length) {
      // 1. Chỉ bỏ qua khi tìm thấy ứng viên balance history ngoài kỳ (ví dụ: settled 30/09 nhưng posted 01/10 thuộc tháng sau)
      if (
        allCandidates.some((c) => {
          const postedAt = new Date(string(c.posted_at));
          return postedAt >= range.to || postedAt < range.from;
        })
      ) {
        continue;
      }

      // 2. Giao dịch settled ngoài kỳ báo cáo (các tháng trước từ 01/01)
      const settledAt = new Date(string(transaction.settled_at));
      if (settledAt < range.from || settledAt >= range.to) continue;

      throw new Error(
        `Không ghép được balance history cho financial transaction ${id}.`,
      );
    }
    if (matchingHistory.length !== 1) {
      throw new Error(
        `Balance history không duy nhất cho financial transaction ${id}.`,
      );
    }

    const historyRow = matchingHistory[0];
    const historyId = string(historyRow.id);
    if (usedHistoryIds.has(historyId)) {
      throw new Error(
        `Balance history ID ${historyId} được ghép cho nhiều financial transactions.`,
      );
    }
    usedHistoryIds.add(historyId);

    const cardId = string(card?.card_id);
    if (string(transaction.transaction_type) === "ISSUING_CAPTURE" && !cardId) {
      throw new Error(`Thiếu Card ID cho Airwallex transaction ${id}.`);
    }

    matched.push({
      transaction,
      historyRow,
      card,
      id,
      postedAt: string(historyRow.posted_at),
    });
  }

  // 4. Enrich ONLY for matched transactions that will be output
  // Deduplicate Card IDs
  const neededCardIds = [
    ...new Set(matched.map((m) => string(m.card?.card_id)).filter(Boolean)),
  ];
  const cards = new Map<string, RecordValue>();
  for (let offset = 0; offset < neededCardIds.length; offset += 5) {
    const batch = await Promise.all(
      neededCardIds.slice(offset, offset + 5).map(async (id) => ({
        id,
        data: await getFn(
          token,
          `/api/v1/issuing/cards/${encodeURIComponent(id)}`,
        ),
      })),
    );
    for (const { id, data } of batch) {
      if (string(data.card_id) !== id) {
        throw new Error("Airwallex Card ID không khớp.");
      }
      cards.set(id, data);
    }
  }

  // Deduplicate Payout IDs
  const neededPayoutIds = [
    ...new Set(
      matched
        .filter((m) =>
          ["PAYOUT", "PAYOUT_REVERSAL"].includes(
            string(m.transaction.transaction_type),
          ),
        )
        .map((m) => string(m.transaction.source_id))
        .filter(Boolean),
    ),
  ];
  const payments = new Map<string, RecordValue>();
  for (const id of neededPayoutIds) {
    const payment = await getFn(
      token,
      `/api/v1/payments/${encodeURIComponent(id)}`,
    );
    if (string(payment.payment_id) !== id) {
      throw new Error("Airwallex payment ID không khớp.");
    }
    payments.set(id, payment);
  }

  // Deposits & Global Accounts enrichment: only if needed by filtered transactions
  const depositTransactions = matched.filter((m) => {
    const tType = string(m.transaction.transaction_type);
    return tType === "DEPOSIT" || tType === "DC_CREDIT";
  });

  let depositById = new Map<string, RecordValue>();
  let accountById = new Map<string, RecordValue>();

  if (depositTransactions.length > 0) {
    let depositRange: DateWindow;
    if (selection === "all") {
      depositRange = { from: FIRST_DATE, to: range.to };
    } else {
      const timestamps = depositTransactions
        .map((m) =>
          new Date(
            string(m.transaction.created_at || m.transaction.settled_at),
          ).getTime(),
        )
        .filter((t) => !Number.isNaN(t));
      const earliest = timestamps.length
        ? Math.min(...timestamps)
        : range.from.getTime();
      const latest = timestamps.length
        ? Math.max(...timestamps)
        : range.to.getTime();
      depositRange = {
        from: new Date(Math.max(FIRST_DATE.getTime(), earliest - 7 * DAY)),
        to: new Date(latest + 7 * DAY),
      };
    }

    const depositRows = await depositsFn(token, depositRange);
    depositById = new Map(
      depositRows.map((row) => [string(row.deposit_id || row.id), row]),
    );

    const neededGlobalAccountIds = [
      ...new Set(
        matched
          .map(
            (m) =>
              depositById.get(string(m.transaction.source_id))
                ?.global_account_id,
          )
          .map(string)
          .filter(Boolean),
      ),
    ];

    if (neededGlobalAccountIds.length > 0) {
      const accounts = await globalAccountsFn(token);
      accountById = new Map(accounts.map((row) => [string(row.id), row]));
    }
  }

  // 5. Construct final 22-column rows
  const result: BankRow[] = [];
  for (const m of matched) {
    const { transaction, historyRow, card, id, postedAt } = m;
    const cardId = string(card?.card_id);
    const deposit = depositById.get(string(transaction.source_id));
    const globalAccount = accountById.get(string(deposit?.global_account_id));
    const transactionType = string(transaction.transaction_type);
    const isDeposit = transactionType === "DEPOSIT";
    if (isDeposit && !deposit) {
      throw new Error(`Không xác minh được deposit ID cho ${id}.`);
    }
    const isPayout = ["PAYOUT", "PAYOUT_REVERSAL"].includes(transactionType);
    if (isPayout && !payments.has(string(transaction.source_id))) {
      throw new Error(`Không xác minh được payout ID cho ${id}.`);
    }

    const net = finiteNumber(transaction.net, "financial_transactions.net");
    const balance = finiteNumber(
      historyRow.balance,
      "balances/history.balance",
    );

    const values: Cell[] = [
      vietnamDate(postedAt),
      postedAt,
      legalName,
      cardId ? "Card" : "Tài khoản",
      cardId,
      string(transaction.currency),
      net > 0 ? net : "",
      net < 0 ? Math.abs(net) : "",
      balance,
      "",
      "",
      transactionType,
      "",
      isDeposit || isPayout ? string(transaction.source_id) : "",
      id,
      string(transaction.description || extractMerchantName(card?.merchant)),
      SOURCE,
      "",
      "Khớp financial transaction với balance history",
      "Ngày/giờ posted và ví từ balance history; dự án/store/chuyển nội bộ chưa có mapping xác minh.",
      cardId
        ? string(card?.masked_card_number)
        : string(globalAccount?.account_number),
      cardId ? string(cards.get(cardId)?.nick_name || card?.card_nickname) : "",
    ];
    result.push({ id, values });
  }

  const ids = result.map((row) => row.id);
  if (new Set(ids).size !== ids.length) {
    throw new Error(
      "Nhiều dòng balance history cùng ghép vào một financial transaction.",
    );
  }
  return result;
}

function sheetCell(value: Cell): {
  userEnteredValue?: { numberValue?: number; stringValue?: string };
} {
  if (value === "") return {};
  return {
    userEnteredValue:
      typeof value === "number"
        ? { numberValue: value }
        : { stringValue: value },
  };
}

async function sheetsRequest(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<RecordValue> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw new Error(`Google Sheets API failed (${response.status}).`);
  return record(await response.json());
}

async function readSheet(
  token: string,
  render: "UNFORMATTED_VALUE" | "FORMULA",
  requestFn = sheetsRequest,
) {
  const range = encodeURIComponent(`'${SHEET_NAME}'!A:V`);
  const response = await requestFn(
    token,
    `/values/${range}?valueRenderOption=${render}`,
  );
  return Array.isArray(response.values) ? (response.values as unknown[][]) : [];
}

export function assertHeaders(rows: unknown[][]): void {
  const headers = (rows[0] || []).map(string);
  if (
    headers.length !== BANK_HEADERS.length ||
    headers.some((name, i) => name !== BANK_HEADERS[i])
  ) {
    throw new Error("RAW ngân hàng không khớp schema 22 cột A:V.");
  }
}

export type SheetsApiContext = {
  getGoogleDriveAccess?: () => Promise<{ accessToken: string }>;
  sheetsRequest?: (
    token: string,
    path: string,
    init?: RequestInit,
  ) => Promise<RecordValue>;
  readSheet?: (
    token: string,
    render: "UNFORMATTED_VALUE" | "FORMULA",
  ) => Promise<unknown[][]>;
};

export async function syncAirwallexBankToSheet(
  selection: string,
  options: {
    airwallexContext?: AirwallexApiContext;
    sheetsContext?: SheetsApiContext;
  } = {},
): Promise<{
  fetched: number;
  added: number;
  updated: number;
  unchanged: number;
  replacedShopify: number;
}> {
  const incoming = await fetchAirwallexBankRows(
    selection,
    options.airwallexContext,
  );

  const getDriveAccessFn =
    options.sheetsContext?.getGoogleDriveAccess || getGoogleDriveAccess;
  const sheetsRequestFn = options.sheetsContext?.sheetsRequest || sheetsRequest;
  const readSheetFn =
    options.sheetsContext?.readSheet ||
    ((token, render) => readSheet(token, render, sheetsRequestFn));

  const { accessToken } = await getDriveAccessFn();
  const metadata = await sheetsRequestFn(
    accessToken,
    "?fields=sheets(properties(sheetId,title,gridProperties(rowCount,columnCount)))",
  );
  const sheets = Array.isArray(metadata.sheets) ? metadata.sheets : [];
  const target = sheets
    .map((sheet) => record(record(sheet).properties))
    .find((properties) => properties.title === SHEET_NAME);
  if (!target) throw new Error(`Không tìm thấy tab ${SHEET_NAME}.`);
  const grid = record(target.gridProperties);
  if (Number(grid.columnCount) < BANK_HEADERS.length) {
    throw new Error("RAW ngân hàng có ít hơn 22 cột.");
  }

  const values = await readSheetFn(accessToken, "UNFORMATTED_VALUE");
  assertHeaders(values);
  const existing = values.slice(1);
  const lastUsedRow = existing.reduce(
    (last, row, index) =>
      row.some((value) => string(value)) ? index + 2 : last,
    1,
  );
  const sourceCounts = new Map<string, number>();
  for (const row of existing) {
    if (!row.some((value) => string(value))) continue;
    const source = string(row[16]);
    sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
  }
  const shopifyOnly =
    sourceCounts.size === 1 && sourceCounts.has(SHOPIFY_SOURCE);
  const shopifyRemnants =
    sourceCounts.size === 1 &&
    sourceCounts.has("") &&
    existing.every(
      (row) =>
        row.slice(0, 18).every((value) => !string(value)) &&
        string(row[18]) === "Chưa đối chiếu với sao kê ngân hàng" &&
        ["pending", "scheduled", "in_transit", "paid"].includes(
          string(row[19]),
        ) &&
        row.slice(20).every((value) => !string(value)),
    );
  const replaceShopify = shopifyOnly || shopifyRemnants;
  if (replaceShopify && selection !== "all") {
    throw new Error(
      "Lần chuyển nguồn đầu tiên cần đồng bộ tất cả tháng từ Airwallex.",
    );
  }
  if (sourceCounts.has(SHOPIFY_SOURCE) && !shopifyOnly) {
    throw new Error(
      "RAW ngân hàng có cả Shopify và nguồn khác; cần đối chiếu trước khi chuyển nguồn.",
    );
  }
  if (
    !shopifyRemnants &&
    [...sourceCounts.keys()].some(
      (source) => source !== SOURCE && source !== SHOPIFY_SOURCE,
    )
  ) {
    throw new Error("RAW ngân hàng có nguồn chưa được xác minh; chưa ghi đè.");
  }

  // Only read in FORMULA mode if replaceShopify is actually true
  if (replaceShopify) {
    const formulas = await readSheetFn(accessToken, "FORMULA");
    if (
      formulas
        .slice(1)
        .some((row) => row.some((cell) => string(cell).startsWith("=")))
    ) {
      throw new Error(
        "Dữ liệu Shopify trong RAW ngân hàng có công thức; chưa thay thế.",
      );
    }
  }

  if (replaceShopify) {
    const fresh = await readSheetFn(accessToken, "UNFORMATTED_VALUE");
    if (JSON.stringify(fresh) !== JSON.stringify(values)) {
      throw new Error("RAW ngân hàng vừa thay đổi; hãy đồng bộ lại.");
    }
    const rowCount = Math.max(existing.length, incoming.length);
    if (Number(grid.rowCount) < rowCount + 1) {
      throw new Error("RAW ngân hàng không đủ hàng để thay dữ liệu nguồn.");
    }
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      values: (
        incoming[index]?.values || Array<Cell>(BANK_HEADERS.length).fill("")
      ).map(sheetCell),
    }));
    await sheetsRequestFn(accessToken, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            updateCells: {
              range: {
                sheetId: Number(target.sheetId),
                startRowIndex: 1,
                endRowIndex: rowCount + 1,
                startColumnIndex: 0,
                endColumnIndex: BANK_HEADERS.length,
              },
              rows,
              fields: "userEnteredValue",
            },
          },
        ],
      }),
    });

    const verified = await readSheetFn(accessToken, "UNFORMATTED_VALUE");
    assertHeaders(verified);
    const imported = verified
      .slice(1)
      .filter((row) => string(row[16]) === SOURCE);
    if (
      imported.length !== incoming.length ||
      verified.slice(1).some((row) => string(row[16]) === SHOPIFY_SOURCE)
    ) {
      throw new Error("Đã thay nguồn nhưng số dòng xác minh không khớp.");
    }
    if (
      new Set(imported.map((row) => string(row[14]))).size !== imported.length
    ) {
      throw new Error("Đã thay nguồn nhưng ID Airwallex bị trùng.");
    }
    const importedById = new Map(imported.map((row) => [string(row[14]), row]));
    for (const row of incoming) {
      const actual = importedById.get(row.id);
      if (
        !actual ||
        row.values.some(
          (expected, index) => string(actual[index]) !== string(expected),
        )
      ) {
        throw new Error(
          `Đã thay nguồn nhưng dữ liệu Airwallex ID ${row.id} không khớp.`,
        );
      }
    }
    return {
      fetched: incoming.length,
      added: incoming.length,
      updated: 0,
      unchanged: 0,
      replacedShopify: existing.length,
    };
  }

  // Standard sync: preserve J, K, M, R, T by updating only owned column ranges (A:I, L, N:Q, S, U:V)
  const byId = new Map<string, number>();
  existing.forEach((row, index) => {
    if (string(row[16]) !== SOURCE) return;
    const id = string(row[14]);
    if (!id || byId.has(id)) {
      throw new Error(`ID Airwallex trùng hoặc trống ở dòng ${index + 2}.`);
    }
    byId.set(id, index + 2);
  });

  const updates: Array<{ range: string; values: Cell[][] }> = [];
  const additions: Cell[][] = [];
  let updated = 0;
  let unchanged = 0;
  const sourceOwned = [
    0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 13, 14, 15, 16, 18, 20, 21,
  ];

  for (const row of incoming) {
    const sheetRow = byId.get(row.id);
    if (!sheetRow) {
      additions.push(row.values);
      continue;
    }
    const previous = existing[sheetRow - 2];
    let rowChanged = false;

    // Group 1: A:I (0..8)
    if (
      [0, 1, 2, 3, 4, 5, 6, 7, 8].some(
        (i) => string(previous[i]) !== string(row.values[i]),
      )
    ) {
      updates.push({
        range: `'${SHEET_NAME}'!A${sheetRow}:I${sheetRow}`,
        values: [row.values.slice(0, 9)],
      });
      rowChanged = true;
    }

    // Group 2: L (11)
    if (string(previous[11]) !== string(row.values[11])) {
      updates.push({
        range: `'${SHEET_NAME}'!L${sheetRow}`,
        values: [[row.values[11]]],
      });
      rowChanged = true;
    }

    // Group 3: N:Q (13..16)
    if (
      [13, 14, 15, 16].some(
        (i) => string(previous[i]) !== string(row.values[i]),
      )
    ) {
      updates.push({
        range: `'${SHEET_NAME}'!N${sheetRow}:Q${sheetRow}`,
        values: [row.values.slice(13, 17)],
      });
      rowChanged = true;
    }

    // Group 4: S (18)
    if (string(previous[18]) !== string(row.values[18])) {
      updates.push({
        range: `'${SHEET_NAME}'!S${sheetRow}`,
        values: [[row.values[18]]],
      });
      rowChanged = true;
    }

    // Group 5: U:V (20..21)
    if ([20, 21].some((i) => string(previous[i]) !== string(row.values[i]))) {
      updates.push({
        range: `'${SHEET_NAME}'!U${sheetRow}:V${sheetRow}`,
        values: [row.values.slice(20, 22)],
      });
      rowChanged = true;
    }

    if (rowChanged) updated += 1;
    else unchanged += 1;
  }

  if (additions.length) {
    const neededRows = lastUsedRow + additions.length;
    if (Number(grid.rowCount) < neededRows) {
      throw new Error("RAW ngân hàng không đủ hàng để thêm dữ liệu mới.");
    }
    updates.push({
      range: `'${SHEET_NAME}'!A${lastUsedRow + 1}:V${neededRows}`,
      values: additions,
    });
  }

  // Only perform network write and post-verification if there are changes
  if (updates.length > 0) {
    const fresh = await readSheetFn(accessToken, "UNFORMATTED_VALUE");
    if (JSON.stringify(fresh) !== JSON.stringify(values)) {
      throw new Error("RAW ngân hàng vừa thay đổi; hãy đồng bộ lại.");
    }

    for (let offset = 0; offset < updates.length; offset += 500) {
      await sheetsRequestFn(accessToken, "/values:batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: updates.slice(offset, offset + 500),
        }),
      });
    }

    const verified = await readSheetFn(accessToken, "UNFORMATTED_VALUE");
    assertHeaders(verified);
    const verifiedById = new Map<string, unknown[]>();
    for (const candidate of verified.slice(1)) {
      if (string(candidate[16]) !== SOURCE) continue;
      const id = string(candidate[14]);
      if (!id || verifiedById.has(id)) {
        throw new Error(`ID Airwallex trùng hoặc trống sau khi ghi: ${id}.`);
      }
      verifiedById.set(id, candidate);
    }
    for (const row of incoming) {
      const candidate = verifiedById.get(row.id);
      if (
        !candidate ||
        sourceOwned.some(
          (index) => string(candidate[index]) !== string(row.values[index]),
        )
      ) {
        throw new Error(
          `Đã ghi nhưng không xác minh được Airwallex ID ${row.id}.`,
        );
      }
    }
  }

  return {
    fetched: incoming.length,
    added: additions.length,
    updated,
    unchanged,
    replacedShopify: 0,
  };
}
