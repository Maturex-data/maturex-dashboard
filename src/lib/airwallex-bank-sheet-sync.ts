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

type RecordValue = Record<string, unknown>;
type Cell = string | number;
type BankRow = { id: string; values: Cell[] };
type DateWindow = { from: Date; to: Date };

function record(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as RecordValue)
    : {};
}

function string(value: unknown): string {
  return value === null || value === undefined ? "" : String(value);
}

function finiteNumber(value: unknown, field: string): number {
  if (value === null || value === undefined || value === "") {
    throw new Error(`Airwallex trả thiếu ${field}.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed))
    throw new Error(`Airwallex trả ${field} không hợp lệ.`);
  return parsed;
}

function monthWindow(month: string): DateWindow {
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

function windowFor(selection: string): DateWindow {
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

function vietnamDate(value: string): string {
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

function amountKey(value: unknown): string {
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(4) : "";
}

function historyKey(source: unknown, type: unknown, amount: unknown): string {
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

async function airwallexGet(
  token: string,
  path: string,
  params: Record<string, string> = {},
): Promise<RecordValue> {
  const url = new URL(`${AIRWALLEX_API}${path}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);
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
    await new Promise((resolve) => setTimeout(resolve, 1_000 * 2 ** attempt));
  }
  throw new Error(`Airwallex ${path} failed after retries.`);
}

