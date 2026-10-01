"use client";

import { RefreshCwIcon, SheetIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EC_PROGRESS_SHEET_NAMES,
  type EcProgressSheetData,
  type EcProgressSheetName,
  type EcProgressSheetTable,
} from "@/lib/ec-progress-report-types";

type EcProgressReportProps = {
  initialData: EcProgressSheetData;
  initialError: string | null;
  spreadsheetId: string;
};

function formatUpdatedAt(value: string): string {
  if (!value) return "";
  return new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(new Date(value));
}

function isEcProgressSheetData(value: unknown): value is EcProgressSheetData {
  return (
    typeof value === "object" &&
    value !== null &&
    "tables" in value &&
    Array.isArray(value.tables) &&
    "lastUpdatedAt" in value &&
    typeof value.lastUpdatedAt === "string"
  );
}

type GridRowKind =
  | "title"
  | "subtitle"
  | "note"
  | "month-group"
  | "column-header"
  | "section"
  | "summary"
  | "daily-section"
  | "daily-header"
  | "normal";

function classifyRow(
  tableName: string,
  row: string[],
  rowIndex: number,
): GridRowKind {
  const firstCell = row[0]?.trim() ?? "";
  const filledCells = row.filter((cell) => cell.trim().length > 0);
  const hasMonthGroup = row.some((cell) => /^Tháng\s+\d+$/i.test(cell.trim()));
  const isProgressSheet = tableName === "Tiến độ Q4 2026";

  if (rowIndex === 0) return "title";
  if (rowIndex === 1 && /DỰ ÁN|ECOMCREATE/i.test(firstCell)) {
    return isProgressSheet && /DỰ ÁN/i.test(firstCell) ? "subtitle" : "note";
  }
  if (rowIndex >= 2 && rowIndex < 4) return "note";
  if (firstCell.startsWith("THỰC TẾ THEO NGÀY")) return "daily-section";
  if (hasMonthGroup) return "month-group";

  if (
    row.some((cell) => cell.trim() === "Mã chỉ tiêu") ||
    (row.some((cell) => cell.trim() === "Chỉ tiêu") &&
      row.some((cell) => /Mục tiêu tháng|Thực tế đã nhập/.test(cell))) ||
    (row.length > 6 &&
      row.some((cell) => cell.trim() === "Thực tế") &&
      row.some((cell) => cell.trim() === "Dự phóng"))
  ) {
    return "column-header";
  }

  if (row.some((cell) => cell.trim() === "Ngày") && row.length > 10) {
    return "daily-header";
  }

  if (filledCells.length === 1 && firstCell.length > 50) return "note";

  if (
    isProgressSheet &&
    /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)$/.test(firstCell) &&
    filledCells.length <= 2
  ) {
    return "section";
  }

  if (
    isProgressSheet &&
    (/^(?:II|IV|V|C\*)$/.test(firstCell) ||
      /NET REVENUE|CONTRIBUTION|LỢI NHUẬN/i.test(row[1] ?? ""))
  ) {
    return "summary";
  }

  return "normal";
}

function isNumericCell(value: string): boolean {
  const normalized = value.replace(/[\s\u00a0]/g, "");
  return (
    /^\d{1,2}\/\d{1,2}\/\d{4}$/.test(normalized) ||
    /^-?(?:[$€])?[\d.,]+%?$/.test(normalized) ||
    /^\((?:-?[$€])?[\d.,]+%?\)$/.test(normalized) ||
    /^[-–—]$/.test(normalized)
  );
}

