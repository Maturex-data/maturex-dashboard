"use client";

import {
  CheckIcon,
  DatabaseIcon,
  RefreshCwIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  Trash2Icon,
} from "lucide-react";
import { SectionCard } from "@/components/shared/section-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { sourceConfigs, sources } from "./types";

interface FlSyncConfigCardProps {
  selectedSources: string[];
  onToggleSource: (source: string) => void;
  rangeType: "month" | "month-range" | "date";
  onRangeTypeChange: (type: "month" | "month-range" | "date") => void;
  month: string;
  onMonthChange: (val: string) => void;
  fromMonth: string;
  onFromMonthChange: (val: string) => void;
  toMonth: string;
  onToMonthChange: (val: string) => void;
  fromDate: string;
  onFromDateChange: (val: string) => void;
  toDate: string;
  onToDateChange: (val: string) => void;
  clearing: boolean;
  onClearReport: () => Promise<void>;
}

export function FlSyncConfigCard({
  selectedSources,
  onToggleSource,
  rangeType,
  onRangeTypeChange,
  month,
  onMonthChange,
  fromMonth,
  onFromMonthChange,
  toMonth,
  onToMonthChange,
  fromDate,
  onFromDateChange,
  toDate,
  onToDateChange,
  clearing,
  onClearReport,
}: FlSyncConfigCardProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-6">
        {/* Sources Selection */}
        <SectionCard
          title="1. Chọn tab để quản trị"
          description="Dùng để chọn các tab khi cần xóa dữ liệu nguồn từ dòng 2."
          icon={
            <DatabaseIcon className="size-4 text-purple-600 dark:text-purple-400" />
          }
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {sources.map((source) => {
              const conf = sourceConfigs[source];
              const active = selectedSources.includes(source);
              return (
                <button
                  key={source}
                  type="button"
                  onClick={() => onToggleSource(source)}
                  className={`flex flex-col items-start p-4 rounded-xl border text-left transition-all ${
                    active
                      ? `${conf.activeBorder} ${conf.activeBg} ring-1 ring-purple-500/20 shadow-xs`
                      : "border-border/60 bg-card hover:border-border hover:bg-muted/30"
                  }`}
                >
                  <div className="flex w-full items-center justify-between gap-2 mb-1.5">
                    <span className="font-semibold text-sm text-foreground">
                      {conf.label}
                    </span>
                    <div
                      className={`size-5 rounded-md border flex items-center justify-center transition-colors ${
                        active
                          ? "bg-purple-600 border-purple-600 text-white"
                          : "border-muted-foreground/30 bg-background"
                      }`}
                    >
                      {active && <CheckIcon className="size-3.5 stroke-[3]" />}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {conf.description}
                  </p>
                </button>
              );
            })}
          </div>
        </SectionCard>

        {/* Range Configuration */}
        <SectionCard
          title="2. Khoảng thời gian Fastway"
          description="Chỉ dùng khi kéo dữ liệu Fastway từ API. File Etsy và COGS được nạp trực tiếp vào Google Sheet."
          icon={
            <SlidersHorizontalIcon className="size-4 text-purple-600 dark:text-purple-400" />
          }
        >
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <Button
                type="button"
                variant={rangeType === "month" ? "default" : "outline"}
                size="sm"
                onClick={() => onRangeTypeChange("month")}
                className={
                  rangeType === "month"
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "text-muted-foreground"
                }
              >
                Theo tháng
              </Button>
              <Button
                type="button"
                variant={rangeType === "month-range" ? "default" : "outline"}
                size="sm"
                onClick={() => onRangeTypeChange("month-range")}
                className={
                  rangeType === "month-range"
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "text-muted-foreground"
                }
              >
                Khoảng tháng
              </Button>
              <Button
                type="button"
                variant={rangeType === "date" ? "default" : "outline"}
                size="sm"
                onClick={() => onRangeTypeChange("date")}
                className={
                  rangeType === "date"
                    ? "bg-purple-600 text-white hover:bg-purple-700"
                    : "text-muted-foreground"
                }
              >
                Khoảng ngày
              </Button>
            </div>

            {rangeType === "month" && (
              <div className="space-y-1.5">
                <Label htmlFor="month-picker" className="text-xs font-semibold">
                  Tháng cần đồng bộ
                </Label>
                <Input
                  id="month-picker"
                  type="month"
                  value={month}
                  onChange={(e) => onMonthChange(e.target.value)}
                  className="h-10 rounded-xl"
                />
              </div>
            )}

            {rangeType === "month-range" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from-month" className="text-xs font-semibold">
                    Từ tháng
                  </Label>
                  <Input
                    id="from-month"
                    type="month"
                    value={fromMonth}
                    onChange={(e) => onFromMonthChange(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to-month" className="text-xs font-semibold">
                    Đến tháng
                  </Label>
                  <Input
                    id="to-month"
                    type="month"
                    value={toMonth}
                    onChange={(e) => onToMonthChange(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
            )}

            {rangeType === "date" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="from-date" className="text-xs font-semibold">
                    Từ ngày
                  </Label>
                  <Input
                    id="from-date"
                    type="date"
                    value={fromDate}
                    onChange={(e) => onFromDateChange(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="to-date" className="text-xs font-semibold">
                    Đến ngày
                  </Label>
                  <Input
                    id="to-date"
                    type="date"
                    value={toDate}
                    onChange={(e) => onToDateChange(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
              </div>
            )}
          </div>
        </SectionCard>
      </div>

      {/* Sync Actions & Quick Tips */}
      <div className="space-y-6">
        <SectionCard
          title="Quản trị dữ liệu Sheet"
          description="Dữ liệu Statement và COGS được nạp trực tiếp từ file nguồn vào Google Sheet."
          icon={
            <RefreshCwIcon className="size-4 text-purple-600 dark:text-purple-400" />
          }
        >
          <div className="space-y-4">
            <Button
              disabled={clearing}
              variant="outline"
              onClick={onClearReport}
              className="w-full h-10 gap-2 rounded-xl border-border/80 text-muted-foreground hover:text-destructive hover:bg-destructive/10 hover:border-destructive/30 transition-all"
            >
              <Trash2Icon className="size-3.5" />
              <span>Xóa dữ liệu (từ dòng 2)</span>
            </Button>

            <div className="rounded-xl border border-purple-500/20 bg-purple-500/[0.04] p-4 text-xs space-y-2 text-muted-foreground">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <SparklesIcon className="size-3.5 text-purple-500" />
                Luồng dữ liệu hiện tại:
              </p>
              <ol className="list-decimal pl-4 space-y-1">
                <li>
                  Nhấn nút <b>Import dữ liệu Etsy</b> để nạp file Statement,
                  COGS và Claim trực tiếp vào Google Sheet.
                </li>
                <li>
                  Công thức báo cáo trên Sheet sẽ tự cập nhật sau khi nạp xong.
                </li>
                <li>
                  Database hiện tại được giữ nguyên; luồng đọc Sheet về DB sẽ
                  được bổ sung ở giai đoạn sau.
                </li>
              </ol>
            </div>
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
