import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

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
    if (allOrders.length >= (body.total || 0)) break;
    page++;
  }

  let upserted = 0;
  for (const order of allOrders) {
    const rawOrderName = String(order.orderName || "").trim();
    if (!rawOrderName) continue;
    const referenceOrderId = rawOrderName.split("-")[0];
    const totalCost = Number(order.totalFee ?? order.orderPrice ?? 0);
    const date = order.createdAt ? new Date(order.createdAt) : new Date();
    const itemKey = `flowa-fastway-${order.exOrderId || rawOrderName}`;
    const status = String(order.status || "OK");
    const supplierOrderId = order.exOrderId ? String(order.exOrderId) : null;
    const payload = JSON.parse(JSON.stringify(order)) as Prisma.InputJsonValue;

    await prisma.cogsRecord.upsert({
      where: { itemKey },
      create: {
        supplier: "Fastway",
        date,
        referenceOrderId,
        supplierOrderId,
        totalCost,
        estimatedCost: 0,
        itemKey,
        mappingStatus: status,
        rawPayload: payload,
      },
      update: {
        supplier: "Fastway",
        date,
        referenceOrderId,
        supplierOrderId,
        totalCost,
        mappingStatus: status,
        rawPayload: payload,
        syncedAt: new Date(),
      },
    });
    upserted++;
  }

  return { totalFetched: allOrders.length, upserted };
}