function SheetGrid({ table }: { table: EcProgressSheetTable }) {
  if (!table.rows.length) {
    return (
      <div className="p-8 text-center text-sm text-muted-foreground">
        Tab này hiện chưa có dữ liệu.
      </div>
    );
  }

  const isProgressSheet = table.name === "Tiến độ Q4 2026";
  const columnCount = table.rows.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0,
  );
  const monthGroupStarts = new Set(
    table.rows
      .find((row) => row.some((cell) => /^Tháng\s+\d+$/i.test(cell.trim())))
      ?.flatMap((cell, index) =>
        /^Tháng\s+\d+$/i.test(cell.trim()) ? [index] : [],
      ) ?? [],
  );

  return (
    <div className="max-h-[calc(100vh-16rem)] min-h-72 overflow-auto bg-white dark:bg-background">
      <table className="w-full min-w-max border-collapse text-[13px] text-[#202a3d] dark:text-foreground">
        <colgroup>
          {Array.from({ length: columnCount }, (_, columnIndex) => (
            <col
              key={`col-${table.name}-${columnIndex}`}
              style={{
                width: isProgressSheet
                  ? columnIndex === 0
                    ? "6rem"
                    : columnIndex === 1
                      ? "18rem"
                      : "8rem"
                  : columnIndex === 0
                    ? "16rem"
                    : "12rem",
              }}
            />
          ))}
        </colgroup>
        <tbody>
          {table.rows.map((row, rowIndex) => (
            <GridRow
              columnCount={columnCount}
              isProgressSheet={isProgressSheet}
              key={`${table.name}-${rowIndex}`}
              kind={classifyRow(table.name, row, rowIndex)}
              monthGroupStarts={monthGroupStarts}
              row={row}
              rowIndex={rowIndex}
              tableName={table.name}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GridRow({
  columnCount,
  isProgressSheet,
  kind,
  monthGroupStarts,
  row,
  rowIndex,
  tableName,
}: {
  columnCount: number;
  isProgressSheet: boolean;
  kind: GridRowKind;
  monthGroupStarts: Set<number>;
  row: string[];
  rowIndex: number;
  tableName: string;
}) {
  const firstCell = row[0]?.trim() ?? "";
  const mergedText =
    kind === "note"
      ? row
          .map((cell) => cell.trim())
          .filter(Boolean)
          .join(" ")
      : firstCell;

  if (["title", "subtitle", "note", "daily-section"].includes(kind)) {
    const mergedClassName =
      kind === "title"
        ? "bg-[#10205e] px-4 py-3 text-base font-bold tracking-wide text-white sm:text-lg"
        : kind === "subtitle"
          ? "bg-[#172b6d] px-4 py-2 text-sm font-semibold text-white"
          : kind === "daily-section"
            ? "border-y border-[#273b78] bg-[#10205e] px-4 py-2 font-semibold tracking-wide text-white"
            : "border-b border-[#e3e8f0] bg-white px-4 py-1.5 text-xs leading-5 text-[#526078] dark:bg-muted/30 dark:text-muted-foreground";

    return (
      <tr key={`${tableName}-${rowIndex}`}>
        <td className={mergedClassName} colSpan={columnCount}>
          {mergedText || <span aria-hidden="true">&nbsp;</span>}
        </td>
      </tr>
    );
  }

  const rowColors = {
    "month-group": "bg-[#10205e] font-semibold text-white",
    "column-header":
      "border-t-4 border-[#f26337] bg-[#10205e] font-semibold text-white",
    "daily-header":
      "border-t-4 border-[#f26337] bg-[#10205e] font-semibold text-white",
    section:
      "border-y border-[#cbd8ec] bg-[#f3f6fb] font-bold text-[#10205e] dark:bg-slate-800 dark:text-slate-100",
    summary:
      "border-y-2 border-[#10205e] bg-[#eaf2ff] font-bold text-[#10205e] dark:bg-blue-950/50 dark:text-blue-100",
    normal:
      rowIndex % 2 === 0
        ? "bg-white dark:bg-background"
        : "bg-[#f1f4f8] dark:bg-muted/30",
    title: "",
    subtitle: "",
    note: "",
    "daily-section": "",
  } satisfies Record<GridRowKind, string>;
  const rowClass = rowColors[kind];
  const isHeader = kind === "column-header" || kind === "daily-header";
  const isCentered = kind === "column-header" || kind === "month-group";

  return (
    <tr className={rowClass} key={`${tableName}-${rowIndex}`}>
      {Array.from({ length: columnCount }, (_, columnIndex) => {
        const cell = row[columnIndex] ?? "";
        const numeric = isNumericCell(cell);
        const negative = /^\s*[-(]/.test(cell);
        const percentage = cell.trim().endsWith("%");
        const stickyColumn = isProgressSheet
          ? columnIndex < 2
          : columnIndex === 0;
        const stickyLeft = isProgressSheet
          ? columnIndex === 0
            ? "left-0"
            : "left-24"
          : "left-0";
        const stickyWidth = isProgressSheet
          ? columnIndex === 0
            ? "w-24 min-w-24 max-w-24"
            : "w-72 min-w-72 max-w-72"
          : "w-64 min-w-64 max-w-64";
        const alignment =
          isCentered || isHeader
            ? "text-center"
            : numeric
              ? "text-right tabular-nums"
              : "text-left";
        const valueColor = percentage
          ? negative
            ? "text-red-700 dark:text-red-300"
            : "text-emerald-700 dark:text-emerald-300"
          : negative && numeric
            ? "text-red-700 dark:text-red-300"
            : "";
        const boundaryClass =
          monthGroupStarts.has(columnIndex) && columnIndex > 1
            ? "border-l-2 border-l-[#263b7a]"
            : "";
        const className = [
          "border-b border-r border-[#e3e8f0] px-2.5 py-1.5 align-top dark:border-border/70",
          rowClass,
          alignment,
          valueColor,
          boundaryClass,
          kind === "month-group"
            ? "min-w-32 border-b border-[#243565] px-3 py-2 text-center"
            : kind === "column-header" || kind === "daily-header"
              ? "sticky top-0 z-20 min-w-32 whitespace-normal px-2 py-2 text-center text-[11px] leading-4"
              : "min-w-28",
          stickyColumn
            ? `sticky ${stickyLeft} ${stickyWidth} z-10 ${isHeader ? "top-0 z-30" : ""}`
            : "",
          isProgressSheet && columnIndex === 1
            ? "whitespace-normal"
            : "whitespace-nowrap",
          kind === "section" && columnIndex === 1 ? "tracking-wide" : "",
          kind === "summary" && columnIndex === 1 ? "font-bold" : "",
        ]
          .filter(Boolean)
          .join(" ");

        if (isHeader) {
          return (
            <th
              className={className}
              // biome-ignore lint/suspicious/noArrayIndexKey: Matrix header cells follow fixed column coordinates
              key={`${tableName}-${rowIndex}-${columnIndex}`}
              scope="col"
            >
              {cell || <span aria-hidden="true">&nbsp;</span>}
            </th>
          );
        }

        return (
          <td
            className={className}
            // biome-ignore lint/suspicious/noArrayIndexKey: Matrix data cells follow fixed row-column coordinates
            key={`${tableName}-${rowIndex}-${columnIndex}`}
          >
            {cell || <span aria-hidden="true">&nbsp;</span>}
          </td>
        );
      })}
    </tr>
  );
}

export function EcProgressReport({
  initialData,
  initialError,
  spreadsheetId,
}: EcProgressReportProps) {
  const [tables, setTables] = useState(initialData.tables);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(initialData.lastUpdatedAt);
  const [error, setError] = useState(initialError);
  const [activeSheet, setActiveSheet] = useState<EcProgressSheetName>(
    EC_PROGRESS_SHEET_NAMES[0],
  );
  const [refreshing, setRefreshing] = useState(false);

  async function refresh() {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);

    try {
      let response: Response;
      try {
        response = await fetch("/api/ec/progress", {
          method: "GET",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
      } catch {
        throw new Error("Không kết nối được máy chủ. Hãy thử lại sau.");
      }

      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error(
          "Máy chủ trả về dữ liệu không đọc được. Vui lòng thử lại.",
        );
      }

      if (!response.ok || !isEcProgressSheetData(payload)) {
        const apiError =
          typeof payload === "object" &&
          payload !== null &&
          "error" in payload &&
          typeof payload.error === "string"
            ? payload.error
            : null;
        throw new Error(
          apiError
            ? apiError
            : "Không tải được dữ liệu tiến độ. Vui lòng thử lại.",
        );
      }

      setTables(payload.tables);
      setLastUpdatedAt(payload.lastUpdatedAt);
    } catch (cause) {
      setTables([]);
      setLastUpdatedAt("");
      setError(
        cause instanceof Error
          ? cause.message
          : "Không tải được dữ liệu tiến độ. Vui lòng thử lại.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2 text-sm text-muted-foreground">
          <SheetIcon className="size-4 shrink-0" />
          <a
            className="truncate underline-offset-4 hover:text-foreground hover:underline"
            href={`https://docs.google.com/spreadsheets/d/${encodeURIComponent(spreadsheetId)}/edit`}
            rel="noreferrer"
            target="_blank"
          >
            Mở Google Sheet nguồn
          </a>
          {lastUpdatedAt && (
            <span className="hidden sm:inline">
              · Cập nhật {formatUpdatedAt(lastUpdatedAt)}
            </span>
          )}
        </div>
        <Button
          disabled={refreshing}
          onClick={refresh}
          type="button"
          variant="outline"
        >
          <RefreshCwIcon
            className={`size-4 ${refreshing ? "animate-spin" : ""}`}
          />
          {refreshing ? "Đang tải…" : "Làm mới"}
        </Button>
      </div>

      <Tabs
        onValueChange={(value) => setActiveSheet(value as EcProgressSheetName)}
        value={activeSheet}
      >
        <div className="border-b border-border/60 px-4 pt-3">
          <TabsList className="gap-1" variant="line">
            {EC_PROGRESS_SHEET_NAMES.map((name) => (
              <TabsTrigger
                className="px-3 data-active:text-[#10205e] data-active:after:bg-[#f26337]"
                key={name}
                value={name}
              >
                {name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {EC_PROGRESS_SHEET_NAMES.map((name) => {
          const table = tables.find((candidate) => candidate.name === name);
          return (
            <TabsContent key={name} value={name}>
              {error ? (
                <div className="m-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                  {error}
                </div>
              ) : refreshing ? (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Đang tải dữ liệu từ Google Sheet…
                </div>
              ) : table ? (
                <SheetGrid table={table} />
              ) : (
                <div className="p-8 text-center text-sm text-muted-foreground">
                  Chưa có dữ liệu. Chọn “Làm mới” để tải lại.
                </div>
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}
