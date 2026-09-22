import type { MonthlyInput, MonthReport, ReportRow } from "./types";

export const REPORT_ROWS: ReportRow[] = [
  { code: "I", label: "DOANH THU", source: "RAW.ORDER", kind: "section" },
  {
    code: "I.1",
    label: "Gross sales",
    metric: "grossSales",
    source: "RAW.ORDER · gross_sales",
  },
  {
    code: "I.2",
    label: "Discounts",
    metric: "discounts",
    source: "RAW.ORDER · discounts",
  },
  {
    code: "I.3",
    label: "Shipping charged",
    metric: "shippingCharged",
    source: "RAW.ORDER · shipping_charged",
  },
  {
    code: "I.4",
    label: "Refunds snapshot",
    metric: "refundSnapshot",
    source: "RAW.ORDER · refund_amount",
  },
  {
    code: "I.5",
    label: "Corrected net order",
    metric: "correctedNetOrder",
    source: "RAW.ORDER · calc_order_net_after_refund",
  },
  {
    code: "I.6",
    label: "Original sales tax",
    metric: "originalSalesTax",
    source: "RAW.ORDER · sales_tax",
  },
  {
    code: "II",
    label: "NET REVENUE",
    metric: "netRevenue",
    source: "Corrected net order − original sales tax",
    kind: "total",
  },
  {
    code: "III",
    label: "VARIABLE COST",
    metric: "variableCost",
    source: "COGS + Ads + Shopify fees + Sales bonus",
    kind: "section",
  },
  {
    code: "III.1",
    label: "COGS PGPrint",
    metric: "cogsPgPrint",
    source: "RAW.COGS · PGPrint",
  },
  {
    code: "III.2",
    label: "COGS Luxury Pro",
    metric: "cogsLuxuryPro",
    source: "RAW.COGS · Luxury Pro",
  },
  {
    code: "III.3",
    label: "COGS Printify",
    metric: "cogsPrintify",
    source: "RAW.COGS · Printify",
  },
  {
    code: "III.4",
    label: "COGS Printful — hàng mua để bán",
    metric: "cogsPrintful",
    source: "RAW.COGS · Printful",
  },
  {
    code: "III.5",
    label: "Meta advertising",
    metric: "metaAdvertising",
    source: "META_ADS · spend",
  },
  {
    code: "III.6",
    label: "Phí xử lý thanh toán Shopify Payments",
    metric: "paymentProcessingFees",
    source: "RAW.PAYOUT_DETAIL · charge fee",
  },
  {
    code: "III.7",
    label: "Phí xử lý hoàn tiền",
    metric: "refundProcessingFees",
    source: "RAW.PAYOUT_DETAIL · refund fee",
  },
  {
    code: "III.8",
    label: "Phí xử lý tranh chấp/chargeback",
    metric: "disputeProcessingFees",
    source: "RAW.PAYOUT_DETAIL · dispute fee",
  },
  {
    code: "III.9",
    label: "Phí/điều chỉnh thanh toán khác",
    metric: "otherPaymentFees",
    source: "Các fee_amount còn lại",
  },
  {
    code: "III.10",
    label: "Sales bonus — estimated monthly variable cost",
    metric: "salesBonus",
    source: "Tự tính theo revenue attainment",
  },
  {
    code: "IV",
    label: "CONTRIBUTION MARGIN AFTER SALES BONUS",
    metric: "contributionMargin",
    source: "Net revenue − variable cost",
    kind: "total",
  },
  {
    code: "IV.1",
    label: "CM% after Sales bonus",
    metric: "contributionMarginRate",
    source: "Contribution margin / Net revenue",
    kind: "ratio",
  },
  {
    code: "V",
    label: "FIXED COST",
    metric: "fixedCost",
    source: "Tổng cấu hình chi phí tháng",
    kind: "section",
  },
  {
    code: "V.1",
    label: "Phí subscription Printify & Printful",
    metric: "subscriptionCost",
    source: "Nhập theo tháng",
  },
  {
    code: "V.2",
    label: "Tools — xác nhận cho EcomCreate",
    metric: "confirmedToolsCost",
    source: "Nhập theo tháng",
  },
  {
    code: "V.3",
    label: "Chi phí tools mua tại Việt Nam",
    metric: "vietnamToolsCost",
    source: "Nhập theo tháng · USD",
  },
  {
    code: "V.4",
    label: "Personnel",
    metric: "personnelCost",
    source: "Nhập theo tháng · USD",
  },
  {
    code: "V.5",
    label: "MatureX allocated OH",
    metric: "allocatedOverheadCost",
    source: "Nhập theo tháng · USD",
  },
  {
    code: "V.6",
    label: "Chi phí thưởng/phúc lợi",
    metric: "welfareCost",
    source: "Nhập theo tháng · USD",
  },
  {
    code: "C",
    label: "LỢI NHUẬN THUẦN TỪ HĐKD",
    metric: "operatingProfit",
    source: "Contribution margin − fixed cost",
    kind: "total",
  },
  {
    code: "T0",
    label: "THUẾ TNDN TẠM TÍNH TRÊN C — MEMO",
    metric: "provisionalTaxMemo",
    source: "calc · MAX(C, 0) × 20%",
  },
  {
    code: "PM Base",
    label: "CƠ SỞ TÍNH THƯỞNG PM/BO",
    metric: "pmBonusBase",
    source: "calc · C − T0",
  },
  {
    code: "PM Rate",
    label: "TỶ LỆ THƯỞNG PM/BO",
    metric: "pmBonusRate",
    source: "calc · 10% / 20% theo target",
    kind: "ratio",
  },
  {
    code: "C1",
    label: "CHI PHÍ THƯỞNG PM/BO",
    metric: "pmBonus",
    source: "calc · PM Base × PM Rate",
  },
  {
    code: "D",
    label: "LỢI NHUẬN TRƯỚC THUẾ",
    metric: "profitBeforeTax",
    source: "C − thưởng PM/BO",
    kind: "total",
  },
  {
    code: "D1",
    label: "THUẾ TNDN CUỐI CÙNG",
    metric: "corporateIncomeTax",
    source: "calc · MAX(D, 0) × 20%",
  },
  {
    code: "E",
    label: "LỢI NHUẬN SAU THUẾ",
    metric: "profitAfterTax",
    source: "D − D1",
    kind: "total",
  },
  {
    code: "VII",
    label: "ĐIỂM HÒA VỐN / BIÊN AN TOÀN",
    source: "Phân tích quản trị",
    kind: "section",
  },
  {
    code: "VII.1",
    label: "NET OPERATING MARGIN C",
    metric: "netOperatingMargin",
    source: "C / Net revenue",
    kind: "ratio",
  },
  {
    code: "VII.2",
    label: "BREAK-EVEN REVENUE",
    metric: "breakEvenRevenue",
    source: "Fixed cost / (pre-bonus CM% × 98%)",
  },
  {
    code: "VII.3",
    label: "SAFETY MARGIN — AMOUNT",
    metric: "safetyMarginAmount",
    source: "Net revenue − break-even revenue",
  },
  {
    code: "VII.4",
    label: "SAFETY MARGIN — %",
    metric: "safetyMarginRate",
    source: "Safety margin / Net revenue",
    kind: "ratio",
  },
];

