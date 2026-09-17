import { formatVietnamDateTime } from "@/lib/date-time";
import { syncShopifyPaymentsRest } from "@/lib/shopify-payments-rest-sync";
import { listShopifyPayments } from "@/lib/shopify-payments-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const month = new URL(request.url).searchParams.get("month") || undefined;
  const rows = await listShopifyPayments(month);
  const includePayload =
    new URL(request.url).searchParams.get("includePayload") === "1";
  return Response.json({
    rows: rows.map((row) => {
      const payload =
        row.payload &&
        typeof row.payload === "object" &&
        !Array.isArray(row.payload)
          ? (row.payload as Record<string, unknown>)
          : {};
      const sourceOrderName =
        row.sourceOrderName ||
        (typeof payload.source_order_name === "string"
          ? payload.source_order_name
          : typeof payload.order_name === "string"
            ? payload.order_name
            : null);
      const sourceOrderId =
        row.sourceOrderId ||
        (typeof payload.source_order_id === "string"
          ? payload.source_order_id
          : typeof payload.order_id === "string"
            ? payload.order_id
            : null);
      const payloadId =
        typeof payload.id === "string" || typeof payload.id === "number"
          ? String(payload.id)
          : null;
      const sourceId =
        typeof payload.source_id === "string" ||
        typeof payload.source_id === "number"
          ? String(payload.source_id)
          : null;
      const processedAt =
        typeof payload.processed_at === "string"
          ? new Date(payload.processed_at)
          : null;
      const validProcessedAt =
        processedAt && !Number.isNaN(processedAt.getTime())
          ? processedAt
          : null;

      return {
        id: row.id,
        externalId: row.externalId,
        payloadId,
        sourceId,
        recordType: row.recordType,
        transactionDate: row.transactionDate
          ? formatVietnamDateTime(row.transactionDate)
          : null,
        currency: row.currency,
        grossAmount: row.grossAmount?.toString() || null,
        feeAmount: row.feeAmount?.toString() || null,
        netAmount: row.netAmount?.toString() || null,
        payoutId: row.payoutId,
        payoutStatus: row.payoutStatus,
        sourceType: row.sourceType,
        sourceOrderId,
        sourceOrderName,
        reason: row.reason,
        sourceOrderTransactionId:
          typeof payload.source_order_transaction_id === "string" ||
          typeof payload.source_order_transaction_id === "number"
            ? String(payload.source_order_transaction_id)
            : null,
        transactionStatus:
          typeof payload.status === "string" ? payload.status : null,
        processedAtUtc: validProcessedAt?.toISOString() || null,
        processedAtGmt7: validProcessedAt
          ? formatVietnamDateTime(validProcessedAt)
          : null,
        processedAtVietnam: validProcessedAt
          ? formatVietnamDateTime(validProcessedAt)
          : null,
        source: "shopify_payments_balance_transactions",
        snapshotAt: formatVietnamDateTime(row.syncedAt),
        ...(includePayload ? { payload } : {}),
      };
    }),
  });
}

export async function POST(): Promise<Response> {
  try {
    return Response.json(await syncShopifyPaymentsRest());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Shopify Payments sync failed.",
      },
      { status: 500 },
    );
  }
}
