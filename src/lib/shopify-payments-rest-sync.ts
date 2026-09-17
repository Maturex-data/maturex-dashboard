import { Prisma } from "@/generated/prisma/client";
import { formatVietnamDate } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

const LIMIT = 250;
type JsonRecord = Record<string, unknown>;
const text = (value: unknown): string | null =>
  value === null || value === undefined || value === "" ? null : String(value);
const decimal = (value: unknown): Prisma.Decimal =>
  new Prisma.Decimal(String(value ?? "0"));

function endpoint(path: string): string {
  const domain = process.env.SHOPIFY_STORE_DOMAIN?.replace(
    /^https?:\/\//,
    "",
  ).replace(/\/$/, "");
  if (!domain || !process.env.SHOPIFY_ACCESS_TOKEN)
    throw new Error("Shopify credentials are missing.");
  return `https://${domain}/admin/api/${process.env.SHOPIFY_API_VERSION || "2026-07"}/${path}`;
}

async function getPage(
  url: string,
): Promise<{ payload: JsonRecord; next: string | null }> {
  const response = await fetch(url, {
    headers: {
      "X-Shopify-Access-Token": process.env.SHOPIFY_ACCESS_TOKEN || "",
    },
    cache: "no-store",
  });
  const payload = (await response.json()) as JsonRecord;
  if (!response.ok)
    throw new Error(`Shopify Payments REST API ${response.status}`);
  const next =
    response.headers.get("link")?.match(/<([^>]+)>;\s*rel="next"/)?.[1] || null;
  return { payload, next };
}

async function collection(
  path: string,
  key: string,
  stopBefore?: Date,
): Promise<JsonRecord[]> {
  const rows: JsonRecord[] = [];
  let url: string | null = endpoint(path);
  while (url) {
    const page = await getPage(url);
    if (Array.isArray(page.payload[key])) {
      for (const row of page.payload[key] as JsonRecord[]) {
        const dateValue = row.processed_at || row.date || row.initiated_at;
        if (
          stopBefore &&
          dateValue &&
          new Date(String(dateValue)) < stopBefore
        ) {
          return rows;
        }
        rows.push(row);
      }
    }
    url = page.next;
  }
  return rows;
}

function base(
  type: string,
  id: string,
  payload: JsonRecord,
): Prisma.ShopifyPaymentRecordCreateManyInput {
  return {
    externalId: `${type}:${id}`,
    recordType: type,
    transactionDate: text(
      payload.date ||
        payload.processed_at ||
        payload.created_at ||
        payload.initiated_at,
    )
      ? new Date(
          String(
            payload.date ||
              payload.processed_at ||
              payload.created_at ||
              payload.initiated_at,
          ),
        )
      : null,
    currency: text(payload.currency),
    grossAmount: decimal(payload.amount),
    feeAmount: decimal(payload.fee),
    netAmount: decimal(payload.net),
    payoutId: text(payload.payout_id),
    payoutStatus: text(payload.payout_status || payload.status),
    sourceType: text(payload.source_type || payload.type),
    sourceOrderId: text(payload.order_id || payload.source_order_id),
    sourceOrderName: text(payload.order_name),
    reason: text(payload.adjustment_reason || payload.reason),
    payload: payload as Prisma.InputJsonValue,
  };
}

export async function syncShopifyPaymentsRest(): Promise<{
  added: number;
  skipped: number;
  counts: Record<string, number>;
}> {
  const run = await prisma.shopifyPaymentSyncRun.create({
    data: { status: "RUNNING" },
  });
  try {
    const to = new Date();
    const from = new Date(to);
    from.setUTCMonth(from.getUTCMonth() - 1);
    const fromDate = formatVietnamDate(from);
    const toDate = formatVietnamDate(to);
    const [payouts, transactions, disputes, orders] = await Promise.all([
      collection(
        `shopify_payments/payouts.json?date_min=${fromDate}&date_max=${toDate}&limit=${LIMIT}`,
        "payouts",
      ),
      collection(
        `shopify_payments/balance/transactions.json?limit=${LIMIT}`,
        "transactions",
        from,
      ),
      collection(
        `shopify_payments/disputes.json?initiated_at=${fromDate}&limit=${LIMIT}`,
        "disputes",
      ),
      collection(
        `orders.json?status=any&created_at_min=${fromDate}T00:00:00Z&created_at_max=${toDate}T23:59:59Z&limit=${LIMIT}&fields=id,name,refunds`,
        "orders",
      ),
    ]);
    const rows = [
      ...payouts.map((row) => base("PAYOUT", String(row.id), row)),
      ...transactions.map((row) =>
        base("BALANCE_TRANSACTION", String(row.id), row),
      ),
      ...disputes.map((row) => base("CHARGEBACK", String(row.id), row)),
      ...orders.flatMap((order) =>
        (Array.isArray(order.refunds) ? order.refunds : []).map((refund) => ({
          ...base(
            "REFUND",
            String((refund as JsonRecord).id),
            refund as JsonRecord,
          ),
          sourceOrderId: text(order.id),
          sourceOrderName: text(order.name),
        })),
      ),
    ];
    const inserted = await prisma.shopifyPaymentRecord.createMany({
      data: rows,
      skipDuplicates: true,
    });
    const counts = {
      payouts: payouts.length,
      balanceTransactions: transactions.length,
      chargebacks: disputes.length,
      refunds: orders.reduce(
        (total, order) =>
          total + (Array.isArray(order.refunds) ? order.refunds.length : 0),
        0,
      ),
    };
    await prisma.shopifyPaymentSyncRun.update({
      where: { id: run.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        addedCount: inserted.count,
        skippedCount: rows.length - inserted.count,
      },
    });
    return {
      added: inserted.count,
      skipped: rows.length - inserted.count,
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
