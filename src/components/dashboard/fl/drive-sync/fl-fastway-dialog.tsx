"use client";

import { RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export type FastwaySyncMode = "current" | "custom" | "all";

interface FlFastwayDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  loading: boolean;
  onSync: (
    mode: FastwaySyncMode,
    customFrom?: string,
    customTo?: string,
  ) => Promise<void>;
  rangeType: "month" | "month-range" | "date";
  month: string;
  fromMonth: string;
  toMonth: string;
  fromDate: string;
  toDate: string;
  defaultDate: string;
}

export function FlFastwayDialog({
  open,
  onOpenChange,
  loading,
  onSync,
  rangeType,
  month,
  fromMonth,
  toMonth,
  fromDate,
  toDate,
  defaultDate,
}: FlFastwayDialogProps) {
  const [mode, setMode] = useState<FastwaySyncMode>("current");
  const [customFrom, setCustomFrom] = useState("2026-08-01");
  const [customTo, setCustomTo] = useState(defaultDate);

  const handleStart = () => {
    onSync(mode, customFrom, customTo);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            className="h-9 gap-1.5 rounded-xl border-amber-500/30 bg-background/90 px-3.5 text-xs font-semibold text-amber-700 hover:bg-amber-500/10 hover:border-amber-500/50 hover:text-amber-800 dark:text-amber-300 dark:hover:text-amber-200 shadow-xs transition-all"
          >
            <RefreshCwIcon
              className={`size-3.5 text-amber-600 ${loading ? "animate-spin" : ""}`}
            />
            <span>
              {loading ? "Đang kéo Fastway..." : "Đồng bộ Fastway API"}
            </span>
          </Button>
        }
      />
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-amber-600 dark:text-amber-400">
            <RefreshCwIcon className="size-4" />
            Đồng bộ đơn hàng từ Fastway API
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Kéo các đơn hàng, chi phí vận chuyển &amp; tracking từ Fastway vào
            Database COGS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <span className="text-xs font-semibold text-foreground">
              Chọn phạm vi thời gian kéo đơn:
            </span>
            <div className="grid grid-cols-1 gap-2">
              {/* Option 1: Current Page Range */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === "current"
                    ? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/20"
                    : "border-border/60 hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="fwMode"
                  checked={mode === "current"}
                  onChange={() => setMode("current")}
                  className="mt-0.5"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-foreground">
                    Theo thời gian đang chọn trên trang
                  </span>
                  <span className="text-muted-foreground mt-0.5 font-mono">
                    {rangeType === "month"
                      ? `Tháng ${month}`
                      : rangeType === "month-range"
                        ? `${fromMonth} → ${toMonth}`
                        : `${fromDate} → ${toDate}`}
                  </span>
                </div>
              </label>

              {/* Option 2: Custom Date Range */}
              <label
                className={`flex flex-col gap-2 p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === "custom"
                    ? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/20"
                    : "border-border/60 hover:bg-muted/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="fwMode"
                    checked={mode === "custom"}
                    onChange={() => setMode("custom")}
                  />
                  <span className="text-xs font-semibold text-foreground">
                    Tùy chỉnh khoảng ngày (Ngày X đến Ngày Y)
                  </span>
                </div>
                {mode === "custom" && (
                  <div className="grid grid-cols-2 gap-2 pt-2">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">
                        Từ ngày:
                      </span>
                      <Input
                        type="date"
                        value={customFrom}
                        onChange={(e) => setCustomFrom(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground">
                        Đến ngày:
                      </span>
                      <Input
                        type="date"
                        value={customTo}
                        onChange={(e) => setCustomTo(e.target.value)}
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}
              </label>

              {/* Option 3: All History */}
              <label
                className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                  mode === "all"
                    ? "border-amber-500/50 bg-amber-500/[0.06] ring-1 ring-amber-500/20"
                    : "border-border/60 hover:bg-muted/30"
                }`}
              >
                <input
                  type="radio"
                  name="fwMode"
                  checked={mode === "all"}
                  onChange={() => setMode("all")}
                  className="mt-0.5"
                />
                <div className="flex flex-col text-xs">
                  <span className="font-semibold text-foreground">
                    Toàn bộ lịch sử
                  </span>
                  <span className="text-muted-foreground mt-0.5">
                    Kéo tất cả các đơn hàng từ trước đến nay trên tài khoản
                    Fastway.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Hủy
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={loading}
            onClick={handleStart}
            className="bg-amber-600 hover:bg-amber-700 text-white gap-1.5"
          >
            <RefreshCwIcon
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            <span>
              {loading ? "Đang kéo đơn..." : "Bắt đầu kéo đơn Fastway"}
            </span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
