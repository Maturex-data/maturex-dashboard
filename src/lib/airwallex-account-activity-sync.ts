import { Prisma } from "@/generated/prisma/client";
import {
  formatVietnamDate,
  isVietnamMonth,
  previousVietnamMonthRange,
  vietnamMonthRange,
} from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const HISTORY_FROM = vietnamMonthRange("2026-01").from.toISOString();
const BASE_URL =
  process.env.AIRWALLEX_ENV === "sandbox"
    ? "https://api.sandbox.airwallex.com"
    : "https://api.airwallex.com";

type JsonRecord = Record<string, unknown>;

type DateRange = { from: string; to: string };

function previousMonthRange(now = new Date()): DateRange {
  const range = previousVietnamMonthRange(now);
  return {
    from: range.from.toISOString(),
    to: range.to.toISOString(),
  };
}

export function airwallexHistoryRange(now = new Date()): DateRange {
  return { from: HISTORY_FROM, to: now.toISOString() };
}

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
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function date(value: unknown): Date {
  const parsed = new Date(text(value));
  return Number.isNaN(parsed.getTime()) ? new Date(HISTORY_FROM) : parsed;
}

export function airwallexStatementDate(value: Date): string {
  return formatVietnamDate(value);
}

async function auth(): Promise<string> {
  const apiKey = process.env.AIRWALLEX_API_KEY;
  const clientId = process.env.AIRWALLEX_CLIENT_ID;
  const accountId = process.env.AIRWALLEX_ACCOUNT_ID;
  if (!apiKey || !clientId || !accountId) {
    throw new Error(
      "AIRWALLEX_CLIENT_ID, AIRWALLEX_API_KEY and AIRWALLEX_ACCOUNT_ID must be configured.",
    );
  }
  const response = await fetch(`${BASE_URL}/api/v1/authentication/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "x-client-id": clientId,
      "x-login-as": accountId,
    },
  });
  const payload = record(await response.json());
  if (!response.ok || !payload.token)
    throw new Error(`Airwallex authentication failed (${response.status}).`);
  return text(payload.token);
}

async function get(
  token: string,
  path: string,
  params: Record<string, string>,
): Promise<JsonRecord> {
  const url = new URL(`${BASE_URL}${path}`);
  for (const [key, value] of Object.entries(params))
    url.searchParams.set(key, value);

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(60_000),
    });
    const payload = record(await response.json());
    if (response.ok) return payload;
    if (response.status !== 429 || attempt === 4)
      throw new Error(`Airwallex ${path} failed (${response.status}).`);

    const retryAfter = Number(response.headers.get("retry-after") || 0);
    const delay = retryAfter > 0 ? retryAfter * 1_000 : 1_000 * 2 ** attempt;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  throw new Error(`Airwallex ${path} failed after retries.`);
}

async function pages(
  token: string,
  path: string,
  params: Record<string, string>,
  pageSize = "1000",
): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  for (let page = 0; ; page += 1) {
    const payload = await get(token, path, {
      ...params,
      page_num: String(page),
      page_size: pageSize,
    });
    rows.push(
      ...(Array.isArray(payload.items) ? payload.items.map(record) : []),
    );
    if (!payload.has_more) return rows;
  }
}

async function cards(token: string): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  const earliestCardDate = new Date("2018-01-01T00:00:00.000Z");
  const now = new Date();

  // Airwallex only returns cards from the last 30 days unless both creation
  // bounds are provided. Smaller windows also avoid API range limits.
  for (let start = new Date(earliestCardDate); start < now; ) {
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 89);
    if (end > now) end.setTime(now.getTime());

    rows.push(
      ...(await pages(
        token,
        "/api/v1/issuing/cards",
        {
          from_created_at: start.toISOString(),
          to_created_at: end.toISOString(),
        },
        "200",
      )),
    );

    start = new Date(end);
    start.setUTCMilliseconds(start.getUTCMilliseconds() + 1);
  }

  return rows.filter(
    (card, index, all) =>
      all.findIndex(
        (candidate) => text(candidate.card_id) === text(card.card_id),
      ) === index,
  );
}

async function cardTransactions(
  token: string,
  cardId: string,
  range: DateRange,
): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  const start = new Date(range.from);
  const end = new Date(range.to);
  while (start < end) {
    const rangeEnd = new Date(start);
    rangeEnd.setUTCDate(rangeEnd.getUTCDate() + 89);
    if (rangeEnd > end) rangeEnd.setTime(end.getTime());
    let page: string | null = null;
    do {
      const params: Record<string, string> = {
        card_id: cardId,
        from_created_at: start.toISOString(),
        to_created_at: rangeEnd.toISOString(),
        page_size: "100",
      };
      if (page) params.page = page;
      const payload = await get(
        token,
        "/api/v1/issuing/card_transactions",
        params,
      );
      rows.push(
        ...(Array.isArray(payload.items) ? payload.items.map(record) : []),
      );
      page = text(payload.page_after) || null;
    } while (page);
    start.setUTCDate(start.getUTCDate() + 90);
  }
  return rows;
}

function cardInput(
  transaction: JsonRecord,
  cardMap: Map<string, JsonRecord>,
): Prisma.AirwallexAccountActivityCreateManyInput {
  const card = cardMap.get(text(transaction.card_id));
  const merchant = record(transaction.merchant);
  const billing = record(transaction.billing_amounts);
  const direction = text(transaction.fund_direction);
  const value = amount(
    billing.total_debited ||
      billing.total_credited ||
      billing.total_authorized ||
      billing.total_pending,
  );
  const currency = text(billing.currency);
  const merchantName = text(
    merchant.name ||
      record(merchant.additional_merchant_info).merchant_brand_name,
  );
  return {
    externalId: `card:${text(transaction.id)}`,
    transactionDate: date(transaction.created_at),
    transactionType: "Card",
    card: text(transaction.masked_card_number || card?.card_number) || null,
    cardNickName: text(card?.nick_name) || null,
    accountNumber: null,
    accountName: null,
    wherePaid: merchantName || null,
    credit: new Prisma.Decimal(direction === "CREDIT" ? value : 0),
    debit: new Prisma.Decimal(direction === "DEBIT" ? value : 0),
    currency: currency || null,
    ledgerStatus:
      text(transaction.ledger_status || transaction.status) || "Posted",
    details: [
      "Card",
      [
        merchantName,
        [text(merchant.city), text(merchant.country)]
          .filter(Boolean)
          .join(", "),
      ]
        .filter(Boolean)
        .join(", "),
      text(card?.nick_name),
      text(transaction.masked_card_number || card?.card_number),
    ]
      .filter(Boolean)
      .join("\n"),
    rawPayload: transaction as Prisma.InputJsonValue,
  };
}

function financialInput(
  transaction: JsonRecord,
  accounts: Map<string, JsonRecord>,
): Prisma.AirwallexAccountActivityCreateManyInput {
  const value = amount(transaction.amount);
  const account = accounts.get(text(transaction.global_account_id));
  const accountNumber = text(account?.account_number);
  const accountName = text(account?.nick_name || account?.account_name);
  const description = text(transaction.description || transaction.source_id);
  return {
    externalId: `financial:${text(transaction.id || transaction.source_id)}`,
    transactionDate: date(transaction.settled_at || transaction.created_at),
    transactionType: text(transaction.source_type) || "Transaction",
    card: null,
    cardNickName: null,
    accountNumber: accountNumber || null,
    accountName: accountName || null,
    wherePaid: null,
    credit: new Prisma.Decimal(value >= 0 ? value : 0),
    debit: new Prisma.Decimal(value < 0 ? Math.abs(value) : 0),
    currency: text(transaction.currency) || null,
    ledgerStatus: text(transaction.ledger_status) || "Posted",
    details: [
      text(transaction.source_type),
      description,
      [accountNumber, text(transaction.source_id)].filter(Boolean).join(" | "),
    ]
      .filter(Boolean)
      .join("\n"),
    rawPayload: transaction as Prisma.InputJsonValue,
  };
}

export async function syncAirwallexAccountActivity(
  range = previousMonthRange(),
): Promise<{
  fetched: number;
  upserted: number;
  from: string;
  until: string;
}> {
  const token = await auth();
  const [financial, cardList, accountPayload] = await Promise.all([
    pages(token, "/api/v1/financial_transactions", {
      from_created_at: range.from,
      to_created_at: range.to,
    }),
    cards(token),
    get(token, "/api/v1/global_accounts", { page_size: "100" }),
  ]);
  const cardMap = new Map(cardList.map((card) => [text(card.card_id), card]));
  const accountMap = new Map(
    (Array.isArray(accountPayload.items) ? accountPayload.items : []).map(
      (item) => {
        const value = record(item);
        return [text(value.id), value] as const;
      },
    ),
  );
  const cardTransactionsByCard: JsonRecord[][] = [];
  for (const card of cardList) {
    cardTransactionsByCard.push(
      await cardTransactions(token, text(card.card_id), range),
    );
  }
  const cardRows = cardTransactionsByCard
    .flat()
    .filter(
      (row, index, all) =>
        all.findIndex((candidate) => text(candidate.id) === text(row.id)) ===
        index,
    )
    .map((row) => cardInput(row, cardMap));
  const uniqueFinancial = financial.filter(
    (row, index, all) =>
      all.findIndex((candidate) => text(candidate.id) === text(row.id)) ===
      index,
  );
  const financialRows = uniqueFinancial.map((row) =>
    financialInput(row, accountMap),
  );
  const rows = [...cardRows, ...financialRows];
  for (let index = 0; index < rows.length; index += 50) {
    const batch = rows.slice(index, index + 50);
    await Promise.all(
      batch.map((data) =>
        prisma.airwallexAccountActivity.upsert({
          where: { externalId: data.externalId },
          create: data,
          update: data,
        }),
      ),
    );
  }
  return {
    fetched: rows.length,
    upserted: rows.length,
    from: range.from,
    until: range.to,
  };
}

export async function listAirwallexAccountActivity(month?: string) {
  const range = isVietnamMonth(month) ? vietnamMonthRange(month) : undefined;
  return prisma.airwallexAccountActivity.findMany({
    where: {
      transactionType: { not: "CARD_PURCHASE" },
      ...(range ? { transactionDate: { gte: range.from, lt: range.to } } : {}),
    },
    orderBy: { transactionDate: "desc" },
  });
}
