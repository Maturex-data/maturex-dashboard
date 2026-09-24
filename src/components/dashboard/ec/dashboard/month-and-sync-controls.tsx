"use client";

import {
  AlertCircleIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  HistoryIcon,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface MonthAndSyncControlsProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  availableMonths: string[];
  isProvisional: boolean;
  lastSyncedAt: Date | string | null;
  onSyncComplete: () => void;
}

interface ImportRunItem {
  id: string;
  triggerType: "MANUAL" | "CRON";
  status: string;
  startedAt: string;
  completedAt: string | null;
  totalRows: number;
  insertedRows: number;
  actor: string | null;
  errorMessage: string | null;
  errorCategory: string | null;
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
  const [recentRuns, setRecentRuns] = React.useState<ImportRunItem[]>([]);
  const [isCurrentlyRunning, setIsCurrentlyRunning] = React.useState(false);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [lastCheckedAt, setLastCheckedAt] = React.useState<string | null>(null);
  const [lastDataChangeAt, setLastDataChangeAt] = React.useState<string | null>(
    null,
  );

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

  const fetchStatusHistory = React.useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const res = await fetch("/api/ec/sheet-import/status");
      const json = await res.json();
      if (json.success) {
        setRecentRuns(json.latestRuns || []);
        setIsCurrentlyRunning(Boolean(json.isCurrentlyRunning));
        setLastCheckedAt(json.lastCheckedAt || null);
        setLastDataChangeAt(json.lastDataChangeAt || null);
      }
    } catch {
      // Ignore background status fetch error
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => {
    if (open) {
      fetchStatusHistory();
    }
  }, [open, fetchStatusHistory]);

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
      fetchStatusHistory();

      setTimeout(() => {
        setOpen(false);
        setSyncSuccess(null);
      }, 2000);
    } catch (err) {
      setSyncError(
        err instanceof Error ? err.message : "Lỗi không xác định khi đồng bộ.",
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const formatVnTime = (isoString?: string | null) => {
    if (!isoString) return "—";
    return new Date(isoString).toLocaleString("vi-VN", {
      timeZone: "Asia/Ho_Chi_Minh",
      hour: "2-digit",
      minute: "2-digit",
      day: "2-digit",
      month: "2-digit",
    });
  };

  const latestRun = recentRuns[0];
  const hasLatestRunFailed = latestRun && latestRun.status === "FAILED";

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 bg-card/60 p-2.5 sm:p-3 rounded-xl border border-border/60 backdrop-blur-xs">
      {/* Month Selector */}
      <div className="flex items-center gap-2">
        <CalendarIcon className="size-4 text-muted-foreground shrink-0" />
        <span className="text-xs font-medium text-muted-foreground hidden sm:inline">
          Kỳ báo cáo:
        </span>
        <Select
          value={selectedMonth}
          onValueChange={(val) => {
            if (val) onSelectMonth(val);
          }}
        >
          <SelectTrigger className="h-8 w-auto min-w-[130px] gap-2 rounded-lg bg-background border-border/80 px-2.5 text-xs font-semibold text-foreground shadow-2xs">
            <SelectValue placeholder="Chọn kỳ" />
          </SelectTrigger>
          <SelectContent align="start">
            {availableMonths.map((m) => {
              const [y, mon] = m.split("-");
              return (
                <SelectItem key={m} value={m} className="text-xs font-medium">
                  Tháng {Number.parseInt(mon, 10)}/{y}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
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
        <div className="text-[11px] text-muted-foreground hidden md:flex items-center gap-1.5">
          <span>Kiểm tra:</span>
          <span className="font-mono text-foreground font-medium">
            {lastCheckedAt ? formatVnTime(lastCheckedAt) : formattedLastSync}
          </span>
          {hasLatestRunFailed && (
            <Badge
              variant="outline"
              className="text-[10px] border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 ml-1 py-0"
            >
              Lỗi đồng bộ gần nhất
            </Badge>
          )}
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs font-medium border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 cursor-pointer"
              >
                <RefreshCwIcon className="size-3.5 text-emerald-500" />
                <span>Đồng bộ từ Google Sheet</span>
              </Button>
            }
          />

          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-base">
                <DatabaseIcon className="size-4 text-emerald-500" />
                Đồng bộ từ EC Google Sheet vào Dashboard
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                Hệ thống nạp trực tiếp 4 trang tính (<b>Orders</b>, <b>COGS</b>,{" "}
                <b>Ads</b>, <b>Payouts</b>) theo cơ chế khóa nguyên tử và
                snapshot switch để không gián đoạn người dùng.
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
                  <span>Lần kiểm tra thành công:</span>
                  <span className="font-mono text-foreground">
                    {lastCheckedAt
                      ? formatVnTime(lastCheckedAt)
                      : formattedLastSync}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Dữ liệu thay đổi gần nhất:</span>
                  <span className="font-mono text-foreground">
                    {lastDataChangeAt
                      ? formatVnTime(lastDataChangeAt)
                      : formattedLastSync}
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Lịch chạy tự động (Cron):</span>
                  <span className="font-mono text-foreground text-[11px]">
                    08:00, 12:00, 21:00 (GMT+7)
                  </span>
                </div>
                <div className="flex justify-between items-center text-muted-foreground">
                  <span>Bảo vệ:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    DB Atomic Lock & Fingerprinting
                  </span>
                </div>
              </div>

              {isCurrentlyRunning && (
                <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center gap-2 text-xs">
                  <Loader2Icon className="size-4 shrink-0 animate-spin" />
                  <span>
                    Một tiến trình đồng bộ đang chạy trên hệ thống. Vui lòng đợi
                    hoàn tất trước khi kích hoạt thủ công.
                  </span>
                </div>
              )}

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

              {/* Recent Run History List */}
              <div className="space-y-1.5 pt-1">
                <div className="flex items-center justify-between text-muted-foreground text-[11px] font-medium px-0.5">
                  <div className="flex items-center gap-1.5">
                    <HistoryIcon className="size-3.5" />
                    <span>Lịch sử đồng bộ gần nhất:</span>
                  </div>
                  {isLoadingHistory && (
                    <span className="text-[10px] text-muted-foreground">
                      Đang tải...
                    </span>
                  )}
                </div>

                <div className="max-h-36 overflow-y-auto space-y-1 border border-border/50 rounded-lg p-1.5 bg-muted/20">
                  {recentRuns.length === 0 ? (
                    <div className="text-center py-2 text-muted-foreground text-[11px]">
                      Chưa có lịch sử đồng bộ.
                    </div>
                  ) : (
                    recentRuns.slice(0, 4).map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between p-1.5 rounded-md hover:bg-muted/40 text-[11px] gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <Badge
                            variant="outline"
                            className={`text-[9px] px-1 py-0 uppercase font-mono ${
                              r.triggerType === "CRON"
                                ? "border-sky-500/40 text-sky-600 dark:text-sky-400 bg-sky-500/10"
                                : "border-purple-500/40 text-purple-600 dark:text-purple-400 bg-purple-500/10"
                            }`}
                          >
                            {r.triggerType}
                          </Badge>
                          <span className="text-muted-foreground flex items-center gap-1 truncate font-mono text-[10px]">
                            <ClockIcon className="size-3 shrink-0" />
                            {formatVnTime(r.startedAt)}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <span
                            className={`font-medium ${
                              r.status === "COMPLETED"
                                ? "text-emerald-600 dark:text-emerald-400"
                                : r.status === "FAILED"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-amber-600 dark:text-amber-400"
                            }`}
                          >
                            {r.status === "COMPLETED"
                              ? `${r.totalRows.toLocaleString()} dòng`
                              : r.status}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setOpen(false)}
                disabled={isSyncing}
                className="text-xs"
              >
                Đóng
              </Button>
              <Button
                size="sm"
                onClick={handleStartSync}
                disabled={isSyncing || isCurrentlyRunning}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
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
