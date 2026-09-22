import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { formatVietnamMonth, vietnamMonthRange } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";

export const PNL_INPUT_FIELDS = [
  "subscriptionCost",
  "confirmedToolsCost",
  "vietnamToolsCost",
  "personnelCost",
  "allocatedOverheadCost",
  "welfareCost",
] as const;

export type PnlInputField = (typeof PNL_INPUT_FIELDS)[number];

export type PnlMonthlyInput = Record<PnlInputField, number> & {
  note: string | null;
};

export type PnlMonthReport = {
  month: string;
  inputs: PnlMonthlyInput;
  metrics: Record<string, number>;
};

const ZERO_INPUTS: PnlMonthlyInput = {
  subscriptionCost: 0,
  confirmedToolsCost: 0,
  vietnamToolsCost: 0,
  personnelCost: 0,
  allocatedOverheadCost: 0,
  welfareCost: 0,
  note: null,
};

function amount(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

function inputMonthDate(month: string): Date {
  return new Date(`${month}-01T00:00:00.000Z`);
}

function paymentFeeBucket(
  recordType: string,
): "charge" | "refund" | "dispute" | "other" {
  const normalized = recordType.toLowerCase();
  if (normalized === "charge") return "charge";
  if (normalized.includes("refund")) return "refund";
  if (normalized.includes("dispute") || normalized.includes("chargeback")) {
    return "dispute";
  }
  return "other";
}

type DatabaseClient = typeof prisma | Prisma.TransactionClient;

export async function getEcPnlMonth(
  month: string,
  database: DatabaseClient = prisma,
): Promise<PnlMonthReport> {
  const { from, to } = vietnamMonthRange(month);
  const [orders, cogs, ads, paymentFees, storedInputs] = await Promise.all([
    database.rawOrder.aggregate({
      where: { orderDate: { gte: from, lt: to } },
      _sum: {
        grossSales: true,
        discounts: true,
        shippingCharged: true,
        refundAmount: true,
        calcOrderNetAfterRefund: true,
        salesTax: true,
      },
    }),
    database.cogsRecord.groupBy({
      by: ["supplier"],
      where: { date: { gte: from, lt: to } },
      _sum: { totalCost: true },
    }),
    database.metaDailyFinancial.aggregate({
      where: { dateStart: { gte: from, lt: to } },
      _sum: { spend: true },
    }),
    database.shopifyPaymentRecord.groupBy({
      by: ["sourceType"],
      where: { transactionDate: { gte: from, lt: to } },
      _sum: { feeAmount: true },
    }),
    database.ecPnlMonthlyInput.findUnique({
      where: { month: inputMonthDate(month) },
    }),
  ]);

  const inputs: PnlMonthlyInput = storedInputs
    ? {
        subscriptionCost: amount(storedInputs.subscriptionCost),
        confirmedToolsCost: amount(storedInputs.confirmedToolsCost),
        vietnamToolsCost: amount(storedInputs.vietnamToolsCost),
        personnelCost: amount(storedInputs.personnelCost),
        allocatedOverheadCost: amount(storedInputs.allocatedOverheadCost),
        welfareCost: amount(storedInputs.welfareCost),
        note: storedInputs.note,
      }
    : ZERO_INPUTS;

  const cogsBySupplier = new Map(
    cogs.map((row) => [row.supplier.toLowerCase(), amount(row._sum.totalCost)]),
  );
  const cogsPgPrint = cogsBySupplier.get("pgprint") ?? 0;
  const cogsLuxuryPro = cogsBySupplier.get("luxury pro") ?? 0;
  const cogsPrintify = cogsBySupplier.get("printify") ?? 0;
  const cogsPrintful = cogsBySupplier.get("printful") ?? 0;

  const feeBuckets = { charge: 0, refund: 0, dispute: 0, other: 0 };
  for (const row of paymentFees) {
    feeBuckets[paymentFeeBucket(row.sourceType ?? "other")] += amount(
      row._sum.feeAmount,
    );
  }

  const grossSales = amount(orders._sum.grossSales);
  const discounts = amount(orders._sum.discounts);
  const shippingCharged = amount(orders._sum.shippingCharged);
  const refundSnapshot = amount(orders._sum.refundAmount);
  const correctedNetOrder = amount(orders._sum.calcOrderNetAfterRefund);
  const originalSalesTax = amount(orders._sum.salesTax);
  const netRevenue = correctedNetOrder - originalSalesTax;
  const metaAdvertising = amount(ads._sum.spend);
  const cogsTotal = cogsPgPrint + cogsLuxuryPro + cogsPrintify + cogsPrintful;
  const paymentFeesTotal =
    feeBuckets.charge +
    feeBuckets.refund +
    feeBuckets.dispute +
    feeBuckets.other;
  const preBonusVariableCost = cogsTotal + metaAdvertising + paymentFeesTotal;
  const preBonusContribution = netRevenue - preBonusVariableCost;
  const fixedCost = PNL_INPUT_FIELDS.reduce(
    (total, field) => total + inputs[field],
    0,
  );
  const preBonusMargin =
    netRevenue !== 0 ? preBonusContribution / netRevenue : 0;
  const breakEvenRevenue =
    preBonusMargin > 0 ? fixedCost / (preBonusMargin * 0.98) : 0;
  const targetRevenue = breakEvenRevenue * 4;
  const revenueAttainment = targetRevenue > 0 ? netRevenue / targetRevenue : 0;
  const salesBonusRate =
    netRevenue <= breakEvenRevenue || preBonusContribution <= 0
      ? 0
      : revenueAttainment <= 0.3
        ? 0.02
        : revenueAttainment <= 0.7
          ? 0.04
          : revenueAttainment < 1
            ? 0.06
            : 0.08;
  const salesBonus = Math.max(preBonusContribution, 0) * salesBonusRate;
  const variableCost = preBonusVariableCost + salesBonus;
  const contributionMargin = netRevenue - variableCost;
  const contributionMarginRate =
    netRevenue !== 0 ? contributionMargin / netRevenue : 0;
  const operatingProfit = contributionMargin - fixedCost;
  const provisionalTaxMemo = Math.max(operatingProfit, 0) * 0.2;
  const pmBonusBase = operatingProfit - provisionalTaxMemo;
  const pmBonusRate =
    operatingProfit <= 0 ? 0 : netRevenue >= targetRevenue ? 0.2 : 0.1;
  const pmBonus = pmBonusBase * pmBonusRate;
  const profitBeforeTax = operatingProfit - pmBonus;
  const corporateIncomeTax = Math.max(profitBeforeTax, 0) * 0.2;
  const profitAfterTax = profitBeforeTax - corporateIncomeTax;
  const safetyMarginAmount = netRevenue - breakEvenRevenue;

  return {
    month: formatVietnamMonth(from),
    inputs,
    metrics: {
      grossSales,
      discounts,
      shippingCharged,
      refundSnapshot,
      correctedNetOrder,
      originalSalesTax,
      netRevenue,
      cogsPgPrint,
      cogsLuxuryPro,
      cogsPrintify,
      cogsPrintful,
      metaAdvertising,
      paymentProcessingFees: feeBuckets.charge,
      refundProcessingFees: feeBuckets.refund,
      disputeProcessingFees: feeBuckets.dispute,
      otherPaymentFees: feeBuckets.other,
      preBonusContribution,
      salesBonus,
      salesBonusRate,
      variableCost,
      contributionMargin,
      contributionMarginRate,
      fixedCost,
      operatingProfit,
      provisionalTaxMemo,
      pmBonusBase,
      pmBonusRate,
      pmBonus,
      profitBeforeTax,
      corporateIncomeTax,
      profitAfterTax,
      netOperatingMargin: netRevenue !== 0 ? operatingProfit / netRevenue : 0,
      breakEvenRevenue,
      targetRevenue,
      revenueAttainment,
      safetyMarginAmount,
      safetyMarginRate: netRevenue !== 0 ? safetyMarginAmount / netRevenue : 0,
      subscriptionCost: inputs.subscriptionCost,
      confirmedToolsCost: inputs.confirmedToolsCost,
      vietnamToolsCost: inputs.vietnamToolsCost,
      personnelCost: inputs.personnelCost,
      allocatedOverheadCost: inputs.allocatedOverheadCost,
      welfareCost: inputs.welfareCost,
    },
  };
}

export async function saveEcPnlMonthlyInput(
  month: string,
  values: PnlMonthlyInput,
): Promise<void> {
  const data = {
    subscriptionCost: values.subscriptionCost,
    confirmedToolsCost: values.confirmedToolsCost,
    vietnamToolsCost: values.vietnamToolsCost,
    personnelCost: values.personnelCost,
    allocatedOverheadCost: values.allocatedOverheadCost,
    welfareCost: values.welfareCost,
    note: values.note,
  };
  await prisma.ecPnlMonthlyInput.upsert({
    where: { month: inputMonthDate(month) },
    create: { month: inputMonthDate(month), ...data },
    update: data,
  });
}
