import "server-only";

import * as XLSX from "xlsx-js-style";
import {
  formatVietnamDate,
  formatVietnamDateTime,
  isVietnamMonth,
  vietnamMonthRange,
} from "@/lib/date-time";
import { getEcPnlMonth, type PnlMonthReport } from "@/lib/ec-pnl";
import { prisma } from "@/lib/prisma";

type ReportRow = {
  code: string;
  label: string;
  metric?: string;
  source: string;
  kind?: "section" | "total" | "ratio" | "standard";
};

const REPORT_ROWS: ReportRow[] = [
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
    source: "calc · corrected net order − sales tax",
    kind: "total",
  },
  {
    code: "III",
    label: "VARIABLE COST",
    metric: "variableCost",
    source: "calc · COGS + Ads + Shopify fees + Sales bonus",
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
    source: "RAW.PAYOUT_DETAIL · other fee",
  },
  {
    code: "III.10",
    label: "Sales bonus — estimated monthly variable cost",
    metric: "salesBonus",
    source: "calc · revenue attainment",
  },
  {
    code: "IV",
    label: "CONTRIBUTION MARGIN AFTER SALES BONUS",
    metric: "contributionMargin",
    source: "calc · net revenue − variable cost",
    kind: "total",
  },
  {
    code: "IV.1",
    label: "CM% after Sales bonus",
    metric: "contributionMarginRate",
    source: "calc · contribution margin / net revenue",
    kind: "ratio",
  },
  {
    code: "V",
    label: "FIXED COST",
    metric: "fixedCost",
    source: "monthly P&L configuration",
    kind: "section",
  },
  {
    code: "V.1",
    label: "Phí subscription Printify & Printful",
    metric: "subscriptionCost",
    source: "monthly configuration",
  },
  {
    code: "V.2",
    label: "Tools — xác nhận cho EcomCreate",
    metric: "confirmedToolsCost",
    source: "monthly configuration / Airwallex reference",
  },
  {
    code: "V.3",
    label: "Chi phí tools mua tại Việt Nam",
    metric: "vietnamToolsCost",
    source: "monthly configuration / Airwallex reference",
  },
  {
    code: "V.4",
    label: "Personnel",
    metric: "personnelCost",
    source: "monthly configuration",
  },
  {
    code: "V.5",
    label: "MatureX allocated OH",
    metric: "allocatedOverheadCost",
    source: "monthly configuration",
  },
  {
    code: "V.6",
    label: "Chi phí thưởng/phúc lợi",
    metric: "welfareCost",
    source: "monthly configuration",
  },
  {
    code: "C",
    label: "LỢI NHUẬN THUẦN TỪ HĐKD",
    metric: "operatingProfit",
    source: "calc · contribution margin − fixed cost",
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
    source: "calc · rate by target",
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
    source: "calc · C − PM/BO bonus",
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
    source: "calc · D − D1",
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
    source: "calc · C / Net revenue",
    kind: "ratio",
  },
  {
    code: "VII.2",
    label: "BREAK-EVEN REVENUE",
    metric: "breakEvenRevenue",
    source: "calc · fixed cost / contribution ratio",
  },
  {
    code: "VII.3",
    label: "SAFETY MARGIN — AMOUNT",
    metric: "safetyMarginAmount",
    source: "calc · net revenue − break-even revenue",
  },
  {
    code: "VII.4",
    label: "SAFETY MARGIN — %",
    metric: "safetyMarginRate",
    source: "calc · safety margin / net revenue",
    kind: "ratio",
  },
];