export const INPUT_FIELDS: Array<{
  key: keyof Omit<MonthlyInput, "note">;
  label: string;
}> = [
  { key: "subscriptionCost", label: "Subscription Printify & Printful" },
  { key: "confirmedToolsCost", label: "Tools đã xác nhận cho EC" },
  { key: "vietnamToolsCost", label: "Tools mua tại Việt Nam" },
  { key: "personnelCost", label: "Personnel" },
  { key: "allocatedOverheadCost", label: "MatureX allocated OH" },
  { key: "welfareCost", label: "Thưởng / phúc lợi" },
];

export function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)}/${year}`;
}

export function money(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function percent(value: number): string {
  return value.toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export function metric(report: MonthReport, key?: string): number {
  return key ? (report.metrics[key] ?? 0) : 0;
}

export function combinedRatio(
  key: string,
  first: MonthReport,
  second: MonthReport,
): number {
  const total = (metricKey: string) =>
    metric(first, metricKey) + metric(second, metricKey);
  if (key === "contributionMarginRate")
    return total("netRevenue")
      ? total("contributionMargin") / total("netRevenue")
      : 0;
  if (key === "netOperatingMargin")
    return total("netRevenue")
      ? total("operatingProfit") / total("netRevenue")
      : 0;
  if (key === "pmBonusRate")
    return total("pmBonusBase") ? total("pmBonus") / total("pmBonusBase") : 0;
  if (key === "safetyMarginRate")
    return total("netRevenue")
      ? total("safetyMarginAmount") / total("netRevenue")
      : 0;
  return (metric(first, key) + metric(second, key)) / 2;
}
