import { Prisma } from "@/generated/prisma/client";
import { isVietnamMonth, vietnamMonthRange } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const PAYMENTS_HISTORY_FROM = vietnamMonthRange("2026-01").from;

const FROM = "2026-01-01T00:00:00Z";

const QUERY = `
  query ShopifyPaymentsReport($balanceAfter: String, $payoutAfter: String, $disputeAfter: String, $orderAfter: String, $orderQuery: String!) {
    shopifyPaymentsAccount {
      balanceTransactions(first: 100, after: $balanceAfter, hideTransfers: false, query: "processed_at:>=2026-01-01") {
        nodes { id type test transactionDate amount { amount currencyCode } fee { amount currencyCode } net { amount currencyCode } sourceId sourceType sourceOrderTransactionId associatedPayout { id status } associatedOrder { id name } adjustmentReason }
        pageInfo { hasNextPage endCursor }
      }
      payouts(first: 100, after: $payoutAfter, query: "issued_at:>=2026-01-01") {
        nodes { id legacyResourceId issuedAt net { amount currencyCode } status transactionType externalTraceId summary { adjustmentsFee { amount currencyCode } adjustmentsGross { amount currencyCode } chargesFee { amount currencyCode } chargesGross { amount currencyCode } refundsFee { amount currencyCode } refundsFeeGross { amount currencyCode } reservedFundsFee { amount currencyCode } reservedFundsGross { amount currencyCode } retriedPayoutsFee { amount currencyCode } retriedPayoutsGross { amount currencyCode } } }
        pageInfo { hasNextPage endCursor }
      }
      disputes(first: 100, after: $disputeAfter, query: "initiated_at:>=2026-01-01") {
        nodes { id amount { amount currencyCode } initiatedAt status type evidenceDueBy evidenceSentOn finalizedOn reasonDetails { reason networkReasonCode } }
        pageInfo { hasNextPage endCursor }
      }
    }
    orders(first: 100, after: $orderAfter, query: $orderQuery) {
      nodes { id name refunds { id createdAt processedAt note totalRefundedSet { presentmentMoney { amount currencyCode } } transactions(first: 100) { nodes { id kind status gateway amountSet { presentmentMoney { amount currencyCode } } } } refundLineItems(first: 100) { nodes { quantity subtotalSet { presentmentMoney { amount currencyCode } } lineItem { id sku name } } } } }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

type JsonRecord = Record<string, unknown>;
type Connection = {
  nodes?: unknown[];
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};

function money(value: unknown): {
  amount: Prisma.Decimal;
  currency: string | null;
} {
  const row = (value && typeof value === "object" ? value : {}) as JsonRecord;
  return {
    amount: new Prisma.Decimal(String(row.amount ?? "0")),
    currency: typeof row.currencyCode === "string" ? row.currencyCode : null,
  };
}

function nestedMoney(value: unknown): {
  amount: Prisma.Decimal;
  currency: string | null;
} {
  const row = value && typeof value === "object" ? (value as JsonRecord) : {};
  const presentment = row.presentmentMoney ?? row.shopMoney ?? row;
  return money(presentment);
}

function text(value: unknown): string | null {
  return value === null || value === undefined || value === ""
    ? null
    : String(value);
}

function endpoint(): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(
    /^https?:\/\//,
    "",
  ).replace(/\/$/, "");
  if (!domain || !process.env.SHOPIFY_ACCESS_TOKEN)
    throw new Error("Shopify credentials are missing.");
  return `https://${domain}/admin/api/${process.env.SHOPIFY_API_VERSION || "2026-07"}/graphql.json`;
}

async function graphql(
  variables: Record<string, unknown>,
): Promise<JsonRecord> {
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!token) throw new Error("SHOPIFY_ACCESS_TOKEN must be configured.");
  const response = await fetch(endpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": token,
    },
    body: JSON.stringify({ query: QUERY, variables }),
    cache: "no-store",
  });
  const payload = (await response.json()) as JsonRecord;
  if (!response.ok || Array.isArray(payload.errors))
    throw new Error(
      `Shopify Payments API ${response.status}: ${JSON.stringify(payload.errors || [])}`,
    );
  return payload;
}

