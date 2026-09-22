"use client";

import {
  DownloadIcon,
  FileChartColumnIncreasingIcon,
  PencilLineIcon,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EditInputsSheet } from "./business-report/edit-inputs-sheet";
import {
  combinedRatio,
  metric,
  money,
  monthLabel,
  percent,
  REPORT_ROWS,
} from "./business-report/report-rows";
import type {
  EcPnlApiResponse,
  MonthlyInput,
  MonthReport,
} from "./business-report/types";

export type { MonthlyInput, MonthReport, EcPnlApiResponse };

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
              render={
                <Button size="sm" disabled={exporting}>
                  <DownloadIcon />
                  {exporting ? "Đang xuất…" : "Xuất Excel"}
                </Button>
              }
            />
            <DropdownMenuContent align="end" className="w-56 p-2 space-y-1">
              <Button
                variant={exportMode === "comparison" ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  setExportMode("comparison");
                  void exportWorkbook();
                }}
              >
                Xuất so sánh 2 kỳ
              </Button>
              <Button
                variant={exportMode === "one" ? "default" : "ghost"}
                size="sm"
                className="w-full justify-start text-xs"
                onClick={() => {
                  setExportMode("one");
                  void exportWorkbook();
                }}
              >
                Chỉ xuất kỳ 1 ({first.month})
              </Button>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Mã</TableHead>
              <TableHead className="min-w-64">Chỉ tiêu P&amp;L</TableHead>
              <TableHead className="text-right">
                {monthLabel(first.month)}
              </TableHead>
              <TableHead className="text-right">% Rev 1</TableHead>
              <TableHead className="text-right">
                {monthLabel(second.month)}
              </TableHead>
              <TableHead className="text-right">% Rev 2</TableHead>
              <TableHead className="text-right">Cộng 2 kỳ</TableHead>
              <TableHead className="text-right">% Total</TableHead>
              <TableHead className="min-w-48">Nguồn / Công thức</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {REPORT_ROWS.map((row) => {
              const section = row.kind === "section";
              const total = row.kind === "total";
              const ratio = row.kind === "ratio";
              const firstValue = ratio
                ? metric(first, row.metric)
                : metric(first, row.metric);
              const secondValue = ratio
                ? metric(second, row.metric)
                : metric(second, row.metric);
              const totalValue = ratio
                ? combinedRatio(row.metric ?? "", first, second)
                : firstValue + secondValue;
              const firstRev = metric(first, "netRevenue") || 1;
              const secondRev = metric(second, "netRevenue") || 1;
              const totalRev = firstRev + secondRev || 1;
              const firstShare = ratio ? firstValue : firstValue / firstRev;
              const secondShare = ratio ? secondValue : secondValue / secondRev;
              const totalShare = ratio ? totalValue : totalValue / totalRev;

              return (
                <TableRow
                  key={row.code}
                  className={
                    section
                      ? "bg-muted/40 font-bold"
                      : total
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

      <EditInputsSheet
        editingMonth={editingMonth}
        draft={draft}
        onDraftChange={setDraft}
        onClose={() => {
          setEditingMonth(null);
          setDraft(null);
        }}
        onSave={save}
        saving={saving}
      />
    </div>
  );
}
