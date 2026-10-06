"use client";

import type { CogsSyncJob } from "@/components/dashboard/po/product-cost/types";
import { Button } from "@/components/ui/button";

interface CogsSyncProgressProps {
  syncJob: CogsSyncJob | null;
  historyRunning: boolean;
  syncing: boolean;
  onRetryFailedSources: () => void;
}

export function CogsSyncProgress({
  syncJob,
  historyRunning,
  syncing,
  onRetryFailedSources,
}: CogsSyncProgressProps) {
  if (
    !syncJob ||
    (!historyRunning &&
      syncJob.status !== "PARTIAL_FAILED" &&
      syncJob.status !== "FAILED")
  ) {
    return null;
  }

  return (
    <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-foreground">
            Đồng bộ lịch sử COGS
          </p>
          <p className="text-[11px] text-muted-foreground">
            {syncJob.status === "RUNNING" || syncJob.status === "QUEUED"
              ? "Đang quét mỗi nhà cung cấp một lần"
              : "Một số nguồn chưa hoàn tất"}
          </p>
        </div>
        {syncJob.sourceRuns.some((source) => source.status === "FAILED") &&
        !historyRunning ? (
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            disabled={syncing}
            onClick={onRetryFailedSources}
          >
            Chạy lại nguồn lỗi
          </Button>
        ) : null}
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {syncJob.sourceRuns.map((source) => {
          const percent = source.totalPages
            ? Math.min(
                100,
                Math.round((source.pagesProcessed / source.totalPages) * 100),
              )
            : source.status === "COMPLETED"
              ? 100
              : 0;
          return (
            <div
              key={source.source}
              className="space-y-1.5 rounded-md border border-border/50 bg-background p-2"
            >
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-medium text-foreground">
                  {source.source}
                </span>
                <span className="text-muted-foreground">
                  {source.status === "FAILED"
                    ? "Lỗi"
                    : source.status === "COMPLETED"
                      ? "Xong"
                      : `${percent}%`}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full transition-all ${source.status === "FAILED" ? "bg-destructive" : "bg-foreground"}`}
                  style={{ width: `${percent}%` }}
                />
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                {source.errorMessage ||
                  `${source.pagesProcessed}${source.totalPages ? `/${source.totalPages}` : ""} trang · ${source.rowsFetched} dòng`}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
