import { formatVietnamMonth } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import type { DashboardSummary } from "./types";

function getPreviousMonthKey(month: string): string {
  const [year, monthNum] = month.split("-").map(Number);
  const prevDate = new Date(Date.UTC(year, monthNum - 2, 1));
  return `${prevDate.getUTCFullYear()}-${String(prevDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

function calculateDiff(curr: number, prev: number): number | null {
  if (prev <= 0) return null;
  return Number((((curr - prev) / prev) * 100).toFixed(1));
}

interface OrdersMonthSummary {
  month: string;
  order_count: number;
  refund_count: number;
  gross_sales: number;
  net_revenue: number;
  original_tax: number;
}

interface CogsMonthSummary {
  month: string;
  total_cost: number;
}

interface AdsMonthSummary {
  month: string;
  spend: number;
}

interface PayoutsMonthSummary {
  month: string;
  fee: number;
}

export async function getEcDashboardSummary(
  targetMonth?: string,
): Promise<DashboardSummary> {
  const currentVietnamMonth = formatVietnamMonth(new Date());

  // 1. Get active snapshot pointer
  const activeSnapshot = await prisma.ecSheetActiveSnapshot.findUnique({
    where: { id: 1 },
    include: { activeRun: true },
  });

  const emptyFallback: DashboardSummary = {
    hasSnapshot: false,
    period: targetMonth || currentVietnamMonth,
    isProvisional: (targetMonth || currentVietnamMonth) === currentVietnamMonth,
    availableMonths: [],
    lastSyncedAt: null,
    activeRunId: null,
    ordersMetric: {
      count: 0,
      refundIncidenceRate: 0,
      refundCount: 0,
      diffPercent: null,
    },
    netRevenueMetric: {
      netRevenue: 0,
      grossSales: 0,
      originalTax: 0,
      aov: 0,
      diffPercent: null,
    },
    adSpendMetric: { spend: 0, mer: null, diffPercent: null },
    grossProfitMetric: {
      profit: 0,
      cogsTotal: 0,
      grossMargin: 0,
      diffPercent: null,
    },
    trendSeries: [],
    costMix: {
      month: targetMonth || currentVietnamMonth,
      cogs: 0,
      cogsPercent: 0,
      adSpend: 0,
      adSpendPercent: 0,
      payoutFee: 0,
      payoutFeePercent: 0,
      totalCost: 0,
      hasData: false,
    },
  };

  if (!activeSnapshot?.activeRunId) {
    return emptyFallback;
  }

  const batchId = activeSnapshot.activeRunId;

  // 2. Query all monthly aggregated metrics in 4 parallel fast SQL queries
  const [ordersSummary, cogsSummary, adsSummary, payoutsSummary] =
    await Promise.all([
      prisma.$queryRaw<OrdersMonthSummary[]>`
        SELECT
          month,
          COUNT(DISTINCT order_name)::int as order_count,
          COUNT(CASE WHEN refund_snapshot > 0 THEN 1 END)::int as refund_count,
          COALESCE(SUM(gross_sales), 0)::numeric as gross_sales,
          COALESCE(SUM(corrected_net - original_tax), 0)::numeric as net_revenue,
          COALESCE(SUM(original_tax), 0)::numeric as original_tax
        FROM ec_sheet_orders
        WHERE batch_id = ${batchId}
        GROUP BY month
      `,
      prisma.$queryRaw<CogsMonthSummary[]>`
        SELECT
          month,
          COALESCE(SUM(total_cost), 0)::numeric as total_cost
        FROM ec_sheet_cogs
        WHERE batch_id = ${batchId}
          AND treatment != 'Loại — chi phí bằng 0'
        GROUP BY month
      `,
      prisma.$queryRaw<AdsMonthSummary[]>`
        SELECT
          month,
          COALESCE(SUM(spend), 0)::numeric as spend
        FROM ec_sheet_ads
        WHERE batch_id = ${batchId}
        GROUP BY month
      `,
      prisma.$queryRaw<PayoutsMonthSummary[]>`
        SELECT
          month_local as month,
          COALESCE(SUM(fee), 0)::numeric as fee
        FROM ec_sheet_payouts
        WHERE batch_id = ${batchId}
        GROUP BY month_local
      `,
    ]);

  // 3. Discover all available months from the summaries
  const allMonthsSet = new Set<string>();
  for (const o of ordersSummary) allMonthsSet.add(o.month);
  for (const c of cogsSummary) allMonthsSet.add(c.month);
  for (const a of adsSummary) allMonthsSet.add(a.month);
  for (const p of payoutsSummary) allMonthsSet.add(p.month);

  const availableMonths = [...allMonthsSet].filter(Boolean).sort().reverse();

  if (availableMonths.length === 0) {
    return emptyFallback;
  }

  // 4. Resolve selected month
  let selectedMonth = targetMonth;
  if (!selectedMonth || !allMonthsSet.has(selectedMonth)) {
    selectedMonth = allMonthsSet.has(currentVietnamMonth)
      ? currentVietnamMonth
      : availableMonths[0];
  }

  const isProvisional = selectedMonth === currentVietnamMonth;
  const prevMonthKey = getPreviousMonthKey(selectedMonth);

  // 5. Index metrics by month for fast O(1) in-memory lookup
  const ordersByMonth = new Map(ordersSummary.map((o) => [o.month, o]));
  const cogsByMonth = new Map(
    cogsSummary.map((c) => [c.month, Number(c.total_cost)]),
  );
  const adsByMonth = new Map(adsSummary.map((a) => [a.month, Number(a.spend)]));
  const payoutsByMonth = new Map(
    payoutsSummary.map((p) => [p.month, Number(p.fee)]),
  );

  // Current month stats
  const currOrder = ordersByMonth.get(selectedMonth);
  const orderCount = currOrder?.order_count ?? 0;
  const refundCount = currOrder?.refund_count ?? 0;
  const refundIncidenceRate =
    orderCount > 0 ? Number(((refundCount / orderCount) * 100).toFixed(1)) : 0;

  const grossSales = Number(currOrder?.gross_sales ?? 0);
  const netRevenue = Number(currOrder?.net_revenue ?? 0);
  const originalTax = Number(currOrder?.original_tax ?? 0);
  const aov = orderCount > 0 ? Number((netRevenue / orderCount).toFixed(2)) : 0;

  const recognizedCogs = cogsByMonth.get(selectedMonth) ?? 0;
  const adSpend = adsByMonth.get(selectedMonth) ?? 0;
  const mer = adSpend > 0 ? Number((netRevenue / adSpend).toFixed(2)) : null;

  const grossProfit = Number((netRevenue - recognizedCogs).toFixed(2));
  const grossMargin =
    netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(1)) : 0;

  const payoutFee = payoutsByMonth.get(selectedMonth) ?? 0;

  // Previous month stats
  const prevOrder = ordersByMonth.get(prevMonthKey);
  const prevOrderCount = prevOrder?.order_count ?? 0;
  const prevNetRevenue = Number(prevOrder?.net_revenue ?? 0);
  const prevCogsTotal = cogsByMonth.get(prevMonthKey) ?? 0;
  const prevAdSpend = adsByMonth.get(prevMonthKey) ?? 0;
  const prevGrossProfit = Number((prevNetRevenue - prevCogsTotal).toFixed(2));

  // 6. Build monthly trend chart series (chronological order)
  const chronologicalMonths = [...availableMonths].reverse();
  const trendSeries: DashboardSummary["trendSeries"] = chronologicalMonths.map(
    (m) => {
      const ord = ordersByMonth.get(m);
      const [year, monthNum] = m.split("-");
      const label = `T${Number.parseInt(monthNum, 10)}/${year.slice(2)}`;

      return {
        month: m,
        label,
        netRevenue: Number(ord?.net_revenue ?? 0),
        cogs: cogsByMonth.get(m) ?? 0,
        adSpend: adsByMonth.get(m) ?? 0,
        isProvisional: m === currentVietnamMonth,
      };
    },
  );

  // 7. Cost mix for selected month
  const totalVariableCost = recognizedCogs + adSpend + payoutFee;
  const costMix = {
    month: selectedMonth,
    cogs: recognizedCogs,
    cogsPercent:
      totalVariableCost > 0
        ? Number(((recognizedCogs / totalVariableCost) * 100).toFixed(1))
        : 0,
    adSpend,
    adSpendPercent:
      totalVariableCost > 0
        ? Number(((adSpend / totalVariableCost) * 100).toFixed(1))
        : 0,
    payoutFee,
    payoutFeePercent:
      totalVariableCost > 0
        ? Number(((payoutFee / totalVariableCost) * 100).toFixed(1))
        : 0,
    totalCost: Number(totalVariableCost.toFixed(2)),
    hasData: totalVariableCost > 0,
  };

  return {
    hasSnapshot: true,
    period: selectedMonth,
    isProvisional,
    availableMonths,
    lastSyncedAt:
      activeSnapshot.activeRun?.completedAt || activeSnapshot.updatedAt,
    activeRunId: batchId,
    ordersMetric: {
      count: orderCount,
      refundIncidenceRate,
      refundCount,
      diffPercent: calculateDiff(orderCount, prevOrderCount),
    },
    netRevenueMetric: {
      netRevenue,
      grossSales,
      originalTax,
      aov,
      diffPercent: calculateDiff(netRevenue, prevNetRevenue),
    },
    adSpendMetric: {
      spend: adSpend,
      mer,
      diffPercent: calculateDiff(adSpend, prevAdSpend),
    },
    grossProfitMetric: {
      profit: grossProfit,
      cogsTotal: recognizedCogs,
      grossMargin,
      diffPercent: calculateDiff(grossProfit, prevGrossProfit),
    },
    trendSeries,
    costMix,
  };
}
