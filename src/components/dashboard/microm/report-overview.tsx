"use client";

import { ArrowUpRight, CalendarDays, Info } from "lucide-react";
import { useState } from "react";
import { ReportPeriodChart } from "@/components/dashboard/microm/report-period-chart";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { MicromReportTable } from "@/lib/microm/business-report-sheet";
import { cn } from "@/lib/utils";

function number(value: string) {
  if (!value || /^[–—-]$/.test(value)) return null;
  const result = Number(value.replace(/[$,%()\s]/g, ""));
  return Number.isFinite(result)
    ? result * (value.includes("(") ? -1 : 1)
    : null;
}

export function ReportOverview({ table }: { table: MicromReportTable }) {
  const forecast = table.id === 715653195;
  const vn = table.id === 1267891236;
  const periods = forecast
    ? [
        { label: "Tháng 10", col: 1 },
        { label: "Tháng 11", col: 2 },
        { label: "Tháng 12", col: 3 },
        { label: "Quý IV", col: 4 },
      ]
    : vn
      ? [
          { label: "T07 · Tham chiếu", col: 1 },
          { label: "T08 · Báo cáo", col: 2 },
        ]
      : [
          { label: "Tháng 8", col: 2 },
          { label: "Tháng 9", col: 4 },
          { label: "Tổng T08–T09", col: 7 },
        ];
  const [selected, setSelected] = useState(String(periods.at(-1)?.col));
  const col = Number(selected);
  // Match source labels/codes rather than row positions; stop at the first PL section.
  const lookup = (key: string) =>
    table.rows.find((row) => row[0]?.trim() === key);
  const metrics = vn
    ? [
        { key: "Tổng cộng", label: "Tổng chi phí nguồn" },
        { key: "Lương", label: "Lương" },
        { key: "Trích trước tiền lương T13", label: "Trích trước T13" },
        { key: "CP VP OH — ghi PL một lần", label: "OH phân bổ · riêng" },
      ]
    : forecast
      ? [
          { key: "NET REVENUE", label: "Doanh thu thuần" },
          { key: "FIXED COST", label: "Chi phí cố định" },
          { key: "LỢI NHUẬN HĐKD", label: "Lợi nhuận hoạt động" },
          { key: "LỢI NHUẬN SAU THUẾ", label: "Lợi nhuận sau thuế" },
        ]
      : [
          { key: "II", label: "Doanh thu thuần" },
          { key: "III", label: "Chi phí biến đổi" },
          { key: "V", label: "Chi phí cố định" },
          { key: "E", label: "Lợi nhuận sau thuế" },
        ];
  const expenseKeys = forecast
    ? ["COGS", "Meta / Ads", "FIXED COST", "Sales bonus", "Thuế TNDN dự tính"]
    : ["III.0", "III.3", "V.4", "V.5", "V.7"];
  const expenses = vn
    ? table.rows.slice(3, 20)
    : expenseKeys.flatMap((key) => {
        const row = lookup(key);
        return row ? [row] : [];
      });
  const max = Math.max(
    1,
    ...expenses.map((row) => Math.abs(number(row[col] ?? "") ?? 0)),
  );
  const unit = vn ? "VND" : "USD";
  const display = (value: string) =>
    value ? value.replaceAll("$", "") : "Chưa có dữ liệu";
  const periodLabel = periods.find((period) => period.col === col)?.label;
  const chartData = periods
    .filter((period) => (forecast ? period.col !== 4 : period.col !== 7))
    .map((period) => ({
      name: period.label,
      revenue: number(lookup(metrics[0].key)?.[period.col] ?? ""),
      profit: number(lookup(metrics[3].key)?.[period.col] ?? ""),
    }));
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-5 py-2">
        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className="rounded-md border-slate-200 bg-slate-100 text-slate-600"
          >
            {forecast ? "Dự tính" : vn ? "Tham chiếu chi phí" : "Tạm tính"}
          </Badge>
          <span className="text-sm text-slate-500">
            {unit} <span className="mx-2 text-slate-300">/</span> 2026
          </span>
        </div>
        <div className="flex items-center gap-3">
          <CalendarDays className="size-4 text-slate-400" />
          <Select
            value={selected}
            onValueChange={(value) => {
              if (value) setSelected(value);
            }}
          >
            <SelectTrigger
              aria-label="Kỳ báo cáo"
              className="h-10 w-48 rounded-xl border-slate-200 bg-white px-4 shadow-none"
            >
              <SelectValue>{periodLabel}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {periods.map((period) => (
                <SelectItem key={period.col} value={String(period.col)}>
                  {period.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <Card className="overflow-hidden rounded-2xl border-slate-200/80 py-0 shadow-none">
        <CardContent className="grid p-0 md:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => {
            const value = lookup(metric.key)?.[col] ?? "";
            const negative = (number(value) ?? 0) < 0;
            return (
              <div
                key={metric.key}
                className={cn(
                  "min-w-0 border-b border-slate-100 p-6 last:border-0 md:odd:border-r xl:border-r xl:border-b-0",
                  index === 3 && "bg-[#eef3ff]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm text-slate-500">{metric.label}</p>
                  {index === 3 && (
                    <ArrowUpRight className="size-4 text-[#365d9d]" />
                  )}
                </div>
                <p
                  className={cn(
                    "mt-5 break-words text-3xl font-medium tracking-tight tabular-nums lg:text-[2rem]",
                    negative
                      ? "text-rose-700"
                      : index === 3
                        ? "text-[#244574]"
                        : "text-slate-900",
                    !value && "text-lg text-slate-400",
                  )}
                >
                  {display(value)}
                </p>
                <p className="mt-3 text-xs text-slate-400">
                  {unit} · {periodLabel}
                </p>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
        <Card className="min-w-0 rounded-2xl border-slate-200/80 py-0 shadow-none">
          <CardContent className="p-6 sm:p-8">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-medium tracking-tight">
                  {vn ? "Ghi chú đối chiếu" : "Doanh thu & lợi nhuận"}
                </h2>
                <p className="mt-1 text-xs text-slate-400">
                  {vn
                    ? "Thông tin kế toán từ nguồn"
                    : `So sánh theo tháng · ${unit}`}
                </p>
              </div>
              {!vn && (
                <div className="flex gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-sm bg-[#365d9d]" />
                    Doanh thu
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="size-2 rounded-sm bg-[#a5b8d8]" />
                    Lợi nhuận
                  </span>
                </div>
              )}
            </div>
            {vn ? (
              <div className="mt-6 divide-y divide-slate-100">
                {table.rows.slice(22, 28).map((row) => (
                  <div key={row[0]} className="py-4">
                    <p className="text-sm font-medium text-slate-700">
                      {row[0]}
                    </p>
                    <p className="mt-2 text-xs leading-relaxed text-slate-500">
                      {row[4]}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <ReportPeriodChart data={chartData} unit={unit} />
                <div className="mt-6 grid divide-y divide-slate-100 border-t border-slate-100 sm:grid-cols-2 sm:divide-y-0 sm:divide-x">
                  {[metrics[0], metrics[3]].map((metric) => (
                    <div key={metric.key} className="pt-5 sm:pl-5 first:pl-0">
                      <p className="text-xs text-slate-400">
                        {metric.label} · {periodLabel}
                      </p>
                      <p className="mt-2 text-lg font-medium tabular-nums">
                        {display(lookup(metric.key)?.[col] ?? "")}{" "}
                        <span className="text-xs font-normal text-slate-400">
                          {unit}
                        </span>
                      </p>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
        <Card className="rounded-2xl border-slate-200/80 py-0 shadow-none">
          <CardContent className="p-6 sm:p-8">
            <h2 className="text-lg font-medium tracking-tight">
              {vn ? "Khoản mục chi phí" : "Chi tiết chi phí"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {periodLabel} · {unit}
            </p>
            <div className="mt-6 divide-y divide-slate-100">
              {expenses.map((row, index) => {
                const value = row[col] ?? "";
                const numeric = number(value);
                return (
                  <div
                    key={`${row[0]}-${index}`}
                    className="py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-sm leading-snug text-slate-600">
                        {row[vn || forecast ? 0 : 1]}
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-slate-900">
                        {display(value)}
                      </span>
                    </div>
                    {numeric !== null && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full bg-[#7d99c4]"
                          style={{
                            width: `${(Math.abs(numeric) / max) * 100}%`,
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="flex items-start gap-3 rounded-xl bg-slate-100/70 px-4 py-3 text-xs leading-relaxed text-slate-500">
        <Info className="mt-0.5 size-4 shrink-0 text-slate-400" />
        <div>
          <p>{table.rows[forecast ? 1 : vn ? 1 : 2]?.[0]}</p>
          <p className="mt-1">
            Ô trống chưa có dữ liệu; dấu gạch giữ nguyên từ nguồn. Các khoản
            tham chiếu không được cộng lại vào tổng báo cáo.
          </p>
        </div>
      </div>
    </div>
  );
}
