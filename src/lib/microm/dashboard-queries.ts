import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatVietnamPeriod } from "./date-utils";

export interface MicromMonthOption {
  value: string; // e.g. "2026-09"
  label: string; // e.g. "Tháng 09/2026"
  orderCount: number;
}

export interface MicromKpiMetrics {
  eligibleOrdersCount: number;
  totalOrdersCount: number;
  eligibleRevenueEur: number;
  eligibleRevenueUsd: number;
  grossOrdersEur: number;
  grossOrdersUsd: number;
  fxRate: number;
  metaSpendUsd: number;
  metaImpressions: number;
  metaClicks: number;
  metaPurchases: number;
  eligibleCogsUsd: number;
  totalCogsSourceUsd: number;
  estimatedContributionUsd: number;
  hasShopifyData: boolean;
  hasCogsData: boolean;
  hasAdsData: boolean;
}

export interface MicromMonthlyTrend {
  month: string;
  revenueUsd: number;
  revenueEur: number;
  cogsUsd: number;
  adsUsd: number;
  contributionUsd: number;
  ordersCount: number;
}

export interface MicromDashboardSummary {
  hasSnapshot: boolean;
  activeRunId?: string;
  activeRunStartedAt?: string;
  activeRunCompletedAt?: string;
  lastCheckedAt?: string;
  spreadsheetId?: string;
  isProviderReconciled?: boolean;
  isManualEditAcknowledged?: boolean;
  selectedMonth: string;
  availableMonths: MicromMonthOption[];
  kpi: MicromKpiMetrics;
  monthlyTrends: MicromMonthlyTrend[];
}

