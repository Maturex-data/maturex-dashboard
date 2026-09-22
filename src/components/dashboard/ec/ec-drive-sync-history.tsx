"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  ClockIcon,
  DatabaseIcon,
  ExternalLinkIcon,
  LayersIcon,
  Trash2Icon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { type ColumnDef, DataTable } from "@/components/shared/data-table";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export type DriveRun = {
  id: string;
  shop: string;
  source: string;
  status: string;
  rangeFrom: Date | string;
  rangeTo: Date | string;
  rowCount: number;
  driveFileUrl: string | null;
  errorMessage: string | null;
  createdAt: Date | string;
};

const sourceBadgeStyles: Record<string, string> = {
  Orders:
    "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20 ring-sky-500/10",
  COGS: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 ring-amber-500/10",
  Ads: "bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20 ring-purple-500/10",
  Payouts:
    "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 ring-emerald-500/10",
};

function formatVietnamTime(dateInput: Date | string): string {
  const date = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour12: false,
  }).format(date);
}

export function EcDriveSyncHistory({ runs }: { runs: DriveRun[] }) {
  const router = useRouter();
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClearHistory() {
    if (
      !window.confirm(
        "Bạn có chắc chắn muốn xóa toàn bộ lịch sử các phiên chạy đồng bộ?",
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    try {
      const response = await fetch("/api/ec/drive/clear-history", {
        method: "DELETE",
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Không thể xóa lịch sử đồng bộ.");
      }
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Không thể xóa lịch sử đồng bộ.",
      );
    } finally {
      setClearing(false);
    }
  }

  const columns: ColumnDef<DriveRun>[] = [
    {
      id: "source",
      header: "Nguồn / Shop",
      headerClassName:
        "h-9 py-2 pl-5 pr-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 pl-5 pr-3",
      accessor: (run) => {
        const badgeClass =
          sourceBadgeStyles[run.source] ||
          "bg-muted text-foreground border-border";
        return (
          <div className="flex flex-col gap-1">
            <span
              className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 font-mono text-[11px] font-bold shadow-2xs ${badgeClass}`}
            >
              {run.source}
            </span>
            <span className="text-[11px] font-medium text-muted-foreground">
              {run.shop}
            </span>
          </div>
        );
      },
    },
    {
      id: "createdAt",
      header: "Thời gian (VN)",
      headerClassName:
        "h-9 py-2 px-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 px-3",
      accessor: (run) => (
        <span className="font-mono text-[11px] text-muted-foreground whitespace-nowrap">
          {formatVietnamTime(run.createdAt)}
        </span>
      ),
    },
    {
      id: "rowCount",
      header: "Dòng",
      headerClassName:
        "h-9 py-2 px-3 text-right text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 px-3 text-right",
      accessor: (run) => (
        <span className="font-mono text-xs font-bold text-foreground">
          {run.rowCount.toLocaleString("en-US")}
        </span>
      ),
    },
    {
      id: "status",
      header: "Trạng thái",
      headerClassName:
        "h-9 py-2 px-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 px-3",
      accessor: (run) => {
        const isCompleted =
          run.status === "COMPLETED" || run.status === "SUCCESS";
        const isFailed = run.status === "FAILED";
        if (isCompleted) {
          return (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <CheckCircle2Icon className="size-3.5" />
              Thành công
            </span>
          );
        }
        if (isFailed) {
          return (
            <span
              className="inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400 border border-rose-500/20 cursor-help"
              title={run.errorMessage || "Có lỗi xảy ra"}
            >
              <AlertCircleIcon className="size-3.5" />
              Thất bại
            </span>
          );
        }
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <ClockIcon className="size-3 animate-spin" />
            {run.status}
          </span>
        );
      },
    },
    {
      id: "file",
      header: "Tài liệu",
      headerClassName:
        "h-9 py-2 pr-5 pl-3 text-right text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 pr-5 pl-3 text-right",
      accessor: (run) =>
        run.driveFileUrl ? (
          <a
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10 dark:text-emerald-400 dark:hover:text-emerald-300 transition-colors"
            href={run.driveFileUrl}
            rel="noreferrer"
            target="_blank"
          >
            <span>Xem Sheet</span>
            <ExternalLinkIcon className="size-3 stroke-[2.2]" />
          </a>
        ) : (
          <span className="text-muted-foreground/40 font-mono">—</span>
        ),
    },
  ];

  return (
    <SectionCard
      icon={<LayersIcon className="size-3.5 stroke-[2.2]" />}
      title="Lịch sử phiên chạy"
      action={
        <div className="flex items-center gap-2.5">
          <Badge
            variant="outline"
            className="rounded-full bg-muted/80 px-2.5 py-0.5 text-[11px] font-mono font-medium text-muted-foreground border-border/60"
          >
            {runs.length} bản ghi
          </Badge>

          {runs.length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={clearing}
              onClick={handleClearHistory}
              className="h-7 gap-1 rounded-lg px-2 text-xs font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
              title="Xóa toàn bộ lịch sử đồng bộ"
            >
              <Trash2Icon
                className={`size-3.5 ${clearing ? "animate-spin" : ""}`}
              />
              <span className="hidden sm:inline">Xóa lịch sử</span>
            </Button>
          )}
        </div>
      }
      contentClassName="p-0"
    >
      {error && (
        <div className="border-b border-destructive/20 bg-destructive/10 px-4 py-2 text-xs font-medium text-destructive">
          {error}
        </div>
      )}

      <div className="max-h-[390px] overflow-y-auto">
        <DataTable
          columns={columns}
          data={runs}
          keyExtractor={(run) => run.id}
          headerClassName="sticky top-0 z-10 border-b border-border/60 bg-background/95 backdrop-blur-md"
          rowClassName={() =>
            "group hover:bg-emerald-500/[0.03] transition-colors border-border/40"
          }
          emptyMessage={
            <div className="flex min-h-[300px] flex-col items-center justify-center gap-2.5 p-6 text-center text-muted-foreground">
              <div className="flex size-11 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs">
                <DatabaseIcon className="size-5" />
              </div>
              <p className="text-sm font-bold text-foreground">
                Chưa có phiên đồng bộ nào
              </p>
              <p className="max-w-xs text-xs text-muted-foreground">
                Các phiên đồng bộ dữ liệu vào Google Sheets sẽ được ghi nhận và
                hiển thị chi tiết tại đây.
              </p>
            </div>
          }
        />
      </div>
    </SectionCard>
  );
}
