"use client";

import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircle2Icon,
  DatabaseIcon,
  ExternalLinkIcon,
  Loader2Icon,
  RefreshCwIcon,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface MonthAndSyncControlsProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  availableMonths: string[];
  isProvisional: boolean;
  lastSyncedAt: Date | string | null;
  onSyncComplete: () => void;
}

export function MonthAndSyncControls({
  selectedMonth,
  onSelectMonth,
  availableMonths,
  isProvisional,
  lastSyncedAt,
  onSyncComplete,
}: MonthAndSyncControlsProps) {
  const [open, setOpen] = React.useState(false);
  const [isSyncing, setIsSyncing] = React.useState(false);
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [syncSuccess, setSyncSuccess] = React.useState<string | null>(null);

  const formattedLastSync = React.useMemo(() => {
    if (!lastSyncedAt) return "Chưa đồng bộ";
    const d = new Date(lastSyncedAt);
    return d.toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }, [lastSyncedAt]);

  const handleStartSync = async () => {
    try {
      setIsSyncing(true);
      setSyncError(null);
      setSyncSuccess(null);

      const response = await fetch("/api/ec/sheet-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || "Đồng bộ thất bại.");
      }

      setSyncSuccess(data.message || "Đồng bộ dữ liệu thành công!");
      onSyncComplete();
      setTimeout(() => {
        setOpen(false);
        setSyncSuccess(null);
      }, 1800);
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Lỗi không xác định khi đồng bộ.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-2.5 sm:p-3 rounded-xl border border-border/60 backdrop-blur-xs">
      {/* Month Selector */}
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
          Kỳ báo cáo:
        </span>
        <div className="relative">
          <select
            value={selectedMonth}
            onChange={(e) => onSelectMonth(e.target.value)}
            className="h-8 rounded-lg bg-background border border-border/80 px-2.5 text-xs font-semibold text-foreground focus:outline-hidden focus:ring-1 focus:ring-primary shadow-2xs cursor-pointer"
          >
            {availableMonths.map((m) => {
              const [y, mon] = m.split("-");
              return (
                <option key={m} value={m}>
                  Tháng {Number.parseInt(mon, 10)}/{y}
                </option>
              );
            })}
          </select>
        </div>
        {isProvisional && (
          <Badge
            variant="outline"
            className="text-[10px] font-mono border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 py-0.5"
          >
            Tạm tính
          </Badge>
        )}
      </div>

      {/* Sync from Google Sheet Trigger */}
      <div className="flex items-center gap-2 sm:gap-3">
        <div className="text-[11px] text-muted-foreground hidden md:block">
          Cập nhật:{" "}
          <span className="font-mono text-foreground font-medium">
            {formattedLastSync}
          </span>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600"
              >
                <RefreshCwIcon className="size-3.5 text-emerald-500" />
                <span>Đồng bộ từ Google Sheet</span>
              </Button>
            }
          />

          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <DatabaseIcon className="size-4 text-emerald-500" />
                Đồng bộ từ EC Google Sheet vào Dashboard
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Hệ thống sẽ đọc trực tiếp 4 trang tính (<b>Orders</b>,{" "}
                <b>COGS</b>, <b>Ads</b>, <b>Payouts</b>) từ Google Spreadsheet
                để cập nhật số liệu chuẩn hóa vào cơ sở dữ liệu.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2 text-xs">
              <div className="p-3 bg-muted/40 rounded-lg border border-border/50 space-y-1.5">
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Nguồn Google Sheet:</span>
                  <a
                    href="https://docs.google.com/spreadsheets/d/19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8/edit"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-mono"
                  >
                    19QrKNM6...P5g8
                    <ExternalLinkIcon className="size-3" />
                  </a>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Lần sync thành công gần nhất:</span>
                  <span className="font-mono text-foreground">
                    {formattedLastSync}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Cơ chế bảo vệ:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Atomic Snapshot Switch
                  </span>
                </div>
              </div>

              {syncError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 flex items-start gap-2">
                  <AlertCircleIcon className="size-4 shrink-0 mt-0.5" />
                  <div className="text-xs leading-relaxed">{syncError}</div>
                </div>
              )}

              {syncSuccess && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center gap-2">
                  <CheckCircle2Icon className="size-4 shrink-0" />
                  <div className="text-xs font-medium">{syncSuccess}</div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isSyncing}
                className="text-xs"
              >
                Hủy
              </Button>
              <Button
                size="sm"
                onClick={handleStartSync}
                disabled={isSyncing}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white"
              >
                {isSyncing ? (
                  <>
                    <Loader2Icon className="size-3.5 animate-spin" />
                    <span>Đang nạp dữ liệu (~5-10s)...</span>
                  </>
                ) : (
                  <>
                    <RefreshCwIcon className="size-3.5" />
                    <span>Bắt đầu đồng bộ</span>
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