export async function getMicromDashboardSummary(
  monthParam?: string,
): Promise<MicromDashboardSummary> {
  const activeSnapshot = await prisma.micromSheetActiveSnapshot.findUnique({
    where: { id: 1 },
    include: { activeRun: true },
  });

  if (!activeSnapshot || !activeSnapshot.activeRun) {
    const currentMonth = formatVietnamPeriod(new Date());
    return {
      hasSnapshot: false,
      selectedMonth: currentMonth,
      availableMonths: [],
      kpi: {
        eligibleOrdersCount: 0,
        totalOrdersCount: 0,
        eligibleRevenueEur: 0,
        eligibleRevenueUsd: 0,
        grossOrdersEur: 0,
        grossOrdersUsd: 0,
        fxRate: 1.15,
        metaSpendUsd: 0,
        metaImpressions: 0,
        metaClicks: 0,
        metaPurchases: 0,
        eligibleCogsUsd: 0,
        totalCogsSourceUsd: 0,
        estimatedContributionUsd: 0,
        hasShopifyData: false,
        hasCogsData: false,
        hasAdsData: false,
      },
      monthlyTrends: [],
    };
  }

  const batchId = activeSnapshot.activeRun.id;

  // 1. Get distinct months across tabs
  const orderPeriods = await prisma.micromSheetOrder.findMany({
    where: { batchId },
    distinct: ["period"],
    select: { period: true },
  });

  const adsPeriods = await prisma.micromSheetAd.findMany({
    where: { batchId },
    distinct: ["period"],
    select: { period: true },
  });

  const cogsPeriods = await prisma.micromSheetCogs.findMany({
    where: { batchId },
    distinct: ["period"],
    select: { period: true },
  });

  const allMonthsSet = new Set<string>();
  for (const p of orderPeriods) if (p.period) allMonthsSet.add(p.period);
  for (const p of adsPeriods) if (p.period) allMonthsSet.add(p.period);
  for (const p of cogsPeriods) if (p.period) allMonthsSet.add(p.period);

  const sortedMonths = Array.from(allMonthsSet).sort((a, b) =>
    b.localeCompare(a),
  );
  const availableMonths: MicromMonthOption[] = sortedMonths.map((m) => {
    const [year, month] = m.split("-");
    return {
      value: m,
      label: `Tháng ${month}/${year}`,
      orderCount: 0,
    };
  });

  // Determine active month
  const currentMonth = formatVietnamPeriod(new Date());
  let selectedMonth = monthParam || "";
  if (!selectedMonth || !allMonthsSet.has(selectedMonth)) {
    if (allMonthsSet.has(currentMonth)) {
      selectedMonth = currentMonth;
    } else if (sortedMonths.length > 0) {
      selectedMonth = sortedMonths[0];
    } else {
      selectedMonth = currentMonth;
    }
  }

  // 2. Query KPIs for selectedMonth
  const orders = await prisma.micromSheetOrder.findMany({
    where: { batchId, period: selectedMonth },
  });

  const ads = await prisma.micromSheetAd.findMany({
    where: { batchId, period: selectedMonth },
  });

  const cogs = await prisma.micromSheetCogs.findMany({
    where: { batchId, period: selectedMonth },
  });

  // Calculate Orders KPIs
  let eligibleOrdersCount = 0;
  let eligibleRevenueEur = 0;
  let eligibleRevenueUsd = 0;
  let grossOrdersEur = 0;
  let grossOrdersUsd = 0;

  for (const o of orders) {
    const elEur = Number(o.eligibleRevenueEur);
    const elUsd = Number(o.eligibleRevenueUsdCalc);
    if (elEur > 0) {
      eligibleOrdersCount++;
    }
    eligibleRevenueEur += elEur;
    eligibleRevenueUsd += elUsd;
    grossOrdersEur += Number(o.grossOrder);
    grossOrdersUsd += Number(o.grossOrderUsdCalc);
  }

  // Calculate Meta Ads KPIs
  let metaSpendUsd = 0;
  let metaImpressions = 0;
  let metaClicks = 0;
  let metaPurchases = 0;

  for (const a of ads) {
    metaSpendUsd += Number(a.spendUsd);
    metaImpressions += a.impressions;
    metaClicks += a.clicks;
    metaPurchases += a.purchases;
  }

  // Calculate COGS KPIs
  let eligibleCogsUsd = 0;
  let totalCogsSourceUsd = 0;

  for (const c of cogs) {
    eligibleCogsUsd += Number(c.eligibleCogsUsd);
    totalCogsSourceUsd += Number(c.cogsSourceUsd);
  }

  const estimatedContributionUsd =
    eligibleRevenueUsd - eligibleCogsUsd - metaSpendUsd;

  // 3. Query Monthly Trends
  const monthlyTrends: MicromMonthlyTrend[] = [];
  const trendMonths = Array.from(allMonthsSet).sort((a, b) =>
    a.localeCompare(b),
  );

  for (const m of trendMonths) {
    const mOrders = await prisma.micromSheetOrder.findMany({
      where: { batchId, period: m },
      select: {
        eligibleRevenueEur: true,
        eligibleRevenueUsdCalc: true,
      },
    });

    const mAds = await prisma.micromSheetAd.findMany({
      where: { batchId, period: m },
      select: { spendUsd: true },
    });

    const mCogs = await prisma.micromSheetCogs.findMany({
      where: { batchId, period: m },
      select: { eligibleCogsUsd: true },
    });

    let revUsd = 0;
    let revEur = 0;
    let ordCount = 0;
    for (const o of mOrders) {
      const eUsd = Number(o.eligibleRevenueUsdCalc);
      const eEur = Number(o.eligibleRevenueEur);
      revUsd += eUsd;
      revEur += eEur;
      if (eEur > 0) ordCount++;
    }

    let adsSum = 0;
    for (const a of mAds) {
      adsSum += Number(a.spendUsd);
    }

    let cogsSum = 0;
    for (const c of mCogs) {
      cogsSum += Number(c.eligibleCogsUsd);
    }

    monthlyTrends.push({
      month: m,
      revenueUsd: Number(revUsd.toFixed(2)),
      revenueEur: Number(revEur.toFixed(2)),
      cogsUsd: Number(cogsSum.toFixed(2)),
      adsUsd: Number(adsSum.toFixed(2)),
      contributionUsd: Number((revUsd - cogsSum - adsSum).toFixed(2)),
      ordersCount: ordCount,
    });
  }

  return {
    hasSnapshot: true,
    activeRunId: activeSnapshot.activeRun.id,
    activeRunStartedAt: activeSnapshot.activeRun.startedAt.toISOString(),
    activeRunCompletedAt: activeSnapshot.activeRun.completedAt?.toISOString(),
    lastCheckedAt: activeSnapshot.lastCheckedAt.toISOString(),
    spreadsheetId: activeSnapshot.activeRun.spreadsheetId,
    isProviderReconciled: activeSnapshot.activeRun.providerReconciled,
    isManualEditAcknowledged: activeSnapshot.activeRun.manualEditAcknowledged,
    selectedMonth,
    availableMonths,
    kpi: {
      eligibleOrdersCount,
      totalOrdersCount: orders.length,
      eligibleRevenueEur: Number(eligibleRevenueEur.toFixed(2)),
      eligibleRevenueUsd: Number(eligibleRevenueUsd.toFixed(2)),
      grossOrdersEur: Number(grossOrdersEur.toFixed(2)),
      grossOrdersUsd: Number(grossOrdersUsd.toFixed(2)),
      fxRate: 1.15,
      metaSpendUsd: Number(metaSpendUsd.toFixed(2)),
      metaImpressions,
      metaClicks,
      metaPurchases,
      eligibleCogsUsd: Number(eligibleCogsUsd.toFixed(2)),
      totalCogsSourceUsd: Number(totalCogsSourceUsd.toFixed(2)),
      estimatedContributionUsd: Number(estimatedContributionUsd.toFixed(2)),
      hasShopifyData: orders.length > 0,
      hasCogsData: cogs.length > 0,
      hasAdsData: ads.length > 0,
    },
    monthlyTrends,
  };
}

