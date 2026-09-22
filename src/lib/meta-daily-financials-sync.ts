import { Prisma } from "@/generated/prisma/client";
import {
  formatVietnamDate,
  isVietnamMonth,
  previousVietnamMonthRange,
  vietnamMonthRange,
} from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const API_VERSION = process.env.META_API_VERSION || "v24.0";

type DateRange = { from: string; until: string };
export type MetaApiDateRange = { from: Date; to: Date };

function previousMonthRange(now = new Date()): DateRange {
  const range = previousVietnamMonthRange(now);
  return {
    from: formatVietnamDate(range.from),
    until: formatVietnamDate(new Date(range.to.getTime() - 1)),
  };
}

type JsonRecord = Record<string, unknown>;

function record(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : {};
}

function amount(value: unknown): number {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function actionValue(values: unknown, actionType: string): number {
  const list = Array.isArray(values) ? values : [];
  const item = list
    .map(record)
    .find((entry) => entry.action_type === actionType);
  return amount(item?.value);
}

function accountId(): string {
  const configured = process.env.META_AD_ACCOUNT_ID?.trim();
  if (!configured) throw new Error("META_AD_ACCOUNT_ID must be configured.");
  return configured.replace(/^act_/, "");
}

async function fetchInsights(
  account: string,
  since: string,
  until: string,
): Promise<JsonRecord[]> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("META_ACCESS_TOKEN must be configured.");
  const fields = [
    "date_start",
    "date_stop",
    "account_currency",
    "spend",
    "impressions",
    "clicks",
    "cpc",
    "cpm",
    "ctr",
    "actions",
    "action_values",
    "purchase_roas",
  ].join(",");
  let url: URL | null = new URL(
    `https://graph.facebook.com/${API_VERSION}/act_${account}/insights`,
  );
  url.searchParams.set("fields", fields);
  url.searchParams.set("time_range", JSON.stringify({ since, until }));
  url.searchParams.set("time_increment", "1");
  url.searchParams.set("limit", "500");
  url.searchParams.set("access_token", token);
  const rows: JsonRecord[] = [];
  while (url) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    const payload = record(await response.json());
    if (!response.ok) {
      throw new Error(
        `Meta API ${response.status}: ${record(payload.error).message || "Unknown error"}`,
      );
    }
    rows.push(...(Array.isArray(payload.data) ? payload.data.map(record) : []));
    url =
      typeof record(payload.paging).next === "string"
        ? new URL(String(record(payload.paging).next))
        : null;
  }
  return rows;
}

export async function fetchMetaDailyFinancialsFromApi(
  range: MetaApiDateRange,
): Promise<{ accountId: string; rows: JsonRecord[] }> {
  const until = new Date(range.to.getTime() - 1);
  return {
    accountId: accountId(),
    rows: await fetchInsights(
      accountId(),
      formatVietnamDate(range.from),
      formatVietnamDate(until),
    ),
  };
}

function toDate(value: unknown): Date {
  return new Date(`${String(value)}T00:00:00.000Z`);
}

function toInput(
  account: string,
  row: JsonRecord,
): Prisma.MetaDailyFinancialCreateManyInput {
  const purchaseCount = actionValue(row.actions, "purchase");
  const spend = amount(row.spend);
  return {
    accountId: account,
    dateStart: toDate(row.date_start),
    dateStop: toDate(row.date_stop),
    currency:
      typeof row.account_currency === "string" ? row.account_currency : null,
    spend: new Prisma.Decimal(spend),
    purchaseCount: new Prisma.Decimal(purchaseCount),
    purchaseValue: new Prisma.Decimal(
      actionValue(row.action_values, "purchase"),
    ),
    purchaseRoas: new Prisma.Decimal(
      amount(
        record(Array.isArray(row.purchase_roas) ? row.purchase_roas[0] : null)
          .value,
      ),
    ),
    costPerPurchase: new Prisma.Decimal(
      purchaseCount ? spend / purchaseCount : 0,
    ),
    impressions: BigInt(Math.trunc(amount(row.impressions))),
    clicks: BigInt(Math.trunc(amount(row.clicks))),
    cpc: new Prisma.Decimal(amount(row.cpc)),
    cpm: new Prisma.Decimal(amount(row.cpm)),
    ctr: new Prisma.Decimal(amount(row.ctr)),
    rawPayload: row as Prisma.InputJsonValue,
  };
}

export async function syncMetaDailyFinancials(
  range = previousMonthRange(),
): Promise<{
  fetched: number;
  upserted: number;
  from: string;
  until: string;
}> {
  const account = accountId();
  const rows = await fetchInsights(account, range.from, range.until);
  for (const row of rows) {
    const data = toInput(account, row);
    await prisma.metaDailyFinancial.upsert({
      where: {
        accountId_dateStart: {
          accountId: data.accountId,
          dateStart: data.dateStart,
        },
      },
      create: data,
      update: data,
    });
  }
  return {
    fetched: rows.length,
    upserted: rows.length,
    from: range.from,
    until: range.until,
  };
}

export async function listMetaDailyFinancials(month?: string) {
  const range = isVietnamMonth(month) ? vietnamMonthRange(month) : undefined;
  return prisma.metaDailyFinancial.findMany({
    where: range ? { dateStart: { gte: range.from, lt: range.to } } : undefined,
    orderBy: { dateStart: "desc" },
  });
}
