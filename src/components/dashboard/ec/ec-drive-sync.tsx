"use client";

import {
  CalendarDaysIcon,
  CheckIcon,
  InfoIcon,
  PlayIcon,
  SlidersHorizontalIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  type DriveConnectionInfo,
  EcDriveConnectionCard,
} from "./ec-drive-connection-card";
import { type DriveRun, EcDriveSyncHistory } from "./ec-drive-sync-history";

const sources = ["Orders", "COGS", "Ads", "Payouts"];

const sourceConfigs: Record<
  string,
  {
    label: string;
    description: string;
    tag: string;
    activeBorder: string;
    activeBg: string;
    badgeBg: string;
    iconColor: string;
  }
> = {
  Orders: {
    label: "Orders",
    description: "Shopify Raw Orders, Discounts & Taxes",
    tag: "RAW.ORDER",
    activeBorder: "border-sky-500/50 dark:border-sky-500/60",
    activeBg: "bg-sky-500/[0.06] shadow-sky-500/5",
    badgeBg: "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  COGS: {
    label: "COGS",
    description: "PGPrint, Printify, Printful, Luxury Pro",
    tag: "RAW.COGS",
    activeBorder: "border-amber-500/50 dark:border-amber-500/60",
    activeBg: "bg-amber-500/[0.06] shadow-amber-500/5",
    badgeBg:
      "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
    iconColor: "text-amber-600 dark:text-amber-400",
  },
  Ads: {
    label: "Ads Spend",
    description: "Meta Ads daily spend & campaigns",
    tag: "META_ADS",
    activeBorder: "border-purple-500/50 dark:border-purple-500/60",
    activeBg: "bg-purple-500/[0.06] shadow-purple-500/5",
    badgeBg:
      "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20",
    iconColor: "text-purple-600 dark:text-purple-400",
  },
  Payouts: {
    label: "Payouts",
    description: "Shopify Payments settlements & fees",
    tag: "RAW.PAYOUT",
    activeBorder: "border-emerald-500/50 dark:border-emerald-500/60",
    activeBg: "bg-emerald-500/[0.06] shadow-emerald-500/5",
    badgeBg:
      "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
    iconColor: "text-emerald-600 dark:text-emerald-400",
  },
};