export interface MicromRowsQueryOptions {
  tab: "Orders" | "COGS" | "Ads" | "Shopify_Items";
  month?: string;
  search?: string;
  page?: number;
  limit?: number;
  maxLimit?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export async function getMicromTabRows(options: MicromRowsQueryOptions) {
  const activeSnapshot = await prisma.micromSheetActiveSnapshot.findUnique({
    where: { id: 1 },
  });

  if (!activeSnapshot) {
    return { rows: [], totalCount: 0, page: 1, limit: 50 };
  }

  const batchId = activeSnapshot.activeRunId;
  const page = Math.max(1, options.page || 1);
  const maxAllowedLimit = options.maxLimit || 200;
  const limit = Math.min(maxAllowedLimit, Math.max(1, options.limit || 50));
  const skip = (page - 1) * limit;
  const search = options.search?.trim();
  const sortOrder = options.sortOrder || "desc";

  switch (options.tab) {
    case "Orders": {
      const where: Prisma.MicromSheetOrderWhereInput = {
        batchId,
        ...(options.month ? { period: options.month } : {}),
        ...(search
          ? {
              OR: [
                { orderId: { contains: search, mode: "insensitive" } },
                { shopifyId: { contains: search, mode: "insensitive" } },
                { financialStatus: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const orderByField = options.sortBy || "orderDate";
      const [totalCount, rows] = await Promise.all([
        prisma.micromSheetOrder.count({ where }),
        prisma.micromSheetOrder.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [orderByField]: sortOrder },
        }),
      ]);

      return {
        rows: rows.map((r) => ({
          ...r,
          subtotal: Number(r.subtotal),
          discount: Number(r.discount),
          shipping: Number(r.shipping),
          tax: Number(r.tax),
          grossOrder: Number(r.grossOrder),
          eligibleRevenueEur: Number(r.eligibleRevenueEur),
          fxRate: Number(r.fxRate),
          eligibleRevenueUsdCalc: Number(r.eligibleRevenueUsdCalc),
          grossOrderUsdCalc: Number(r.grossOrderUsdCalc),
          orderDate: r.orderDate.toISOString().slice(0, 10),
        })),
        totalCount,
        page,
        limit,
      };
    }

    case "COGS": {
      const where: Prisma.MicromSheetCogsWhereInput = {
        batchId,
        ...(options.month ? { period: options.month } : {}),
        ...(search
          ? {
              OR: [
                { pgprintOrderId: { contains: search, mode: "insensitive" } },
                { pgcOrderId: { contains: search, mode: "insensitive" } },
                { customerOrderId: { contains: search, mode: "insensitive" } },
                { controlNote: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const orderByField = options.sortBy || "costDate";
      const [totalCount, rows] = await Promise.all([
        prisma.micromSheetCogs.count({ where }),
        prisma.micromSheetCogs.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [orderByField]: sortOrder },
        }),
      ]);

      return {
        rows: rows.map((r) => ({
          ...r,
          production: Number(r.production),
          shipping: Number(r.shipping),
          cogsSourceUsd: Number(r.cogsSourceUsd),
          eligibleCogsUsd: Number(r.eligibleCogsUsd),
          costDate: r.costDate.toISOString().slice(0, 10),
        })),
        totalCount,
        page,
        limit,
      };
    }

    case "Ads": {
      const where: Prisma.MicromSheetAdWhereInput = {
        batchId,
        ...(options.month ? { period: options.month } : {}),
        ...(search
          ? {
              OR: [
                { accountName: { contains: search, mode: "insensitive" } },
                { accountId: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const orderByField = options.sortBy || "date";
      const [totalCount, rows] = await Promise.all([
        prisma.micromSheetAd.count({ where }),
        prisma.micromSheetAd.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [orderByField]: sortOrder },
        }),
      ]);

      return {
        rows: rows.map((r) => ({
          ...r,
          spendUsd: Number(r.spendUsd),
          date: r.date.toISOString().slice(0, 10),
        })),
        totalCount,
        page,
        limit,
      };
    }

    case "Shopify_Items": {
      // If month is filtered, find matching orderIds for fallback and filter by period
      let matchingOrderIds: string[] = [];
      if (options.month) {
        const matchingOrders = await prisma.micromSheetOrder.findMany({
          where: { batchId, period: options.month },
          select: { orderId: true },
        });
        matchingOrderIds = matchingOrders.map((o) => o.orderId);
      }

      const where: Prisma.MicromSheetShopifyItemWhereInput = {
        batchId,
        ...(options.month
          ? {
              OR: [
                { period: options.month },
                ...(matchingOrderIds.length > 0
                  ? [{ orderId: { in: matchingOrderIds } }]
                  : []),
              ],
            }
          : {}),
        ...(search
          ? {
              OR: [
                { orderId: { contains: search, mode: "insensitive" } },
                { lineItemId: { contains: search, mode: "insensitive" } },
                { productName: { contains: search, mode: "insensitive" } },
                { sku: { contains: search, mode: "insensitive" } },
              ],
            }
          : {}),
      };

      const orderByField = options.sortBy || "sourceRow";
      const effectiveSortOrder =
        !options.sortBy && sortOrder === "desc" ? "asc" : sortOrder;

      const [totalCount, rows] = await Promise.all([
        prisma.micromSheetShopifyItem.count({ where }),
        prisma.micromSheetShopifyItem.findMany({
          where,
          skip,
          take: limit,
          orderBy: { [orderByField]: effectiveSortOrder },
        }),
      ]);

      return {
        rows: rows.map((r) => ({
          ...r,
          lineTotal: Number(r.lineTotal),
        })),
        totalCount,
        page,
        limit,
      };
    }
  }
}
