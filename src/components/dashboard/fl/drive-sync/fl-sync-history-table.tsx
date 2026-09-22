"use client";

import { ClockIcon, ExternalLinkIcon, Trash2Icon } from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/shared/data-table";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type FlowaDriveRun, formatVietnamTime } from "./types";

interface FlSyncHistoryTableProps {
  runs: FlowaDriveRun[];
  clearingHistory: boolean;
  onClearHistory: () => Promise<void>;
}

export function FlSyncHistoryTable({
  runs,
  clearingHistory,
  onClearHistory,
}: FlSyncHistoryTableProps) {
  const columns: ColumnDef<FlowaDriveRun>[] = [
    {
      id: "createdAt",
      header: "Cập nhật (VN)",
      headerClassName:
        "h-9 py-2 pl-5 pr-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 pl-5 pr-3",
      accessor: (run) => (
        <span className="font-mono text-xs text-foreground/90 font-medium">
          {formatVietnamTime(run.createdAt)}
        </span>
      ),
    },
    {
      id: "status",
      header: "Trạng thái",
      headerClassName:
        "h-9 py-2 px-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 px-3",
      accessor: (run) => (
        <Badge
          variant="outline"
          className={
            run.status === "COMPLETED"
              ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300 font-semibold"
              : run.status === "FAILED"
                ? "border-destructive/30 bg-destructive/10 text-destructive font-semibold"
                : "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300 font-semibold"
          }
        >
          {run.status === "COMPLETED"
            ? "Thành công"
            : run.status === "FAILED"
              ? "Thất bại"
              : "Đang chạy"}
        </Badge>
      ),
    },
    {
      id: "source",
      header: "Nguồn / Sheet",
      headerClassName:
        "h-9 py-2 px-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 px-3",
      accessor: (run) => {
        const cleanSource = run.source.replace("FLOWA_", "");
        return (
          <div className="flex items-center gap-1.5">
            <Badge
              variant="outline"
              className={
                cleanSource === "Statement"
                  ? "border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300"
              }
            >
              {cleanSource}
            </Badge>
          </div>
        );
      },
    },
    {
      id: "shop",
      header: "Shop",
      headerClassName:
        "h-9 py-2 px-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 px-3",
      accessor: (run) => (
        <span className="text-xs font-medium text-foreground">{run.shop}</span>
      ),
    },
    {
      id: "range",
      header: "Kỳ báo cáo",
      headerClassName:
        "h-9 py-2 px-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 px-3",
      accessor: (run) => (
        <span className="font-mono text-xs text-muted-foreground">
          {String(run.rangeFrom).slice(0, 10)} →{" "}
          {String(run.rangeTo).slice(0, 10)}
        </span>
      ),
    },
    {
      id: "rowCount",
      header: "Số dòng",
      headerClassName:
        "h-9 py-2 px-3 text-[11px] font-semibold text-muted-foreground text-right",
      cellClassName: "py-3 px-3 text-right",
      accessor: (run) => (
        <span className="font-mono text-xs font-semibold tabular-nums text-foreground">
          {run.rowCount > 0 ? run.rowCount.toLocaleString("vi-VN") : "0"}
        </span>
      ),
    },
    {
      id: "link",
      header: "Bảng tính",
      headerClassName:
        "h-9 py-2 pr-5 pl-3 text-[11px] font-semibold text-muted-foreground",
      cellClassName: "py-3 pr-5 pl-3",
      accessor: (run) =>
        run.driveFileUrl ? (
          <a
            href={run.driveFileUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-purple-600 hover:text-purple-500 hover:underline dark:text-purple-400"
          >
            Mở Sheet <ExternalLinkIcon className="size-3" />
          </a>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <SectionCard
      title="Lịch sử phiên chạy (Giờ Việt Nam)"
      description="Nhật ký các lần đồng bộ dữ liệu Flowa lên Google Sheets."
      icon={
        <ClockIcon className="size-4 text-purple-600 dark:text-purple-400" />
      }
      action={
        runs.length > 0 ? (
          <Button
            size="sm"
            variant="ghost"
            disabled={clearingHistory}
            onClick={onClearHistory}
            className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          >
            <Trash2Icon className="size-3.5" />
            <span>Xóa lịch sử</span>
          </Button>
        ) : null
      }
    >
      <DataTable
        columns={columns}
        data={runs}
        emptyMessage="Chưa có phiên đồng bộ nào được ghi nhận cho Flowa."
        keyExtractor={(run) => run.id}
      />
    </SectionCard>
  );
}
