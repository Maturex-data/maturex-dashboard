import { formatVietnamDate } from "@/lib/date-time";
import {
  listMetaDailyFinancials,
  syncMetaDailyFinancials,
} from "@/lib/meta-daily-financials-sync";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request): Promise<Response> {
  const month = new URL(request.url).searchParams.get("month") || undefined;
  const rows = await listMetaDailyFinancials(month);
  return Response.json({
    rows: rows.map((row) => ({
      id: row.id,
      account_id: row.accountId,
      date_start: formatVietnamDate(row.dateStart),
      date_stop: formatVietnamDate(row.dateStop),
      campaign_id: null,
      campaign_name: null,
      currency: row.currency,
      spend: row.spend.toString(),
      purchase_count: row.purchaseCount.toString(),
      purchase_value: row.purchaseValue.toString(),
      purchase_roas: row.purchaseRoas.toString(),
      cost_per_purchase: row.costPerPurchase.toString(),
      impressions: row.impressions.toString(),
      clicks: row.clicks.toString(),
      cpc: row.cpc.toString(),
      cpm: row.cpm.toString(),
      ctr: row.ctr.toString(),
    })),
  });
}

export async function POST(): Promise<Response> {
  try {
    return Response.json(await syncMetaDailyFinancials());
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Meta daily financial sync failed.",
      },
      { status: 500 },
    );
  }
}