function recordData(
  recordType: string,
  raw: JsonRecord,
): Prisma.ShopifyPaymentRecordCreateManyInput {
  const amount = nestedMoney(raw.amount);
  const fee = nestedMoney(raw.fee);
  const net = nestedMoney(raw.net);
  const associatedOrder = raw.associatedOrder as JsonRecord | null;
  const payout = raw.associatedPayout as JsonRecord | null;
  return {
    externalId: `${recordType}:${String(raw.id)}`,
    recordType,
    transactionDate: text(raw.transactionDate)
      ? new Date(String(raw.transactionDate))
      : null,
    currency: amount.currency,
    grossAmount: amount.amount,
    feeAmount: fee.amount,
    netAmount: net.amount,
    payoutId: text(payout?.id),
    payoutStatus: text(payout?.status),
    sourceType: text(raw.sourceType),
    sourceOrderId: text(associatedOrder?.id),
    sourceOrderName: text(associatedOrder?.name),
    reason: text(raw.adjustmentReason),
    payload: raw as Prisma.InputJsonValue,
  };
}

export async function syncShopifyPayments(): Promise<{
  added: number;
  skipped: number;
  counts: Record<string, number>;
}> {
  const run = await prisma.shopifyPaymentSyncRun.create({
    data: { status: "RUNNING" },
  });
  try {
    const all: Prisma.ShopifyPaymentRecordCreateManyInput[] = [];
    const counts: Record<string, number> = {};
    let balanceAfter: string | null = null;
    let payoutAfter: string | null = null;
    let disputeAfter: string | null = null;
    let orderAfter: string | null = null;
    let hasMore = true;
    while (hasMore) {
      const payload = await graphql({
        balanceAfter,
        payoutAfter,
        disputeAfter,
        orderAfter,
        orderQuery: `created_at:>=${FROM}`,
      });
      const account = ((payload.data as JsonRecord).shopifyPaymentsAccount ||
        {}) as JsonRecord;
      const balance = (account.balanceTransactions || {}) as Connection;
      const payouts = (account.payouts || {}) as Connection;
      const disputes = (account.disputes || {}) as Connection;
      const orders = (payload.data as JsonRecord).orders as Connection;
      const orderNodes = (orders.nodes || []) as JsonRecord[];
      for (const raw of balance.nodes || [])
        all.push(recordData("BALANCE_TRANSACTION", raw as JsonRecord));
      for (const raw of payouts.nodes || [])
        all.push(recordData("PAYOUT", raw as JsonRecord));
      for (const raw of disputes.nodes || [])
        all.push(recordData("CHARGEBACK", raw as JsonRecord));
      for (const order of orderNodes) {
        for (const rawRefund of Array.isArray(order.refunds)
          ? order.refunds
          : [])
          all.push({
            ...recordData("REFUND", rawRefund as JsonRecord),
            externalId: `REFUND:${String((rawRefund as JsonRecord).id)}`,
            sourceOrderId: text(order.id),
            sourceOrderName: text(order.name),
          });
      }
      counts.balanceTransactions =
        (counts.balanceTransactions || 0) + (balance.nodes || []).length;
      counts.payouts = (counts.payouts || 0) + (payouts.nodes || []).length;
      counts.chargebacks =
        (counts.chargebacks || 0) + (disputes.nodes || []).length;
      counts.refunds =
        (counts.refunds || 0) +
        orderNodes.reduce(
          (total: number, order) =>
            total + ((order.refunds as unknown[]) || []).length,
          0,
        );
      balanceAfter = balance.pageInfo?.hasNextPage
        ? balance.pageInfo.endCursor || null
        : null;
      payoutAfter = payouts.pageInfo?.hasNextPage
        ? payouts.pageInfo.endCursor || null
        : null;
      disputeAfter = disputes.pageInfo?.hasNextPage
        ? disputes.pageInfo.endCursor || null
        : null;
      orderAfter = orders.pageInfo?.hasNextPage
        ? orders.pageInfo.endCursor || null
        : null;
      hasMore = Boolean(
        balanceAfter || payoutAfter || disputeAfter || orderAfter,
      );
    }
    const inserted = await prisma.shopifyPaymentRecord.createMany({
      data: all,
      skipDuplicates: true,
    });
    await prisma.shopifyPaymentSyncRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        addedCount: inserted.count,
        skippedCount: all.length - inserted.count,
      },
    });
    return {
      added: inserted.count,
      skipped: all.length - inserted.count,
      counts,
    };
  } catch (error) {
    await prisma.shopifyPaymentSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function listShopifyPayments(month?: string) {
  const range = isVietnamMonth(month)
    ? vietnamMonthRange(month)
    : { from: PAYMENTS_HISTORY_FROM, to: new Date() };
  return prisma.shopifyPaymentRecord.findMany({
    where: { transactionDate: { gte: range.from, lt: range.to } },
    orderBy: [{ transactionDate: "desc" }, { recordType: "asc" }],
  });
}