async function numberedPages(
  token: string,
  path: string,
  params: Record<string, string>,
  pageSize = "100",
): Promise<RecordValue[]> {
  const rows: RecordValue[] = [];
  for (let page = 0; page < 100; page += 1) {
    const payload = await airwallexGet(token, path, {
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

function dateWindows(range: DateWindow, days: number): DateWindow[] {
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
          const payload = await airwallexGet(
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

async function deposits(token: string, to: Date): Promise<RecordValue[]> {
  const rows: RecordValue[] = [];
  for (const period of dateWindows({ from: FIRST_DATE, to }, 30)) {
    rows.push(
      ...(await numberedPages(token, "/api/v1/deposits", {
        from_created_at: period.from.toISOString(),
        to_created_at: new Date(period.to.getTime() - 1).toISOString(),
      })),
    );
  }
  return [
    ...new Map(
      rows.map((row) => [string(row.deposit_id || row.id), row]),
    ).values(),
  ];
}

async function globalAccounts(token: string): Promise<RecordValue[]> {
  return numberedPages(token, "/api/v1/global_accounts", {}, "100");
}

export async function fetchAirwallexBankRows(
  selection: string,
): Promise<BankRow[]> {
  const range = windowFor(selection);
  if (range.from < FIRST_DATE || range.to > new Date(Date.now() + 35 * DAY)) {
    throw new Error("Khoảng đồng bộ Airwallex không hợp lệ.");
  }
  const token = await airwallexLogin();
  const [account, financial, cardTransactions, depositRows, accounts] =
    await Promise.all([
      airwallexGet(token, "/api/v1/account"),
      numberedPages(
        token,
        "/api/v1/financial_transactions",
        {
          from_created_at: FIRST_DATE.toISOString(),
          to_created_at: new Date(range.to.getTime() - 1).toISOString(),
        },
        "1000",
      ),
      numberedPages(token, "/api/v1/issuing/transactions", {
        from_created_at: FIRST_DATE.toISOString(),
        to_created_at: new Date(range.to.getTime() - 1).toISOString(),
      }),
      deposits(token, range.to),
      globalAccounts(token),
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
  const history = await historyRows(token, range, currencies);
  const historyByKey = new Map<string, RecordValue[]>();
  for (const row of history) {
    const key = historyKey(row.source, row.transaction_type, row.amount);
    historyByKey.set(key, [...(historyByKey.get(key) || []), row]);
  }
  const cardByTransaction = new Map(
    cardTransactions.map((row) => [string(row.transaction_id), row]),
  );
  const depositById = new Map(
    depositRows.map((row) => [string(row.deposit_id || row.id), row]),
  );
  const accountById = new Map(accounts.map((row) => [string(row.id), row]));
  const cardIds = [
    ...new Set(
      settled
        .filter((row) => string(row.transaction_type) === "ISSUING_CAPTURE")
        .map((row) => string(cardByTransaction.get(string(row.id))?.card_id))
        .filter(Boolean),
    ),
  ];
  const cards = new Map<string, RecordValue>();
  for (let offset = 0; offset < cardIds.length; offset += 5) {
    const batch = await Promise.all(
      cardIds.slice(offset, offset + 5).map(async (id) => ({
        id,
        data: await airwallexGet(
          token,
          `/api/v1/issuing/cards/${encodeURIComponent(id)}`,
        ),
      })),
    );
    for (const { id, data } of batch) {
      if (string(data.card_id) !== id)
        throw new Error("Airwallex Card ID không khớp.");
      cards.set(id, data);
    }
  }
  const payoutSources = [
    ...new Set(
      settled
        .filter((row) =>
          ["PAYOUT", "PAYOUT_REVERSAL"].includes(string(row.transaction_type)),
        )
        .map((row) => string(row.source_id))
        .filter(Boolean),
    ),
  ];
  const payments = new Map<string, RecordValue>();
  for (const id of payoutSources) {
    const payment = await airwallexGet(
      token,
      `/api/v1/payments/${encodeURIComponent(id)}`,
    );
    if (string(payment.payment_id) !== id)
      throw new Error("Airwallex payment ID không khớp.");
    payments.set(id, payment);
  }

  const result: BankRow[] = [];
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
    const matchingHistory = [
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
              string(candidate.account_type) === "cash" &&
              new Date(string(candidate.posted_at)) >= range.from &&
              new Date(string(candidate.posted_at)) < range.to,
          )
          .map((candidate) => [string(candidate.id), candidate]),
      ).values(),
    ];
    if (!matchingHistory.length) {
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
    const postedAt = string(historyRow.posted_at);
    const cardId = string(card?.card_id);
    if (string(transaction.transaction_type) === "ISSUING_CAPTURE" && !cardId) {
      throw new Error(`Thiếu Card ID cho Airwallex transaction ${id}.`);
    }
    const deposit = depositById.get(string(transaction.source_id));
    const globalAccount = accountById.get(string(deposit?.global_account_id));
    const transactionType = string(transaction.transaction_type);
    const isDeposit = transactionType === "DEPOSIT";
    if (isDeposit && !deposit)
      throw new Error(`Không xác minh được deposit ID cho ${id}.`);
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
      string(transaction.description || record(card?.merchant).name),
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
) {
  const range = encodeURIComponent(`'${SHEET_NAME}'!A:V`);
  const response = await sheetsRequest(
    token,
    `/values/${range}?valueRenderOption=${render}`,
  );
  return Array.isArray(response.values) ? (response.values as unknown[][]) : [];
}

function assertHeaders(rows: unknown[][]): void {
  const headers = (rows[0] || []).map(string);
  if (
    headers.length !== BANK_HEADERS.length ||
    headers.some((name, i) => name !== BANK_HEADERS[i])
  ) {
    throw new Error("RAW ngân hàng không khớp schema 22 cột A:V.");
  }
}

export async function syncAirwallexBankToSheet(selection: string): Promise<{
  fetched: number;
  added: number;
  updated: number;
  unchanged: number;
  replacedShopify: number;
}> {
  const incoming = await fetchAirwallexBankRows(selection);
  const { accessToken } = await getGoogleDriveAccess();
  const metadata = await sheetsRequest(
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
  const values = await readSheet(accessToken, "UNFORMATTED_VALUE");
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
  const formulas = await readSheet(accessToken, "FORMULA");
  if (
    replaceShopify &&
    formulas
      .slice(1)
      .some((row) => row.some((cell) => string(cell).startsWith("=")))
  ) {
    throw new Error(
      "Dữ liệu Shopify trong RAW ngân hàng có công thức; chưa thay thế.",
    );
  }
  const fresh = await readSheet(accessToken, "UNFORMATTED_VALUE");
  if (JSON.stringify(fresh) !== JSON.stringify(values)) {
    throw new Error("RAW ngân hàng vừa thay đổi; hãy đồng bộ lại.");
  }

  if (replaceShopify) {
    const rowCount = Math.max(existing.length, incoming.length);
    if (Number(grid.rowCount) < rowCount + 1) {
      throw new Error("RAW ngân hàng không đủ hàng để thay dữ liệu nguồn.");
    }
    const rows = Array.from({ length: rowCount }, (_, index) => ({
      values: (
        incoming[index]?.values || Array<Cell>(BANK_HEADERS.length).fill("")
      ).map(sheetCell),
    }));
    await sheetsRequest(accessToken, ":batchUpdate", {
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
  } else {
    const byId = new Map<string, number>();
    existing.forEach((row, index) => {
      if (string(row[16]) !== SOURCE) return;
      const id = string(row[14]);
      if (!id || byId.has(id))
        throw new Error(`ID Airwallex trùng hoặc trống ở dòng ${index + 2}.`);
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
      let changed = false;
      for (const index of sourceOwned) {
        if (string(previous[index]) === string(row.values[index])) continue;
        const column = String.fromCharCode(65 + index);
        updates.push({
          range: `'${SHEET_NAME}'!${column}${sheetRow}`,
          values: [[row.values[index]]],
        });
        changed = true;
      }
      if (changed) updated += 1;
      else unchanged += 1;
    }
    if (additions.length) {
      updates.push({
        range: `'${SHEET_NAME}'!A${lastUsedRow + 1}:V${lastUsedRow + additions.length}`,
        values: additions,
      });
    }
    for (let offset = 0; offset < updates.length; offset += 500) {
      await sheetsRequest(accessToken, "/values:batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          valueInputOption: "RAW",
          data: updates.slice(offset, offset + 500),
        }),
      });
    }
    const verified = await readSheet(accessToken, "UNFORMATTED_VALUE");
    assertHeaders(verified);
    const verifiedById = new Map<string, unknown[]>();
    for (const candidate of verified.slice(1)) {
      if (string(candidate[16]) !== SOURCE) continue;
      const id = string(candidate[14]);
      if (!id || verifiedById.has(id))
        throw new Error(`ID Airwallex trùng hoặc trống sau khi ghi: ${id}.`);
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
    return {
      fetched: incoming.length,
      added: additions.length,
      updated,
      unchanged,
      replacedShopify: 0,
    };
  }

  const verified = await readSheet(accessToken, "UNFORMATTED_VALUE");
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
