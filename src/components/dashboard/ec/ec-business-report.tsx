"use client";

import {
  CalculatorIcon,
  DownloadIcon,
  FileChartColumnIncreasingIcon,
  PencilLineIcon,
  SaveIcon,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export type MonthlyInput = {
  subscriptionCost: number;
  confirmedToolsCost: number;
  vietnamToolsCost: number;
  personnelCost: number;
  allocatedOverheadCost: number;
  welfareCost: number;
  note: string | null;
};

export type MonthReport = {
  month: string;
  inputs: MonthlyInput;
  metrics: Record<string, number>;
};

export type EcPnlApiResponse = {
  months: string[];
  reports: MonthReport[];
  error?: string;
};

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

const INPUT_FIELDS: Array<{
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

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)}/${year}`;
}

function money(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function percent(value: number): string {
  return value.toLocaleString("en-US", {
    style: "percent",
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function metric(report: MonthReport, key?: string): number {
  return key ? (report.metrics[key] ?? 0) : 0;
}

function combinedRatio(
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

type EcBusinessReportProps = {
  initialData?: EcPnlApiResponse;
};

export function EcBusinessReport({ initialData }: EcBusinessReportProps) {
  const [months, setMonths] = React.useState<string[]>(
    initialData?.months ?? [],
  );
  const [firstMonth, setFirstMonth] = React.useState(
    initialData?.reports[0]?.month ?? "",
  );
  const [secondMonth, setSecondMonth] = React.useState(
    initialData?.reports[1]?.month ?? "",
  );
  const [reports, setReports] = React.useState<MonthReport[]>(
    initialData?.reports ?? [],
  );
  const [loading, setLoading] = React.useState(!initialData);
  const [error, setError] = React.useState<string | null>(null);
  const [editingMonth, setEditingMonth] = React.useState<string | null>(null);
  const [draft, setDraft] = React.useState<MonthlyInput | null>(null);
  const [saving, setSaving] = React.useState(false);
  const [exporting, setExporting] = React.useState(false);
  const [exportMode, setExportMode] = React.useState<"one" | "comparison">(
    "comparison",
  );

  const load = React.useCallback(async (first?: string, second?: string) => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (first) params.set("first", first);
    if (second) params.set("second", second);
    try {
      const response = await fetch(`/api/ec/pnl?${params.toString()}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as EcPnlApiResponse;
      if (!response.ok)
        throw new Error(payload.error ?? "Không thể tải báo cáo.");
      setMonths(payload.months);
      setReports(payload.reports);
      setFirstMonth(payload.reports[0]?.month ?? "");
      setSecondMonth(payload.reports[1]?.month ?? "");
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Không thể tải báo cáo.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!initialData) void load();
  }, [initialData, load]);

  const first = reports[0];
  const second = reports[1];

  function edit(report: MonthReport) {
    setEditingMonth(report.month);
    setDraft({ ...report.inputs });
  }

  async function save() {
    if (!editingMonth || !draft) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/ec/pnl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month: editingMonth, ...draft }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error ?? "Không thể lưu cấu hình.");
      setEditingMonth(null);
      setDraft(null);
      await load(firstMonth, secondMonth);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Không thể lưu cấu hình.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function exportWorkbook() {
    setExporting(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        first: firstMonth,
        mode: exportMode,
      });
      if (exportMode === "comparison") params.set("second", secondMonth);
      const response = await fetch(
        `/api/ec/business-report/export?${params.toString()}`,
        {
          cache: "no-store",
        },
      );
      if (!response.ok) {
        const payload = (await response.json()) as { error?: string };
        throw new Error(payload.error ?? "Không thể xuất báo cáo kinh doanh.");
      }
      const blob = await response.blob();
      const disposition = response.headers.get("Content-Disposition") ?? "";
      const fileName =
        disposition.match(/filename="?([^";]+)"?/)?.[1] ??
        "the-deerly-business-report.xlsx";
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    } catch (exportError) {
      setError(
        exportError instanceof Error
          ? exportError.message
          : "Không thể xuất báo cáo kinh doanh.",
      );
    } finally {
      setExporting(false);
    }
  }

  if (loading && !first) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Đang tổng hợp báo cáo kinh doanh…
      </div>
    );
  }

  if (error && (!first || !second)) {
    return (
      <div className="p-8 text-center text-sm text-destructive">{error}</div>
    );
  }

  if (!first || !second) return null;

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-border/50 bg-muted/20 p-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <FileChartColumnIncreasingIcon className="size-4 text-emerald-600" />
            Báo cáo kết quả hoạt động kinh doanh
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            EcomCreate · Brand TheDeerly · Đơn vị USD
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Kỳ thứ nhất
            </Label>
            <Select
              value={firstMonth}
              onValueChange={(value) => void load(value as string, secondMonth)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {monthLabel(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[11px] text-muted-foreground">
              Kỳ thứ hai
            </Label>
            <Select
              value={secondMonth}
              onValueChange={(value) => void load(firstMonth, value as string)}
            >
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {monthLabel(month)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button variant="outline" size="sm" onClick={() => edit(first)}>
            <PencilLineIcon /> Chi phí {first.month}
          </Button>
          <Button variant="outline" size="sm" onClick={() => edit(second)}>
            <PencilLineIcon /> Chi phí {second.month}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" title="Xuất báo cáo kinh doanh XLSX" />}
            >
              <DownloadIcon /> Xuất XLSX
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 p-3">
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-semibold">
                    Xuất báo cáo kinh doanh
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Gồm PL, Rewards, Orders, COGS, Ads, Payouts và Airwallex.
                  </p>
                </div>
                <label className="block space-y-1 text-xs text-muted-foreground">
                  Kỳ xuất
                  <select
                    className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground"
                    value={exportMode}
                    onChange={(event) =>
                      setExportMode(event.target.value as "one" | "comparison")
                    }
                  >
                    <option value="one">
                      Một tháng: {monthLabel(firstMonth)}
                    </option>
                    <option value="comparison">
                      So sánh: {monthLabel(firstMonth)} và{" "}
                      {monthLabel(secondMonth)}
                    </option>
                  </select>
                </label>
                <Button
                  className="w-full"
                  onClick={() => void exportWorkbook()}
                  disabled={exporting}
                >
                  <DownloadIcon />
                  {exporting ? "Đang tạo file…" : "Tải file XLSX"}
                </Button>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {error ? (
        <div className="border-b border-destructive/20 bg-destructive/5 px-4 py-2 text-xs text-destructive">
          {error}
        </div>
      ) : null}

      <div className="max-h-[620px] overflow-auto">
        <Table className="min-w-[1080px]">
          <TableHeader className="sticky top-0 z-10 bg-background shadow-[0_1px_0_var(--border)]">
            <TableRow>
              <TableHead rowSpan={2} className="w-24">
                Mã
              </TableHead>
              <TableHead rowSpan={2} className="min-w-72">
                Chỉ tiêu
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                {monthLabel(first.month)}
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                {monthLabel(second.month)}
              </TableHead>
              <TableHead colSpan={2} className="text-center">
                Tổng cộng
              </TableHead>
              <TableHead rowSpan={2} className="min-w-72">
                Cơ sở / trạng thái
              </TableHead>
            </TableRow>
            <TableRow>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead className="text-right">Tỷ lệ %</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead className="text-right">Tỷ lệ %</TableHead>
              <TableHead className="text-right">Số tiền</TableHead>
              <TableHead className="text-right">Tỷ lệ %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REPORT_ROWS.map((row) => {
              const firstValue = metric(first, row.metric);
              const secondValue = metric(second, row.metric);
              const ratio = row.kind === "ratio";
              const section = row.kind === "section" && !row.metric;
              const firstShare = ratio
                ? firstValue
                : metric(first, "netRevenue")
                  ? firstValue / metric(first, "netRevenue")
                  : 0;
              const secondShare = ratio
                ? secondValue
                : metric(second, "netRevenue")
                  ? secondValue / metric(second, "netRevenue")
                  : 0;
              const totalValue =
                ratio && row.metric
                  ? combinedRatio(row.metric, first, second)
                  : firstValue + secondValue;
              const totalRevenue =
                metric(first, "netRevenue") + metric(second, "netRevenue");
              const totalShare = ratio
                ? totalValue
                : totalRevenue
                  ? totalValue / totalRevenue
                  : 0;
              return (
                <TableRow
                  key={row.code}
                  className={
                    row.kind === "total"
                      ? "bg-emerald-500/5 font-semibold"
                      : row.kind === "section"
                        ? "bg-muted/60 font-semibold"
                        : undefined
                  }
                >
                  <TableCell className="font-mono text-xs">
                    {row.code}
                  </TableCell>
                  <TableCell>{row.label}</TableCell>
                  {section ? (
                    <TableCell colSpan={6} />
                  ) : (
                    <>
                      <TableCell className="text-right font-mono">
                        {ratio ? percent(firstValue) : money(firstValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {percent(firstShare)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {ratio ? percent(secondValue) : money(secondValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {percent(secondShare)}
                      </TableCell>
                      <TableCell className="text-right font-mono font-medium">
                        {ratio ? percent(totalValue) : money(totalValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-muted-foreground">
                        {percent(totalShare)}
                      </TableCell>
                    </>
                  )}
                  <TableCell className="text-xs text-muted-foreground">
                    {row.source}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Sheet
        open={Boolean(editingMonth)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingMonth(null);
            setDraft(null);
          }
        }}
      >
        <SheetContent className="sm:max-w-md">
          <SheetHeader className="border-b border-border/60">
            <SheetTitle className="flex items-center gap-2">
              <CalculatorIcon className="size-4" /> Chi phí thủ công{" "}
              {editingMonth ? monthLabel(editingMonth) : ""}
            </SheetTitle>
            <SheetDescription>
              Các khoản này chưa có nguồn dữ liệu tự động. Nhập bằng USD và lưu
              riêng cho từng tháng.
            </SheetDescription>
          </SheetHeader>
          {draft ? (
            <div className="flex-1 space-y-4 overflow-y-auto px-4">
              {INPUT_FIELDS.map((field) => (
                <div key={field.key} className="space-y-1.5">
                  <Label htmlFor={field.key}>{field.label}</Label>
                  <Input
                    id={field.key}
                    type="number"
                    min="0"
                    step="0.01"
                    value={draft[field.key]}
                    onChange={(event) =>
                      setDraft({
                        ...draft,
                        [field.key]: Number(event.target.value),
                      })
                    }
                  />
                </div>
              ))}
              <div className="space-y-1.5">
                <Label htmlFor="pnl-note">Ghi chú</Label>
                <textarea
                  id="pnl-note"
                  className="min-h-24 w-full rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                  value={draft.note ?? ""}
                  onChange={(event) =>
                    setDraft({ ...draft, note: event.target.value })
                  }
                />
              </div>
            </div>
          ) : null}
          <SheetFooter className="border-t border-border/60">
            <Button onClick={() => void save()} disabled={saving}>
              <SaveIcon />
              {saving ? "Đang lưu…" : "Lưu chi phí tháng"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}
