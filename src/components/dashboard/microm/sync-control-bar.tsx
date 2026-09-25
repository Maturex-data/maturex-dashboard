"use client";

import {
  AlertTriangleIcon,
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  DatabaseIcon,
  RefreshCwIcon,
  SparklesIcon,
  Trash2Icon,
  XIcon,
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
} from "@/components/ui/dialog";
import type { MicromMonthOption } from "@/lib/microm/dashboard-queries";

interface SyncControlBarProps {
  selectedMonth: string;
  onSelectMonth: (month: string) => void;
  availableMonths: MicromMonthOption[];
  isProviderReconciled?: boolean;
  lastCheckedAt?: string;
  activeRunId?: string;
  onActionComplete?: () => void;
}

export function SyncControlBar({
  selectedMonth,
  onSelectMonth,
  availableMonths,
  isProviderReconciled,
  lastCheckedAt,
  activeRunId,
  onActionComplete,
}: SyncControlBarProps) {
  const [syncingProvider, setSyncingProvider] = React.useState(false);
  const [importingSheet, setImportingSheet] = React.useState(false);
  const [clearingSheet, setClearingSheet] = React.useState(false);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [actionMessage, setActionMessage] = React.useState<{
    type: "success" | "error" | "info";
    text: string;
  } | null>(null);

  const handleSyncProvider = async () => {
    setSyncingProvider(true);
    setActionMessage({
      type: "info",
      text: "Đang đồng bộ dữ liệu từ Shopify, PGPrint, Meta vào Google Sheet...",
    });
    try {
      const res = await fetch("/api/microm/sync-provider", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success && json.data?.isReconciled) {
        setActionMessage({
          type: "success",
          text: "Đồng bộ Provider → Google Sheet và đối soát thành công!",
        });
        onActionComplete?.();
      } else if (json.data?.status === "PARTIAL_SUCCESS") {
        setActionMessage({
          type: "error",
          text: `Đồng bộ chưa hoàn tất (PARTIAL_SUCCESS): ${
            json.data?.errors?.join("; ") || json.error || "Có lỗi phát sinh"
          }`,
        });
        onActionComplete?.();
      } else {
        setActionMessage({
          type: "error",
          text: `Lỗi: ${json.error || "Đồng bộ thất bại"}`,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMessage({ type: "error", text: `Lỗi kết nối: ${msg}` });
    } finally {
      setSyncingProvider(false);
    }
  };

  const handleImportSheet = async () => {
    setImportingSheet(true);
    setActionMessage({
      type: "info",
      text: "Đang kiểm tra Google Sheet và cập nhật snapshot DB...",
    });
    try {
      const res = await fetch("/api/microm/import-sheet", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          type: "success",
          text: json.data?.message || "Import Sheet → DB snapshot thành công!",
        });
        onActionComplete?.();
      } else {
        setActionMessage({
          type: "error",
          text: `Lỗi: ${json.error || "Import thất bại"}`,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMessage({ type: "error", text: `Lỗi kết nối: ${msg}` });
    } finally {
      setImportingSheet(false);
    }
  };

  const handleClearSheet = async () => {
    setClearingSheet(true);
    setConfirmOpen(false);
    setActionMessage({
      type: "info",
      text: "Đang xóa dữ liệu dòng 2 trên Google Sheet (giữ nguyên công thức)...",
    });
    try {
      const res = await fetch("/api/microm/clear-sheet", { method: "POST" });
      const json = await res.json();
      if (res.ok && json.success) {
        setActionMessage({
          type: "success",
          text: json.message || "Đã xóa dữ liệu trên Google Sheet thành công!",
        });
        onActionComplete?.();
      } else {
        setActionMessage({
          type: "error",
          text: `Lỗi: ${json.error || "Không thể dọn dẹp các tab dữ liệu trên Google Sheet."}`,
        });
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setActionMessage({ type: "error", text: `Lỗi kết nối: ${msg}` });
    } finally {
      setClearingSheet(false);
    }
  };

  const formattedLastChecked = lastCheckedAt
    ? new Date(lastCheckedAt).toLocaleString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
        day: "2-digit",
        month: "2-digit",
      })
    : "Chưa kiểm tra";

  return (
    <div className="space-y-2.5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 p-3.5 sm:px-4 rounded-xl border border-border/60 bg-card/60 backdrop-blur-sm">
        {/* Left: Month selection & Reconciliation badge */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-2.5 py-1 border border-border/50">
            <CalendarIcon className="size-3.5 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">
              Kỳ:
            </span>
            <select
              value={selectedMonth}
              onChange={(e) => onSelectMonth(e.target.value)}
              className="h-7 text-xs font-semibold bg-transparent focus:outline-none cursor-pointer pr-1 text-foreground"
            >
              {availableMonths.map((m) => (
                <option
                  key={m.value}
                  value={m.value}
                  className="bg-popover text-foreground"
                >
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          {isProviderReconciled ? (
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[11px] gap-1 py-1"
            >
              <CheckCircle2Icon className="size-3" />
              Đã đối soát với Provider
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-amber-500/10 text-amber-400 border-amber-500/20 text-[11px] py-1"
            >
              Chờ đối soát thủ công
            </Badge>
          )}

          {activeRunId && (
            <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono">
              <ClockIcon className="size-3" />
              <span>Cập nhật: {formattedLastChecked}</span>
              <span className="text-muted-foreground/50">
                ({activeRunId.slice(0, 8)})
              </span>
            </div>
          )}
        </div>

        {/* Right: Explicit Manual Actions */}
        <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
          <Button
            variant="outline"
            size="sm"
            disabled={syncingProvider || importingSheet || clearingSheet}
            onClick={() => setConfirmOpen(true)}
            className="h-8 text-xs gap-1.5 border-border/60 text-muted-foreground hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
          >
            <Trash2Icon
              className={`size-3 ${clearingSheet ? "animate-spin text-destructive" : ""}`}
            />
            <span>{clearingSheet ? "Đang xóa…" : "Xóa dữ liệu Sheet"}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={syncingProvider || importingSheet || clearingSheet}
            onClick={handleSyncProvider}
            className="h-8 text-xs gap-1.5 border-border/60 hover:bg-muted/60"
          >
            <RefreshCwIcon
              className={`size-3 text-sky-400 ${syncingProvider ? "animate-spin" : ""}`}
            />
            <span>1. Sync Provider → Sheet</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            disabled={syncingProvider || importingSheet || clearingSheet}
            onClick={handleImportSheet}
            className="h-8 text-xs gap-1.5 shadow-sm"
          >
            <DatabaseIcon
              className={`size-3 ${importingSheet ? "animate-spin" : ""}`}
            />
            <span>2. Import Sheet → DB</span>
          </Button>
        </div>
      </div>

      {/* Confirmation Dialog for Clearing Google Sheet Data */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-400 mb-1">
              <AlertTriangleIcon className="size-5 shrink-0" />
              <DialogTitle className="text-base">
                Xác nhận xóa dữ liệu Google Sheet
              </DialogTitle>
            </div>
            <DialogDescription className="text-sm leading-relaxed text-muted-foreground space-y-2 pt-1">
              <span className="block">
                Thao tác này sẽ{" "}
                <strong className="text-foreground">
                  xóa sạch dữ liệu từ dòng 2
                </strong>{" "}
                của cả 4 tab:
              </span>
              <span className="inline-block px-2.5 py-1 rounded-md bg-muted text-xs font-mono font-medium text-foreground">
                Orders · COGS · Ads · Shopify_Items
              </span>
              <span className="block text-emerald-400 text-xs font-medium">
                ✓ Tiêu đề (dòng 1) và toàn bộ các ô chứa công thức (=...) sẽ
                được giữ nguyên an toàn.
              </span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0 mt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmOpen(false)}
              disabled={clearingSheet}
            >
              Hủy
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleClearSheet}
              disabled={clearingSheet}
              className="gap-1.5"
            >
              <Trash2Icon className="size-3.5" />
              Xác nhận xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Action Notification Banner */}
      {actionMessage && (
        <div
          className={`text-xs px-3.5 py-2 rounded-lg border flex items-center justify-between gap-2 transition-all ${
            actionMessage.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-300"
              : actionMessage.type === "error"
                ? "bg-rose-500/10 border-rose-500/20 text-rose-300"
                : "bg-sky-500/10 border-sky-500/20 text-sky-300"
          }`}
        >
          <div className="flex items-center gap-2">
            <SparklesIcon className="size-3.5 shrink-0" />
            <span>{actionMessage.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setActionMessage(null)}
            className="hover:opacity-75 transition-opacity"
          >
            <XIcon className="size-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
