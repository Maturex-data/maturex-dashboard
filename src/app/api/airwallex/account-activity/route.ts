import {
  listAirwallexAccountActivity,
  syncAirwallexAccountActivity,
} from "@/lib/airwallex-account-activity-sync";
import { formatVietnamDateTime } from "@/lib/date-time";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const month = new URL(request.url).searchParams.get("month") || undefined;
  const rows = await listAirwallexAccountActivity(month);
  return Response.json({
    rows: rows.map((row) => {
      const rawPayload =
        row.rawPayload &&
        typeof row.rawPayload === "object" &&
        !Array.isArray(row.rawPayload)
          ? (row.rawPayload as Record<string, unknown>)
          : {};
      return {
        id: row.id,
        external_id: row.externalId,
        transaction_date: formatVietnamDateTime(row.transactionDate),
        transaction_type: row.transactionType,
        card: row.card,
        card_nick_name: row.cardNickName,
        account_number: row.accountNumber,
        nick_name: row.accountName,
        where_paid: row.wherePaid,
        credit: row.credit.toString(),
        debit: row.debit.toString(),
        currency: row.currency,
        ledger_status:
          typeof rawPayload.status === "string"
            ? rawPayload.status
            : row.ledgerStatus,
        transaction_details: row.details,
      };
    }),
  });
}

export async function POST(): Promise<Response> {
  try {
    return Response.json(await syncAirwallexAccountActivity());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Airwallex sync failed.",
      },
      { status: 500 },
    );
  }
}
