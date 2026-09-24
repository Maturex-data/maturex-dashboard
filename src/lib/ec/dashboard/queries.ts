import type { Prisma } from "@/generated/prisma/client";
import { formatVietnamDate, formatVietnamMonth } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import type { SheetRowPaginatedResponse, SheetRowQueryParams } from "./types";

const ORDERS_SORT_WHITELIST = new Set([
  "orderDate",
  "orderName",
  "grossSales",
  "discounts",
  "shippingCharged",
  "originalTax",
  "correctedNet",
  "refundSnapshot",
  "beforeRefund",
  "sourceRow",
]);

const COGS_SORT_WHITELIST = new Set([
  "costDate",
  "supplier",
  "totalCost",
  "estimatedCost",
  "referenceOrderId",
  "supplierOrderId",
  "rowKey",
  "treatment",
  "sourceRow",
]);

const ADS_SORT_WHITELIST = new Set([
  "date",
  "accountId",
  "spend",
  "campaignName",
  "externalId",
  "sourceRow",
]);

const PAYOUTS_SORT_WHITELIST = new Set([
  "processedUtc",
  "type",
  "gross",
  "fee",
  "net",
  "balanceTransactionId",
  "payoutId",
  "sourceRow",
]);

export async function getSheetRows(
  params: SheetRowQueryParams,
): Promise<SheetRowPaginatedResponse<unknown>> {
  const activeSnapshot = await prisma.ecSheetActiveSnapshot.findUnique({
    where: { id: 1 },
    include: { activeRun: true },
  });

  const page = Math.max(1, params.page || 1);
  const limit = Math.min(200, Math.max(10, params.limit || 50));
  const skip = (page - 1) * limit;

  if (!activeSnapshot?.activeRunId) {
    return {
      rows: [],
      total: 0,
      page,
      limit,
      totalPages: 0,
      availableMonths: [],
      month: params.month || formatVietnamMonth(new Date()),
    };
  }

  const batchId = activeSnapshot.activeRunId;

  // Extract available months directly from snapshot sheetStats if available (0ms DB query)
  const stats = activeSnapshot.activeRun?.sheetStats as Record<
    string,
    { monthCounts?: Record<string, number> }
  > | null;

  const sheetKeyMap: Record<string, string> = {
    orders: "Orders",
    cogs: "COGS",
    ads: "Ads",
    payouts: "Payouts",
  };
  const statsKey = sheetKeyMap[params.sheet];
  const cachedMonths = stats?.[statsKey]?.monthCounts
    ? Object.keys(stats[statsKey].monthCounts).sort().reverse()
    : null;

  let availableMonths: string[] = cachedMonths || [];

  if (availableMonths.length === 0) {
    if (params.sheet === "orders") {
      const list = await prisma.ecSheetOrder.findMany({
        where: { batchId },
        distinct: ["month"],
        select: { month: true },
      });
      availableMonths = list
        .map((m) => m.month)
        .sort()
        .reverse();
    } else if (params.sheet === "cogs") {
      const list = await prisma.ecSheetCogs.findMany({
        where: { batchId },
        distinct: ["month"],
        select: { month: true },
      });
      availableMonths = list
        .map((m) => m.month)
        .sort()
        .reverse();
    } else if (params.sheet === "ads") {
      const list = await prisma.ecSheetAd.findMany({
        where: { batchId },
        distinct: ["month"],
        select: { month: true },
      });
      availableMonths = list
        .map((m) => m.month)
        .sort()
        .reverse();
    } else {
      const list = await prisma.ecSheetPayout.findMany({
        where: { batchId },
        distinct: ["monthLocal"],
        select: { monthLocal: true },
      });
      availableMonths = list
        .map((m) => m.monthLocal)
        .sort()
        .reverse();
    }
  }

  const selectedMonth =
    params.month && availableMonths.includes(params.month)
      ? params.month
      : availableMonths[0] || formatVietnamMonth(new Date());

  const search = params.search?.trim();

  // 1. ORDERS
  if (params.sheet === "orders") {
    const where: Prisma.EcSheetOrderWhereInput = {
      batchId,
      ...(selectedMonth && selectedMonth !== "all"
        ? { month: selectedMonth }
        : {}),
      ...(search
        ? {
            OR: [
              { orderName: { contains: search, mode: "insensitive" } },
              { itemName: { contains: search, mode: "insensitive" } },
              { source: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortField =
      params.sort && ORDERS_SORT_WHITELIST.has(params.sort)
        ? params.sort
        : "orderDate";
    const sortDir = params.dir === "asc" ? "asc" : "desc";

    const [total, rows] = await Promise.all([
      prisma.ecSheetOrder.count({ where }),
      prisma.ecSheetOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortField]: sortDir }, { sourceRow: "asc" }],
      }),
    ]);

    return {
      rows: rows.map((r) => ({
        ...r,
        orderDate: formatVietnamDate(r.orderDate),
        grossSales: Number(r.grossSales),
        discounts: Number(r.discounts),
        shippingCharged: Number(r.shippingCharged),
        originalTax: Number(r.originalTax),
        correctedNet: Number(r.correctedNet),
        refundSnapshot: Number(r.refundSnapshot),
        beforeRefund: Number(r.beforeRefund),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      availableMonths,
      month: selectedMonth,
    };
  }

  // 2. COGS
  if (params.sheet === "cogs") {
    const where: Prisma.EcSheetCogsWhereInput = {
      batchId,
      ...(selectedMonth && selectedMonth !== "all"
        ? { month: selectedMonth }
        : {}),
      ...(params.supplier ? { supplier: params.supplier } : {}),
      ...(search
        ? {
            OR: [
              { referenceOrderId: { contains: search, mode: "insensitive" } },
              { supplierOrderId: { contains: search, mode: "insensitive" } },
              { itemsName: { contains: search, mode: "insensitive" } },
              { rowKey: { contains: search, mode: "insensitive" } },
              { supplier: { contains: search, mode: "insensitive" } },
              { treatment: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortField =
      params.sort && COGS_SORT_WHITELIST.has(params.sort)
        ? params.sort
        : "costDate";
    const sortDir = params.dir === "asc" ? "asc" : "desc";

    // Run count, data rows, and distinct suppliers in parallel
    const [total, rows, suppliersList] = await Promise.all([
      prisma.ecSheetCogs.count({ where }),
      prisma.ecSheetCogs.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortField]: sortDir }, { sourceRow: "asc" }],
      }),
      prisma.ecSheetCogs.findMany({
        where: { batchId },
        distinct: ["supplier"],
        select: { supplier: true },
      }),
    ]);

    const suppliers = suppliersList.map((s) => s.supplier);

    return {
      rows: rows.map((r) => ({
        ...r,
        costDate: formatVietnamDate(r.costDate),
        totalCost: Number(r.totalCost),
        estimatedCost: Number(r.estimatedCost),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      availableMonths,
      month: selectedMonth,
      filterOptions: { suppliers },
    };
  }

  // 3. ADS
  if (params.sheet === "ads") {
    const where: Prisma.EcSheetAdWhereInput = {
      batchId,
      ...(selectedMonth && selectedMonth !== "all"
        ? { month: selectedMonth }
        : {}),
      ...(params.account ? { accountId: params.account } : {}),
      ...(search
        ? {
            OR: [
              { accountId: { contains: search, mode: "insensitive" } },
              { externalId: { contains: search, mode: "insensitive" } },
              { campaignName: { contains: search, mode: "insensitive" } },
              { campaignId: { contains: search, mode: "insensitive" } },
            ],
          }
        : {}),
    };

    const sortField =
      params.sort && ADS_SORT_WHITELIST.has(params.sort) ? params.sort : "date";
    const sortDir = params.dir === "asc" ? "asc" : "desc";

    const [total, rows, accountsList] = await Promise.all([
      prisma.ecSheetAd.count({ where }),
      prisma.ecSheetAd.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ [sortField]: sortDir }, { sourceRow: "asc" }],
      }),
      prisma.ecSheetAd.findMany({
        where: { batchId },
        distinct: ["accountId"],
        select: { accountId: true },
      }),
    ]);

    const accounts = accountsList.map((a) => a.accountId);

    return {
      rows: rows.map((r) => ({
        ...r,
        date: formatVietnamDate(r.date),
        spend: Number(r.spend),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      availableMonths,
      month: selectedMonth,
      filterOptions: { accounts },
    };
  }

  // 4. PAYOUTS
  const where: Prisma.EcSheetPayoutWhereInput = {
    batchId,
    ...(selectedMonth && selectedMonth !== "all"
      ? { monthLocal: selectedMonth }
      : {}),
    ...(params.type ? { type: params.type } : {}),
    ...(search
      ? {
          OR: [
            { balanceTransactionId: { contains: search, mode: "insensitive" } },
            { payoutId: { contains: search, mode: "insensitive" } },
            { type: { contains: search, mode: "insensitive" } },
            { orderId: { contains: search, mode: "insensitive" } },
            { sourceId: { contains: search, mode: "insensitive" } },
            { reason: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const sortField =
    params.sort && PAYOUTS_SORT_WHITELIST.has(params.sort)
      ? params.sort
      : "processedUtc";
  const sortDir = params.dir === "asc" ? "asc" : "desc";

  const [total, rows, typesList] = await Promise.all([
    prisma.ecSheetPayout.count({ where }),
    prisma.ecSheetPayout.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ [sortField]: sortDir }, { sourceRow: "asc" }],
    }),
    prisma.ecSheetPayout.findMany({
      where: { batchId },
      distinct: ["type"],
      select: { type: true },
    }),
  ]);

  const types = typesList.map((t) => t.type);

  return {
    rows: rows.map((r) => ({
      ...r,
      gross: Number(r.gross),
      fee: Number(r.fee),
      net: Number(r.net),
      processedUtc: r.processedUtc.toISOString(),
    })),
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
    availableMonths,
    month: selectedMonth,
    filterOptions: { types },
  };
}