export function EcDriveSync({
  connection,
  runs,
  notice,
}: {
  connection: DriveConnectionInfo | null;
  runs: DriveRun[];
  notice?: { type: "success" | "error"; message: string };
}) {
  const router = useRouter();
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>(sources);

  const currentDate = new Date(Date.now() + 7 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
  const [rangeType, setRangeType] = useState<"month" | "date">("month");
  const [fromMonth, setFromMonth] = useState(currentDate.slice(0, 7));
  const [toMonth, setToMonth] = useState(currentDate.slice(0, 7));
  const [fromDate, setFromDate] = useState(`${currentDate.slice(0, 8)}01`);
  const [toDate, setToDate] = useState(currentDate);

  async function disconnect(): Promise<void> {
    setDisconnecting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/ec/drive/disconnect", {
        method: "POST",
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Không thể ngắt kết nối Google Drive.");
      router.refresh();
    } catch (disconnectError) {
      setError(
        disconnectError instanceof Error
          ? disconnectError.message
          : "Không thể ngắt kết nối Google Drive.",
      );
    } finally {
      setDisconnecting(false);
    }
  }

  async function createSync(): Promise<void> {
    setSyncing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/ec/drive/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shop: "The Deerly",
          rangeType,
          fromMonth,
          toMonth,
          fromDate,
          toDate,
          sources: selectedSources,
        }),
      });
      const body = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(body.error || "Không thể khởi tạo tiến trình đồng bộ.");
      setSuccess("Đã bắt đầu tiến trình đồng bộ dữ liệu vào Google Sheet.");
      router.refresh();
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Không thể khởi tạo tiến trình đồng bộ.",
      );
    } finally {
      setSyncing(false);
    }
  }

  async function clearReportData(): Promise<void> {
    if (
      !window.confirm(
        "Cảnh báo: Thao tác này sẽ xóa trắng dữ liệu từ dòng 2 trên 4 tab (Orders, COGS, Ads, Payouts) nhưng giữ nguyên tiêu đề và công thức. Bạn có chắc chắn muốn tiếp tục?",
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/ec/drive/clear-report", {
        method: "POST",
      });
      const body = (await response.json()) as {
        cleared?: number;
        error?: string;
      };
      if (!response.ok)
        throw new Error(body.error || "Không thể dọn dẹp các tab dữ liệu.");
      setSuccess(
        `Đã xóa trắng an toàn ${body.cleared || 0} ô dữ liệu trên 4 tab.`,
      );
      router.refresh();
    } catch (clearError) {
      setError(
        clearError instanceof Error
          ? clearError.message
          : "Không thể dọn dẹp các tab dữ liệu.",
      );
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Notifications / Alerts */}
      {(notice || error || success) && (
        <div
          className={`flex items-start gap-3 rounded-xl border p-4 text-sm shadow-xs transition-all ${
            notice?.type === "success" || success
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          <InfoIcon className="size-4 shrink-0 mt-0.5" />
          <div className="flex-1 font-medium leading-relaxed">
            {error || success || notice?.message}
          </div>
        </div>
      )}

      {/* Target Destination Connection Card */}
      <EcDriveConnectionCard
        connection={connection}
        disconnecting={disconnecting}
        onDisconnect={disconnect}
      />

      {/* Main Workspace Grid: Controls & History */}
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        {/* Form Card using shared SectionCard */}
        <SectionCard
          icon={<SlidersHorizontalIcon className="size-3.5 stroke-[2.2]" />}
          title="Cấu hình phiên đồng bộ"
          action={
            <Badge
              variant="outline"
              className="bg-muted/80 px-2.5 py-0.5 text-xs font-medium text-muted-foreground border-border/60"
            >
              Ghi đè theo phạm vi
            </Badge>
          }
          contentClassName="p-6 space-y-5"
          footer={
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                {selectedSources.length ? (
                  <>
                    Sẽ đồng bộ{" "}
                    <strong className="text-foreground">
                      {selectedSources.length} tab
                    </strong>{" "}
                    (
                    {rangeType === "month"
                      ? `${fromMonth} → ${toMonth}`
                      : `${fromDate} → ${toDate}`}
                    )
                  </>
                ) : (
                  "Vui lòng chọn ít nhất một tab để đồng bộ."
                )}
              </span>

              <div className="flex items-center gap-2.5 self-end sm:self-auto">
                <Button
                  type="button"
                  disabled={!connection || clearing || syncing}
                  onClick={clearReportData}
                  size="sm"
                  variant="outline"
                  className="h-9 gap-1.5 rounded-xl border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                >
                  <Trash2Icon
                    className={`size-3.5 ${clearing ? "animate-spin" : ""}`}
                  />
                  <span>{clearing ? "Đang xóa…" : "Xóa dữ liệu"}</span>
                </Button>

                <Button
                  type="button"
                  disabled={
                    !connection ||
                    selectedSources.length === 0 ||
                    syncing ||
                    clearing
                  }
                  onClick={createSync}
                  size="sm"
                  className="h-9 gap-2 rounded-xl bg-emerald-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all"
                >
                  <PlayIcon
                    className={`size-3.5 ${syncing ? "animate-spin" : ""}`}
                  />
                  <span>{syncing ? "Đang xử lý…" : "Chạy đồng bộ"}</span>
                </Button>
              </div>
            </div>
          }
        >
          {/* Scope / Range Switcher */}
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Phạm vi đồng bộ
            </Label>
            <div className="inline-flex rounded-xl border border-border bg-muted/60 p-1 text-xs shadow-2xs">
              <button
                type="button"
                onClick={() => setRangeType("month")}
                className={`rounded-lg px-3.5 py-1 font-semibold transition-all ${
                  rangeType === "month"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Theo tháng
              </button>
              <button
                type="button"
                onClick={() => setRangeType("date")}
                className={`rounded-lg px-3.5 py-1 font-semibold transition-all ${
                  rangeType === "date"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Khoảng ngày
              </button>
            </div>
          </div>

          {/* Date / Month Inputs */}
          {rangeType === "month" ? (
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Từ tháng
                </Label>
                <Input
                  type="month"
                  value={fromMonth}
                  onChange={(e) => setFromMonth(e.target.value)}
                  className="h-9.5 text-xs rounded-xl border-border bg-background/80 font-medium focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Đến tháng
                </Label>
                <Input
                  type="month"
                  value={toMonth}
                  onChange={(e) => setToMonth(e.target.value)}
                  className="h-9.5 text-xs rounded-xl border-border bg-background/80 font-medium focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Từ ngày
                </Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                  className="h-9.5 text-xs rounded-xl border-border bg-background/80 font-medium focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Đến ngày
                </Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                  className="h-9.5 text-xs rounded-xl border-border bg-background/80 font-medium focus-visible:ring-emerald-500/30 focus-visible:border-emerald-500"
                />
              </div>
            </div>
          )}

          {/* Target Sheets Selector */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Nguồn dữ liệu & Tab báo cáo
              </Label>
              <button
                type="button"
                onClick={() =>
                  setSelectedSources(
                    selectedSources.length === sources.length ? [] : sources,
                  )
                }
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 underline underline-offset-4"
              >
                {selectedSources.length === sources.length
                  ? "Bỏ chọn tất cả"
                  : "Chọn tất cả"}
              </button>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {sources.map((source) => {
                const isSelected = selectedSources.includes(source);
                const config = sourceConfigs[source];
                return (
                  <button
                    key={source}
                    type="button"
                    onClick={() =>
                      setSelectedSources((prev) =>
                        isSelected
                          ? prev.filter((s) => s !== source)
                          : [...prev, source],
                      )
                    }
                    className={`group relative flex flex-col justify-between rounded-xl border p-3.5 text-left transition-all overflow-hidden ${
                      isSelected
                        ? `${config.activeBorder} ${config.activeBg} shadow-xs ring-1 ring-emerald-500/20`
                        : "border-border/70 bg-card hover:border-border hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-foreground">
                        {config.label}
                      </span>
                      <div
                        className={`flex size-4.5 items-center justify-center rounded-md border transition-all ${
                          isSelected
                            ? "border-emerald-600 bg-emerald-600 text-white shadow-2xs"
                            : "border-muted-foreground/30 bg-background"
                        }`}
                      >
                        {isSelected && (
                          <CheckIcon className="size-3 stroke-[2.5]" />
                        )}
                      </div>
                    </div>
                    <span className="mt-1.5 text-[11px] font-medium text-muted-foreground leading-snug">
                      {config.description}
                    </span>
                    <span
                      className={`mt-2.5 inline-flex w-fit rounded-md border px-2 py-0.5 font-mono text-[10px] font-semibold shadow-2xs ${config.badgeBg}`}
                    >
                      {config.tag}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </SectionCard>

        {/* Sync History Table */}
        <EcDriveSyncHistory runs={runs} />
      </div>

      {/* Safety Notice Footer */}
      <div className="flex items-center gap-3 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.04] p-3 text-xs text-muted-foreground">
        <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
          <CalendarDaysIcon className="size-3.5 stroke-[2.2]" />
        </div>
        <span>
          <strong className="text-foreground">Cơ chế an toàn:</strong> Tiêu đề
          bảng tính, định dạng số tiền và toàn bộ công thức P&L kế toán trong
          Google Sheets được bảo toàn nguyên vẹn.
        </span>
      </div>
    </div>
  );
}
