import { syncFastwayRawCogs } from "@/lib/fl/fastway-raw-cogs";

export interface FastwayOrderItem {
  orderName?: string;
  exOrderId?: string;
  totalFee?: number;
  orderPrice?: number;
  createdAt?: string;
  status?: string;
  [key: string]: unknown;
}

export interface FastwaySyncOptions {
  fromDate?: string | Date;
  toDate?: string | Date;
}

function toIsoDate(val: string | Date, isEnd = false): string {
  if (val instanceof Date) return val.toISOString();
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    return isEnd ? `${val}T23:59:59.999Z` : `${val}T00:00:00.000Z`;
  }
  const d = new Date(val);
  return Number.isNaN(d.getTime()) ? val : d.toISOString();
}

export async function syncFastwayOrdersToCogs(
  options?: FastwaySyncOptions,
): Promise<{
  totalFetched: number;
  upserted: number;
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  missingStoreCount: number;
}> {
  const token = process.env.FASTWAY_API_TOKEN;
  if (!token) {
    throw new Error("FASTWAY_API_TOKEN is not configured.");
  }
  const baseUrl =
    process.env.FASTWAY_API_BASE_URL || "https://apis.fastway.co/api";

  const dateParams: Record<string, string> = {};
  if (options?.fromDate) {
    dateParams.createdAtFrom = toIsoDate(options.fromDate, false);
  }
  if (options?.toDate) {
    dateParams.createdAtTo = toIsoDate(options.toDate, true);
  }

  let page = 1;
  const allOrders: FastwayOrderItem[] = [];

  while (true) {
    const searchParams = new URLSearchParams({
      page: String(page),
      ...dateParams,
    });
    const res = await fetch(`${baseUrl}/orders?${searchParams.toString()}`, {
      headers: {
        Accept: "application/json",
        "x-fw-access-token": token,
      },
    });

    if (!res.ok) {
      throw new Error(`Fastway API failed with HTTP ${res.status}`);
    }

    const body = (await res.json()) as {
      data?: FastwayOrderItem[];
      total?: number;
    };
    if (!body.data || body.data.length === 0) break;
    allOrders.push(...body.data);
    if (typeof body.total === "number" && allOrders.length >= body.total) break;
    page++;
  }

  const result = await syncFastwayRawCogs(allOrders);
  return { totalFetched: allOrders.length, ...result };
}
