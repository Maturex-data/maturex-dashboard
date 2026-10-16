"use client";
import { ExternalLinkIcon, RefreshCwIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ReportOverview } from "@/components/dashboard/microm/report-overview";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { MicromReportTable } from "@/lib/microm/business-report-sheet";
import { cn } from "@/lib/utils";

function ReportTable({ table }: { table: MicromReportTable }) {
  if (!table.rows.length)
    return (
      <p className="p-6 text-sm text-muted-foreground">
        Tab này chưa có dữ liệu.
      </p>
    );
  return (
    <div className="max-h-[calc(100vh-17rem)] overflow-auto rounded-lg border bg-white">
      <table className="w-full min-w-max border-collapse text-xs text-slate-800">
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <tr
              key={`${table.id}-${rowIndex}`}
              className={cn(
                rowIndex < table.frozenRows
                  ? "bg-[#14235e] font-semibold text-white"
                  : rowIndex % 2
                    ? "bg-slate-50"
                    : "bg-white",
              )}
            >
              {row.map((cell, columnIndex) => {
                const merge = table.merges.find(
                  (merge) =>
                    rowIndex >= merge.startRowIndex &&
                    rowIndex < merge.endRowIndex &&
                    columnIndex >= merge.startColumnIndex &&
                    columnIndex < merge.endColumnIndex,
                );
                if (
                  merge &&
                  (merge.startRowIndex !== rowIndex ||
                    merge.startColumnIndex !== columnIndex)
                )
                  return null;
                return (
                  <td
                    key={`${table.id}-${rowIndex}-${columnIndex}`}
                    rowSpan={
                      merge
                        ? merge.endRowIndex - merge.startRowIndex
                        : undefined
                    }
                    colSpan={
                      merge
                        ? merge.endColumnIndex - merge.startColumnIndex
                        : undefined
                    }
                    className={cn(
                      "min-w-28 border border-slate-200/60 px-3 py-2 align-top whitespace-pre-wrap",
                      columnIndex < 2
                        ? "max-w-[420px] text-left"
                        : "text-right tabular-nums",
                      rowIndex >= table.frozenRows &&
                        /^[-−(].*\d/.test(cell) &&
                        "text-red-600",
                    )}
                  >
                    {cell}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function MicromBusinessReport({
  tables,
  spreadsheetId,
  updatedAt,
}: {
  tables: MicromReportTable[];
  spreadsheetId: string;
  updatedAt: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Tabs defaultValue={"1234590601"} className="gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TabsList className="h-auto flex-wrap justify-start gap-1 rounded-xl bg-slate-100 p-1">
          {tables.map((table) => (
            <TabsTrigger
              key={table.id}
              value={String(table.id)}
              className="rounded-lg px-4 py-2.5 text-sm data-active:bg-[#e5edfc] data-active:text-[#244574] data-active:shadow-none"
            >
              {table.id === 1234590601
                ? "Kết quả kinh doanh"
                : table.id === 715653195
                  ? "Kế hoạch Q4"
                  : "Chi phí Việt Nam"}
            </TabsTrigger>
          ))}
        </TabsList>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">
            Cập nhật{" "}
            {new Intl.DateTimeFormat("vi-VN", {
              dateStyle: "short",
              timeStyle: "short",
              timeZone: "Asia/Ho_Chi_Minh",
            }).format(new Date(updatedAt))}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="h-10 rounded-xl border-slate-200 bg-white px-4 active:scale-[0.98]"
            disabled={pending}
            onClick={() => startTransition(() => router.refresh())}
          >
            <RefreshCwIcon
              className={cn("size-3.5", pending && "animate-spin")}
            />
            Làm mới
          </Button>
        </div>
      </div>
      {tables.map((table) => (
        <TabsContent
          key={table.id}
          value={String(table.id)}
          className="space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              Dữ liệu trực tiếp từ Google Sheet
            </p>
            <a
              className="inline-flex items-center gap-1 text-xs text-[#365d9d] hover:underline"
              href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit#gid=${table.id}`}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLinkIcon className="size-3.5" />
              Mở tab nguồn
            </a>
          </div>
          <ReportOverview table={table} />
          <details className="rounded-xl border border-slate-200/80 bg-white p-5">
            <summary className="cursor-pointer text-sm font-medium">
              Xem bảng nguồn để đối chiếu
            </summary>
            <div className="mt-4">
              <ReportTable table={table} />
            </div>
          </details>
        </TabsContent>
      ))}
    </Tabs>
  );
}
