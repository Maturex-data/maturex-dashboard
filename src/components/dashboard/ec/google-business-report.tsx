"use client";

import { ExternalLinkIcon, SheetIcon } from "lucide-react";
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { EcBusinessReportSheetTable } from "@/lib/ec-business-report-sheet";

type GoogleBusinessReportProps = {
  spreadsheetId: string;
  tables: EcBusinessReportSheetTable[];
};

const PL_AMOUNT_COLUMNS = [
  "month-one-amount",
  "month-one-ratio",
  "month-two-amount",
  "month-two-ratio",
  "total-amount",
  "total-ratio",
] as const;

function SheetTable({ table }: { table: EcBusinessReportSheetTable }) {
  if (table.error) {
    return <p className="p-5 text-sm text-destructive">{table.error}</p>;
  }

  if (!table.rows.length) {
    return (
      <p className="p-5 text-sm text-muted-foreground">
        Sheet này hiện chưa có dữ liệu hiển thị.
      </p>
    );
  }

  const isPl = table.name === "PL";
  const isDaily = table.name === "P&L ngày";
  const columnCount = table.rows[0]?.length ?? 0;

  return (
    <div className="max-h-[calc(100vh-15rem)] overflow-auto bg-white">
      <table className="w-full min-w-max border-collapse text-[13px] text-[#202a3d]">
        {isPl && (
          <colgroup>
            <col className="w-24" />
            <col className="w-[330px]" />
            {PL_AMOUNT_COLUMNS.map((name) => (
              <col className="w-28" key={name} />
            ))}
            <col className="w-[450px]" />
          </colgroup>
        )}
        <tbody>
          {table.rows.map((row, rowIndex) => {
            if (isDaily && rowIndex < 2) {
              return (
                <tr key={`${table.name}-${rowIndex}`}>
                  <td
                    className={
                      rowIndex === 0
                        ? "border-b border-[#d9e2f2] px-3 pt-4 pb-1 text-xl font-bold text-[#10205e]"
                        : "px-3 pb-3 text-xs text-[#33415d]"
                    }
                    colSpan={columnCount}
                  >
                    {row[0]}
                  </td>
                </tr>
              );
            }

            if (isPl && rowIndex < 3) {
              return (
                <tr key={`${table.name}-${rowIndex}`}>
                  <td
                    className={
                      rowIndex === 0
                        ? "border-b border-[#d9e2f2] px-3 pt-4 pb-1 text-2xl font-bold text-[#10205e]"
                        : rowIndex === 1
                          ? "px-3 pt-1 text-lg font-bold text-[#10205e]"
                          : "px-3 pb-2 text-xs text-[#33415d]"
                    }
                    colSpan={columnCount}
                  >
                    {row[0]}
                  </td>
                </tr>
              );
            }

            if (isPl && rowIndex === 3) {
              return (
                <tr key={`${table.name}-${rowIndex}`}>
                  <td className="h-1 bg-[#f26337]" colSpan={columnCount} />
                </tr>
              );
            }

            if (isPl && rowIndex === 4) {
              return (
                <tr
                  className="bg-[#10205e] text-center text-white"
                  key={`${table.name}-${rowIndex}`}
                >
                  <th
                    className="border-r border-[#243565] px-2 py-2"
                    rowSpan={2}
                    scope="col"
                  >
                    {row[0]}
                  </th>
                  <th
                    className="border-r border-[#243565] px-2 py-2"
                    rowSpan={2}
                    scope="col"
                  >
                    {row[1]}
                  </th>
                  {[2, 4, 6].map((index) => (
                    <th
                      className="border-r border-[#243565] px-2 py-1"
                      colSpan={2}
                      key={index}
                      scope="colgroup"
                    >
                      {row[index]}
                    </th>
                  ))}
                  <th className="px-2 py-2" rowSpan={2} scope="col">
                    {row[8]}
                  </th>
                </tr>
              );
            }

            if (isPl && rowIndex === 5) {
              return (
                <tr
                  className="bg-[#10205e] text-center text-white"
                  key={`${table.name}-${rowIndex}`}
                >
                  {PL_AMOUNT_COLUMNS.map((name, index) => (
                    <th
                      className="border-r border-t border-[#243565] px-2 py-1"
                      key={name}
                      scope="col"
                    >
                      {row[index + 2]}
                    </th>
                  ))}
                </tr>
              );
            }

            const code = row[0]?.trim() ?? "";
            const isSection = isPl && /^[IVX]+$/.test(code);
            const isTotal =
              isPl &&
              (code === "II" ||
                code === "III" ||
                /TOTAL|MARGIN|PROFIT|LỢI NHUẬN/i.test(row[1] ?? ""));
            const isSubsection = isPl && /^(?:III|IV|V)\.0$/.test(code);
            const isGenericHeader = !isPl && rowIndex === 0;
            const isDailyHeader =
              isDaily &&
              (code === "THAM SỐ CÓ THỂ SỬA" ||
                code.startsWith("Ngày quản trị"));
            const isDailyTotal = isDaily && code === "Tổng/Trung bình";
            const isGenericSection =
              !isPl && rowIndex > 0 && /^[IVX]+(?:\.[IVX]+)?$/.test(code);

            return (
              <tr
                className={
                  isTotal || isSubsection || isDailyTotal
                    ? "border-y-2 border-[#10205e] bg-[#eaf2ff] font-bold text-[#10205e]"
                    : isSection || isGenericSection
                      ? "border-y border-[#cbd8ec] bg-[#f3f6fb] font-bold text-[#10205e]"
                      : isGenericHeader || isDailyHeader
                        ? "border-t-4 border-[#f26337] bg-[#10205e] font-semibold text-white"
                        : "border-b border-[#e3e8f0] hover:bg-[#f7faff]"
                }
                key={`${table.name}-${rowIndex}`}
              >
                {Array.from({ length: columnCount }, (_, cellIndex) => {
                  const cell = row[cellIndex] ?? "";
                  const Cell = isGenericHeader || isDailyHeader ? "th" : "td";
                  return (
                    <Cell
                      className={`max-w-[450px] border-r border-[#e3e8f0] px-2.5 py-1.5 align-top last:border-r-0 ${isPl && cellIndex > 1 && cellIndex < 8 ? "text-right tabular-nums" : "text-left"} ${isPl && /^III\.[1-4]$/.test(code) ? "italic" : ""} ${cellIndex === 0 && isPl ? "font-semibold text-[#10205e]" : ""} ${cellIndex === 8 ? "whitespace-normal" : "whitespace-nowrap"}`}
                      key={`${table.name}-${rowIndex}-${cellIndex}`}
                    >
                      {cell}
                    </Cell>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GoogleBusinessReport({
  spreadsheetId,
  tables,
}: GoogleBusinessReportProps) {
  const [activeSheet, setActiveSheet] = React.useState(tables[0]?.name ?? "PL");

  return (
    <div className="min-w-0">
      <div className="flex flex-col gap-3 border-b border-border/60 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-2">
          <SheetIcon className="size-4 shrink-0 text-[#10205e]" />
          <p className="truncate text-sm font-medium">
            Nguồn dữ liệu: Google Sheet kế toán
          </p>
        </div>
        <a
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          href={`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`}
          rel="noreferrer"
          target="_blank"
        >
          Mở bảng tính <ExternalLinkIcon className="size-3" />
        </a>
      </div>

      <Tabs onValueChange={setActiveSheet} value={activeSheet}>
        <div className="border-b border-border/60 px-4 pt-3">
          <TabsList className="gap-1" variant="line">
            {tables.map((table) => (
              <TabsTrigger
                className="px-3 data-active:text-[#10205e] data-active:after:bg-[#f26337]"
                key={table.name}
                value={table.name}
              >
                {table.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        {tables.map((table) => (
          <TabsContent key={table.name} value={table.name}>
            <SheetTable table={table} />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