const DARK_BLUE = "10205E";
const LIGHT_BLUE = "E8F1FC";
const LIGHT_GRAY = "F4F6FA";
const WHITE = "FFFFFF";
const BORDER = { style: "thin", color: { rgb: "D9E2F3" } };
const MONEY_FORMAT = "$#,##0.00;($#,##0.00);-";
const PERCENT_FORMAT = "0.00%;(0.00%);-";

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)}/${year}`;
}

function monthEnd(month: string): Date {
  const { to } = vietnamMonthRange(month);
  return new Date(to.getTime() - 1);
}

function numberValue(value: { toString(): string } | null | undefined): number {
  return value ? Number(value.toString()) : 0;
}

function metric(report: PnlMonthReport, key?: string): number {
  return key ? (report.metrics[key] ?? 0) : 0;
}

function combinedRatio(
  key: string,
  first: PnlMonthReport,
  second: PnlMonthReport,
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

function setStyle(
  cell: XLSX.CellObject | undefined,
  style: Record<string, unknown>,
  numberFormat?: string,
): void {
  if (!cell) return;
  cell.s = style;
  if (numberFormat) cell.z = numberFormat;
}

function rangeCells(sheet: XLSX.WorkSheet, range: string): XLSX.CellObject[] {
  const decoded = XLSX.utils.decode_range(range);
  const cells: XLSX.CellObject[] = [];
  for (let row = decoded.s.r; row <= decoded.e.r; row += 1) {
    for (let column = decoded.s.c; column <= decoded.e.c; column += 1) {
      const address = XLSX.utils.encode_cell({ r: row, c: column });
      sheet[address] ??= { t: "s", v: "" };
      cells.push(sheet[address]);
    }
  }
  return cells;
}

function applyStyle(
  sheet: XLSX.WorkSheet,
  range: string,
  style: Record<string, unknown>,
  numberFormat?: string,
): void {
  for (const cell of rangeCells(sheet, range))
    setStyle(cell, style, numberFormat);
}

function plStyles(sheet: XLSX.WorkSheet, endColumn: string): void {
  const title = {
    font: { bold: true, sz: 16, color: { rgb: DARK_BLUE } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const subtitle = {
    font: { bold: true, sz: 12, color: { rgb: DARK_BLUE } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const note = {
    font: { sz: 10, color: { rgb: "5B6475" } },
    alignment: { horizontal: "left", vertical: "center" },
  };
  const header = {
    font: { bold: true, color: { rgb: WHITE } },
    fill: { patternType: "solid", fgColor: { rgb: DARK_BLUE } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
  };
  const normal = {
    font: { sz: 10 },
    fill: { patternType: "solid", fgColor: { rgb: WHITE } },
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    alignment: { vertical: "center" },
  };
  const section = {
    font: { bold: true, color: { rgb: DARK_BLUE } },
    fill: { patternType: "solid", fgColor: { rgb: LIGHT_GRAY } },
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    alignment: { vertical: "center" },
  };
  const total = {
    font: { bold: true, color: { rgb: DARK_BLUE } },
    fill: { patternType: "solid", fgColor: { rgb: LIGHT_BLUE } },
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    alignment: { vertical: "center" },
  };
  const closingSection = {
    font: { bold: true, color: { rgb: WHITE } },
    fill: { patternType: "solid", fgColor: { rgb: DARK_BLUE } },
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    alignment: { vertical: "center" },
  };

  applyStyle(sheet, `A1:${endColumn}1`, title);
  applyStyle(sheet, `A2:${endColumn}2`, subtitle);
  applyStyle(sheet, `A3:${endColumn}3`, note);
  applyStyle(sheet, `A5:${endColumn}6`, header);

  REPORT_ROWS.forEach((row, index) => {
    const excelRow = index + 7;
    const style =
      row.kind === "total" ? total : row.kind === "section" ? section : normal;
    applyStyle(sheet, `A${excelRow}:${endColumn}${excelRow}`, style);
    if (row.code === "VII") {
      applyStyle(sheet, `A${excelRow}:B${excelRow}`, closingSection);
    }
  });
}

function buildPlSheet(reports: PnlMonthReport[]): XLSX.WorkSheet {
  const [first, second] = reports;
  const comparison = Boolean(second);
  const endColumn = comparison ? "I" : "E";
  const titlePeriod = comparison
    ? `Từ ${formatVietnamDate(vietnamMonthRange(first.month).from).split("-").reverse().join("/")} đến ${formatVietnamDate(monthEnd(second.month)).split("-").reverse().join("/")}`
    : `Từ ${formatVietnamDate(vietnamMonthRange(first.month).from).split("-").reverse().join("/")} đến ${formatVietnamDate(monthEnd(first.month)).split("-").reverse().join("/")}`;
  const rows: Array<Array<string | number | null>> = [
    ["BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH"],
    ["DỰ ÁN ECOMCREATE (Brand TheDeerly)"],
    [`${titlePeriod} | Đơn vị: USD`],
    [],
    comparison
      ? [
          "Mã chỉ tiêu",
          "Chỉ tiêu",
          monthLabel(first.month),
          null,
          monthLabel(second.month),
          null,
          "Tổng cộng",
          null,
          "Cơ sở / trạng thái",
        ]
      : [
          "Mã chỉ tiêu",
          "Chỉ tiêu",
          monthLabel(first.month),
          null,
          "Cơ sở / trạng thái",
        ],
    comparison
      ? [
          null,
          null,
          "Số tiền",
          "Tỷ lệ %",
          "Số tiền",
          "Tỷ lệ %",
          "Số tiền",
          "Tỷ lệ %",
          null,
        ]
      : [null, null, "Số tiền", "Tỷ lệ %", null],
  ];

  for (const row of REPORT_ROWS) {
    const firstValue = metric(first, row.metric);
    const secondValue = second ? metric(second, row.metric) : 0;
    const ratio = row.kind === "ratio";
    const totalValue =
      ratio && second && row.metric
        ? combinedRatio(row.metric, first, second)
        : firstValue + secondValue;
    const firstShare = ratio
      ? firstValue
      : metric(first, "netRevenue")
        ? firstValue / metric(first, "netRevenue")
        : 0;
    const secondShare = ratio
      ? secondValue
      : second && metric(second, "netRevenue")
        ? secondValue / metric(second, "netRevenue")
        : 0;
    const totalRevenue =
      metric(first, "netRevenue") + (second ? metric(second, "netRevenue") : 0);
    const totalShare = ratio
      ? totalValue
      : totalRevenue
        ? totalValue / totalRevenue
        : 0;
    const emptySection = row.kind === "section" && !row.metric;
    rows.push(
      comparison
        ? [
            row.code,
            row.label,
            emptySection ? null : firstValue,
            emptySection ? null : firstShare,
            emptySection ? null : secondValue,
            emptySection ? null : secondShare,
            emptySection ? null : totalValue,
            emptySection ? null : totalShare,
            row.source,
          ]
        : [
            row.code,
            row.label,
            emptySection ? null : firstValue,
            emptySection ? null : firstShare,
            row.source,
          ],
    );
  }

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  sheet["!merges"] = comparison
    ? [
        "A1:I1",
        "A2:I2",
        "A3:I3",
        "A5:A6",
        "B5:B6",
        "C5:D5",
        "E5:F5",
        "G5:H5",
        "I5:I6",
      ].map(XLSX.utils.decode_range)
    : ["A1:E1", "A2:E2", "A3:E3", "A5:A6", "B5:B6", "C5:D5", "E5:E6"].map(
        XLSX.utils.decode_range,
      );
  sheet["!freeze"] = {
    xSplit: 0,
    ySplit: 6,
    topLeftCell: "A7",
    activePane: "bottomLeft",
    state: "frozen",
  };
  sheet["!cols"] = comparison
    ? [
        { wch: 13 },
        { wch: 47 },
        { wch: 18 },
        { wch: 12 },
        { wch: 18 },
        { wch: 12 },
        { wch: 18 },
        { wch: 12 },
        { wch: 58 },
      ]
    : [{ wch: 13 }, { wch: 47 }, { wch: 18 }, { wch: 12 }, { wch: 58 }];
  sheet["!rows"] = [
    { hpt: 26 },
    { hpt: 20 },
    { hpt: 18 },
    { hpt: 8 },
    { hpt: 21 },
    { hpt: 21 },
  ];
  plStyles(sheet, endColumn);

  REPORT_ROWS.forEach((row, index) => {
    const excelRow = index + 7;
    const ratio = row.kind === "ratio";
    const amountColumns = comparison ? ["C", "E", "G"] : ["C"];
    const ratioColumns = comparison ? ["D", "F", "H"] : ["D"];
    for (const column of amountColumns)
      setStyle(
        sheet[`${column}${excelRow}`],
        sheet[`${column}${excelRow}`]?.s ?? {},
        ratio ? PERCENT_FORMAT : MONEY_FORMAT,
      );
    for (const column of ratioColumns)
      setStyle(
        sheet[`${column}${excelRow}`],
        sheet[`${column}${excelRow}`]?.s ?? {},
        PERCENT_FORMAT,
      );
    if (row.kind === "section" && !row.metric) {
      const start = comparison ? "C" : "C";
      const end = comparison ? "H" : "D";
      applyStyle(
        sheet,
        `${start}${excelRow}:${end}${excelRow}`,
        sheet[`A${excelRow}`]?.s ?? {},
      );
    }
  });

  return sheet;
}

function sourceSheet(
  rows: Record<string, string | number | null>[],
  columns: Array<[string, string, number]>,
): XLSX.WorkSheet {
  const header = columns.map(([, label]) => label);
  const values = rows.map((row) => columns.map(([key]) => row[key] ?? null));
  const sheet = XLSX.utils.aoa_to_sheet([header, ...values]);
  const endColumn = XLSX.utils.encode_col(columns.length - 1);
  const headerStyle = {
    font: { bold: true, color: { rgb: WHITE } },
    fill: { patternType: "solid", fgColor: { rgb: DARK_BLUE } },
    alignment: { horizontal: "center", vertical: "center", wrapText: true },
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
  };
  const bodyStyle = {
    border: { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER },
    alignment: { vertical: "top" },
  };
  applyStyle(sheet, `A1:${endColumn}1`, headerStyle);
  if (values.length)
    applyStyle(sheet, `A2:${endColumn}${values.length + 1}`, bodyStyle);
  sheet["!cols"] = columns.map(([, , width]) => ({ wch: width }));
  sheet["!autofilter"] = {
    ref: `A1:${endColumn}${Math.max(values.length + 1, 2)}`,
  };
  sheet["!freeze"] = {
    xSplit: 0,
    ySplit: 1,
    topLeftCell: "A2",
    activePane: "bottomLeft",
    state: "frozen",
  };
  return sheet;
}

function addCurrencyFormat(
  sheet: XLSX.WorkSheet,
  columns: string[],
  rowCount: number,
): void {
  for (const column of columns) {
    for (let row = 2; row <= rowCount + 1; row += 1) {
      setStyle(
        sheet[`${column}${row}`],
        sheet[`${column}${row}`]?.s ?? {},
        MONEY_FORMAT,
      );
    }
  }
}

export async function buildEcBusinessReport(
  months: string[],
): Promise<Uint8Array> {
  if (
    months.length < 1 ||
    months.length > 2 ||
    months.some((month) => !isVietnamMonth(month))
  ) {
    throw new Error("Chọn một hoặc hai tháng hợp lệ để xuất báo cáo.");
  }
  if (new Set(months).size !== months.length)
    throw new Error("Hai tháng so sánh không được trùng nhau.");

  const ranges = months.map((month) => vietnamMonthRange(month));
  const dateFilter = (field: string) => ({
    OR: ranges.map(({ from, to }) => ({ [field]: { gte: from, lt: to } })),
  });

  const data = await prisma.$transaction(
    async (database) => {
      const [reports, orders, cogs, ads, payouts, airwallex] =
        await Promise.all([
          Promise.all(months.map((month) => getEcPnlMonth(month, database))),
          database.rawOrder.findMany({
            where: dateFilter("orderDate"),
            orderBy: [{ orderDate: "asc" }, { orderName: "asc" }],
          }),
          database.cogsRecord.findMany({
            where: dateFilter("date"),
            orderBy: [{ date: "asc" }, { supplier: "asc" }],
          }),
          database.metaDailyFinancial.findMany({
            where: dateFilter("dateStart"),
            orderBy: { dateStart: "asc" },
          }),
          database.shopifyPaymentRecord.findMany({
            where: {
              AND: [
                { transactionDate: { not: null } },
                dateFilter("transactionDate"),
              ],
            },
            orderBy: { transactionDate: "asc" },
          }),
          database.airwallexAccountActivity.findMany({
            where: {
              AND: [
                { transactionType: { not: "CARD_PURCHASE" } },
                dateFilter("transactionDate"),
              ],
            },
            orderBy: { transactionDate: "asc" },
          }),
        ]);
      return { reports, orders, cogs, ads, payouts, airwallex };
    },
    { isolationLevel: "RepeatableRead", timeout: 60_000 },
  );

  const rewards = data.reports.map((report) => ({
    month: monthLabel(report.month),
    net_revenue: metric(report, "netRevenue"),
    break_even_revenue: metric(report, "breakEvenRevenue"),
    revenue_attainment: metric(report, "revenueAttainment"),
    sales_bonus_rate: metric(report, "salesBonusRate"),
    estimated_sales_bonus: metric(report, "salesBonus"),
    pm_bonus_base: metric(report, "pmBonusBase"),
    pm_bonus_rate: metric(report, "pmBonusRate"),
    pm_bonus: metric(report, "pmBonus"),
  }));
  const orders = data.orders.map((row) => ({
    shopify_order_id: row.shopifyOrderId,
    order_name: row.orderName,
    order_date: formatVietnamDate(row.orderDate),
    financial_status: row.financialStatus,
    fulfillment_status: row.fulfillmentStatus,
    fulfillment_date: row.fulfillmentDate
      ? formatVietnamDate(row.fulfillmentDate)
      : null,
    delivery_status: row.deliveryStatus,
    delivery_date: row.deliveryDate
      ? formatVietnamDate(row.deliveryDate)
      : null,
    gross_sales: numberValue(row.grossSales),
    discounts: numberValue(row.discounts),
    shipping_charged: numberValue(row.shippingCharged),
    sales_tax: numberValue(row.salesTax),
    order_total_before_refund: numberValue(row.orderTotalBeforeRefund),
    order_total: numberValue(row.orderTotal),
    refund_amount: numberValue(row.refundAmount),
    calc_net_order_after_refund: numberValue(row.calcOrderNetAfterRefund),
    refund_date: row.refundDate ? formatVietnamDate(row.refundDate) : null,
    items: row.items,
    tag: row.tag,
  }));
  const cogs = data.cogs.map((row) => ({
    supplier: row.supplier,
    date: formatVietnamDate(row.date),
    reference_order_id: row.referenceOrderId,
    supplier_order_id: row.supplierOrderId,
    total_cost: numberValue(row.totalCost),
    estimated_cost: numberValue(row.estimatedCost),
    mapping_status: row.mappingStatus,
    source_note: row.sourceNote,
    source_record_id: row.sourceRecordId,
    item_key: row.itemKey,
  }));
  const ads = data.ads.map((row) => ({
    account_id: row.accountId,
    date_start: formatVietnamDate(row.dateStart),
    date_stop: formatVietnamDate(row.dateStop),
    currency: row.currency,
    spend: numberValue(row.spend),
    purchase_count: numberValue(row.purchaseCount),
    purchase_value: numberValue(row.purchaseValue),
    purchase_roas: numberValue(row.purchaseRoas),
    cost_per_purchase: numberValue(row.costPerPurchase),
    impressions: Number(row.impressions),
    clicks: Number(row.clicks),
    cpc: numberValue(row.cpc),
    cpm: numberValue(row.cpm),
    ctr: numberValue(row.ctr),
  }));
  const payouts = data.payouts.map((row) => ({
    external_id: row.externalId,
    record_type: row.recordType,
    transaction_date: row.transactionDate
      ? formatVietnamDateTime(row.transactionDate)
      : null,
    currency: row.currency,
    gross_amount: numberValue(row.grossAmount),
    fee_amount: numberValue(row.feeAmount),
    net_amount: numberValue(row.netAmount),
    payout_id: row.payoutId,
    payout_status: row.payoutStatus,
    source_type: row.sourceType,
    source_order_id: row.sourceOrderId,
    source_order_name: row.sourceOrderName,
    reason: row.reason,
  }));
  const airwallex = data.airwallex.map((row) => ({
    external_id: row.externalId,
    transaction_date: formatVietnamDateTime(row.transactionDate),
    transaction_type: row.transactionType,
    card: row.card,
    card_nick_name: row.cardNickName,
    account_number: row.accountNumber,
    account_name: row.accountName,
    where_paid: row.wherePaid,
    credit: numberValue(row.credit),
    debit: numberValue(row.debit),
    currency: row.currency,
    ledger_status: row.ledgerStatus,
    details: row.details,
  }));

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, buildPlSheet(data.reports), "PL");
  const rewardsSheet = sourceSheet(rewards, [
    ["month", "Month", 15],
    ["net_revenue", "Net Revenue", 18],
    ["break_even_revenue", "Break-even Revenue", 20],
    ["revenue_attainment", "Revenue Attainment", 18],
    ["sales_bonus_rate", "Sales Bonus Rate", 17],
    ["estimated_sales_bonus", "Estimated Sales Bonus", 21],
    ["pm_bonus_base", "PM Bonus Base", 18],
    ["pm_bonus_rate", "PM Bonus Rate", 16],
    ["pm_bonus", "PM Bonus", 16],
  ]);
  addCurrencyFormat(rewardsSheet, ["B", "C", "F", "G", "I"], rewards.length);
  XLSX.utils.book_append_sheet(workbook, rewardsSheet, "Rewards");
  const ordersSheet = sourceSheet(orders, [
    ["shopify_order_id", "Shopify Order ID", 24],
    ["order_name", "Order Name", 16],
    ["order_date", "Order Date", 14],
    ["financial_status", "Financial Status", 18],
    ["fulfillment_status", "Fulfillment Status", 18],
    ["fulfillment_date", "Fulfillment Date", 16],
    ["delivery_status", "Delivery Status", 16],
    ["delivery_date", "Delivery Date", 14],
    ["gross_sales", "Gross Sales", 14],
    ["discounts", "Discounts", 14],
    ["shipping_charged", "Shipping Charged", 18],
    ["sales_tax", "Sales Tax", 14],
    ["order_total_before_refund", "Order Total Before Refund", 24],
    ["order_total", "Order Total", 14],
    ["refund_amount", "Refund Amount", 16],
    ["calc_net_order_after_refund", "Net Order After Refund (calc)", 28],
    ["refund_date", "Refund Date", 14],
    ["items", "Items", 10],
    ["tag", "Tag", 20],
  ]);
  addCurrencyFormat(
    ordersSheet,
    ["I", "J", "K", "L", "M", "N", "O", "P"],
    orders.length,
  );
  XLSX.utils.book_append_sheet(workbook, ordersSheet, "Orders");
  const cogsSheet = sourceSheet(cogs, [
    ["supplier", "Supplier", 18],
    ["date", "Date", 14],
    ["reference_order_id", "Reference Order ID", 22],
    ["supplier_order_id", "Supplier Order ID", 28],
    ["total_cost", "Total Cost", 15],
    ["estimated_cost", "Estimated Cost", 17],
    ["mapping_status", "Mapping Status", 18],
    ["source_note", "Source Note", 52],
    ["source_record_id", "Source Record ID", 28],
    ["item_key", "Item Key", 34],
  ]);
  addCurrencyFormat(cogsSheet, ["E", "F"], cogs.length);
  XLSX.utils.book_append_sheet(workbook, cogsSheet, "COGS");
  const adsSheet = sourceSheet(ads, [
    ["account_id", "Account ID", 20],
    ["date_start", "Date Start", 14],
    ["date_stop", "Date Stop", 14],
    ["currency", "Currency", 12],
    ["spend", "Spend", 14],
    ["purchase_count", "Purchase Count", 16],
    ["purchase_value", "Purchase Value", 16],
    ["purchase_roas", "Purchase ROAS", 16],
    ["cost_per_purchase", "Cost Per Purchase", 20],
    ["impressions", "Impressions", 15],
    ["clicks", "Clicks", 12],
    ["cpc", "CPC", 12],
    ["cpm", "CPM", 12],
    ["ctr", "CTR", 12],
  ]);
  addCurrencyFormat(adsSheet, ["E", "G", "I", "L", "M"], ads.length);
  XLSX.utils.book_append_sheet(workbook, adsSheet, "Ads");
  const payoutsSheet = sourceSheet(payouts, [
    ["external_id", "External ID", 38],
    ["record_type", "Record Type", 20],
    ["transaction_date", "Transaction Date (Vietnam)", 28],
    ["currency", "Currency", 12],
    ["gross_amount", "Gross Amount", 16],
    ["fee_amount", "Fee Amount", 15],
    ["net_amount", "Net Amount", 15],
    ["payout_id", "Payout ID", 34],
    ["payout_status", "Payout Status", 16],
    ["source_type", "Source Type", 26],
    ["source_order_id", "Source Order ID", 30],
    ["source_order_name", "Source Order Name", 20],
    ["reason", "Reason", 34],
  ]);
  addCurrencyFormat(payoutsSheet, ["E", "F", "G"], payouts.length);
  XLSX.utils.book_append_sheet(workbook, payoutsSheet, "Payouts");
  const airwallexSheet = sourceSheet(airwallex, [
    ["external_id", "External ID", 38],
    ["transaction_date", "Transaction Date (Vietnam)", 28],
    ["transaction_type", "Transaction Type", 18],
    ["card", "Card", 22],
    ["card_nick_name", "Card Name", 22],
    ["account_number", "Account Number", 20],
    ["account_name", "Account Name", 22],
    ["where_paid", "Merchant / Destination", 30],
    ["credit", "Credit", 15],
    ["debit", "Debit", 15],
    ["currency", "Currency", 12],
    ["ledger_status", "Ledger Status", 16],
    ["details", "Details", 56],
  ]);
  addCurrencyFormat(airwallexSheet, ["I", "J"], airwallex.length);
  XLSX.utils.book_append_sheet(workbook, airwallexSheet, "Airwallex");

  return new Uint8Array(
    XLSX.write(workbook, {
      bookType: "xlsx",
      type: "array",
      cellStyles: true,
      compression: true,
    }),
  );
}
