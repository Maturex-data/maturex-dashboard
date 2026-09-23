import { Prisma } from "@/generated/prisma/client";
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

  // 2. Discover available months in this active batch
  const orderMonths = await prisma.ecSheetOrder.findMany({
    where: { batchId },
    distinct: ["month"],
    select: { month: true },
  });
  const cogsMonths = await prisma.ecSheetCogs.findMany({
    where: { batchId },
    distinct: ["month"],
    select: { month: true },
  });
  const adMonths = await prisma.ecSheetAd.findMany({
    where: { batchId },
    distinct: ["month"],
    select: { month: true },
  });
  const payoutMonths = await prisma.ecSheetPayout.findMany({
    where: { batchId },
    distinct: ["monthLocal"],
    select: { monthLocal: true },
  });

  const allMonthsSet = new Set<string>([
    ...orderMonths.map((m) => m.month),
    ...cogsMonths.map((m) => m.month),
    ...adMonths.map((m) => m.month),
    ...payoutMonths.map((m) => m.monthLocal),
  ]);

  const availableMonths = [...allMonthsSet].filter(Boolean).sort().reverse();

  if (availableMonths.length === 0) {
    return emptyFallback;
  }

  // 3. Resolve selected month
  let selectedMonth = targetMonth;
  if (!selectedMonth || !allMonthsSet.has(selectedMonth)) {
    // Default to current Vietnam month if available, else latest available month
    selectedMonth = allMonthsSet.has(currentVietnamMonth)
      ? currentVietnamMonth
      : availableMonths[0];
  }

  const isProvisional = selectedMonth === currentVietnamMonth;
  const prevMonthKey = getPreviousMonthKey(selectedMonth);

  // 4. Calculate metrics for selected month & previous month
  // Orders
  const currentOrders = await prisma.ecSheetOrder.findMany({
    where: { batchId, month: selectedMonth },
    select: {
      orderName: true,
      orderDate: true,
      grossSales: true,
      correctedNet: true,
      originalTax: true,
      refundSnapshot: true,
    },
  });

  const distinctOrderNames = new Set(currentOrders.map((o) => o.orderName));
  const orderCount = distinctOrderNames.size;
  const refundCount = currentOrders.filter((o) =>
    o.refundSnapshot.gt(0),
  ).length;
  const refundIncidenceRate =
    orderCount > 0 ? Number(((refundCount / orderCount) * 100).toFixed(1)) : 0;

  let grossSalesDec = new Prisma.Decimal(0);
  let netRevenueDec = new Prisma.Decimal(0);
  let originalTaxDec = new Prisma.Decimal(0);

  for (const o of currentOrders) {
    grossSalesDec = grossSalesDec.plus(o.grossSales);
    originalTaxDec = originalTaxDec.plus(o.originalTax);
    netRevenueDec = netRevenueDec.plus(o.correctedNet.minus(o.originalTax));
  }

  const grossSales = Number(grossSalesDec.toFixed(2));
  const netRevenue = Number(netRevenueDec.toFixed(2));
  const originalTax = Number(originalTaxDec.toFixed(2));
  const aov = orderCount > 0 ? Number((netRevenue / orderCount).toFixed(2)) : 0;

  // COGS (filter out excluded cost treatment: 'Loại — chi phí bằng 0')
  const currentCogs = await prisma.ecSheetCogs.findMany({
    where: {
      batchId,
      month: selectedMonth,
      NOT: { treatment: "Loại — chi phí bằng 0" },
    },
    select: { totalCost: true },
  });

  let cogsDec = new Prisma.Decimal(0);
  for (const c of currentCogs) {
    cogsDec = cogsDec.plus(c.totalCost);
  }
  const recognizedCogs = Number(cogsDec.toFixed(2));

  // Ads spend
  const currentAds = await prisma.ecSheetAd.findMany({
    where: { batchId, month: selectedMonth },
    select: { spend: true },
  });

  let adsDec = new Prisma.Decimal(0);
  for (const a of currentAds) {
    adsDec = adsDec.plus(a.spend);
  }
  const adSpend = Number(adsDec.toFixed(2));
  const mer = adSpend > 0 ? Number((netRevenue / adSpend).toFixed(2)) : null;

  // Gross profit after COGS
  const grossProfit = Number((netRevenue - recognizedCogs).toFixed(2));
  const grossMargin =
    netRevenue > 0 ? Number(((grossProfit / netRevenue) * 100).toFixed(1)) : 0;

  // Payout fee
  const currentPayouts = await prisma.ecSheetPayout.findMany({
    where: { batchId, monthLocal: selectedMonth },
    select: { fee: true },
  });

  let payoutFeeDec = new Prisma.Decimal(0);
  for (const p of currentPayouts) {
    payoutFeeDec = payoutFeeDec.plus(p.fee);
  }
  const payoutFee = Number(payoutFeeDec.toFixed(2));

  // 5. Compare with previous month
  const prevOrders = await prisma.ecSheetOrder.findMany({
    where: { batchId, month: prevMonthKey },
    select: {
      orderName: true,
      correctedNet: true,
      originalTax: true,
    },
  });

  const prevOrderCount = new Set(prevOrders.map((o) => o.orderName)).size;
  let prevNetRevenueDec = new Prisma.Decimal(0);
  for (const o of prevOrders) {
    prevNetRevenueDec = prevNetRevenueDec.plus(
      o.correctedNet.minus(o.originalTax),
    );
  }
  const prevNetRevenue = Number(prevNetRevenueDec.toFixed(2));

  const prevCogs = await prisma.ecSheetCogs.findMany({
    where: {
      batchId,
      month: prevMonthKey,
      NOT: { treatment: "Loại — chi phí bằng 0" },
    },
    select: { totalCost: true },
  });
  let prevCogsDec = new Prisma.Decimal(0);
  for (const c of prevCogs) {
    prevCogsDec = prevCogsDec.plus(c.totalCost);
  }
  const prevCogsTotal = Number(prevCogsDec.toFixed(2));

  const prevAds = await prisma.ecSheetAd.findMany({
    where: { batchId, month: prevMonthKey },
    select: { spend: true },
  });
  let prevAdsDec = new Prisma.Decimal(0);
  for (const a of prevAds) {
    prevAdsDec = prevAdsDec.plus(a.spend);
  }
  const prevAdSpend = Number(prevAdsDec.toFixed(2));
  const prevGrossProfit = Number((prevNetRevenue - prevCogsTotal).toFixed(2));

  // 6. Build monthly trend chart series (chronological order)
  const chronologicalMonths = [...availableMonths].reverse();
  const trendSeries: DashboardSummary["trendSeries"] = [];

  for (const m of chronologicalMonths) {
    // Net revenue for month m
    const mOrders = await prisma.ecSheetOrder.findMany({
      where: { batchId, month: m },
      select: { correctedNet: true, originalTax: true },
    });
    let mRev = new Prisma.Decimal(0);
    for (const o of mOrders) {
      mRev = mRev.plus(o.correctedNet.minus(o.originalTax));
    }

    // COGS for month m
    const mCogs = await prisma.ecSheetCogs.findMany({
      where: { batchId, month: m, NOT: { treatment: "Loại — chi phí bằng 0" } },
      select: { totalCost: true },
    });
    let mCogsSum = new Prisma.Decimal(0);
    for (const c of mCogs) {
      mCogsSum = mCogsSum.plus(c.totalCost);
    }

    // Ads for month m
    const mAds = await prisma.ecSheetAd.findMany({
      where: { batchId, month: m },
      select: { spend: true },
    });
    let mAdsSum = new Prisma.Decimal(0);
    for (const a of mAds) {
      mAdsSum = mAdsSum.plus(a.spend);
    }

    const [year, monthNum] = m.split("-");
    const label = `T${Number.parseInt(monthNum, 10)}/${year.slice(2)}`;

    trendSeries.push({
      month: m,
      label,
      netRevenue: Number(mRev.toFixed(2)),
      cogs: Number(mCogsSum.toFixed(2)),
      adSpend: Number(mAdsSum.toFixed(2)),
      isProvisional: m === currentVietnamMonth,
    });
  }

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
