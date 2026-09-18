"use client";

import { ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCellValue } from "./flowa-cell-formatter";
import {
  type Column,
  type DataRow,
  MONEY_COLUMNS,
  SORTABLE_COLUMNS,
} from "./flowa-table-columns";

interface FlowaTableContentProps {
  displayedColumns: Column[];
  rows: DataRow[];
  loading: boolean;
  sortKey: string;
  sortDirection: "asc" | "desc";
  onSortChange: (key: string) => void;
}

export function FlowaTableContent({
  displayedColumns,
  rows,
  loading,
  sortKey,
  sortDirection,
  onSortChange,
}: FlowaTableContentProps) {
  return (
    <div className="max-h-[640px] overflow-auto no-scrollbar">
      <Table className="min-w-max text-xs border-collapse">
        <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-md border-b border-border shadow-xs">
          <TableRow className="hover:bg-transparent border-b border-border">
            {displayedColumns.map(([key, label]) => {
              const isMoney = MONEY_COLUMNS.has(key);
              const isSortable = SORTABLE_COLUMNS.has(key);
              const isActiveSort = sortKey === key;
              return (
                <TableHead
                  className={`whitespace-nowrap py-3 px-3.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase border-r border-border/40 last:border-r-0 ${
                    isMoney ? "text-right" : "text-left"
                  }`}
                  key={key}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      className={`inline-flex items-center gap-1.5 whitespace-nowrap transition-colors cursor-pointer rounded px-1.5 py-0.5 -mx-1.5 ${
                        isActiveSort
                          ? "text-foreground font-bold bg-muted/70"
                          : "hover:text-foreground hover:bg-muted/40"
                      }`}
                      onClick={() => onSortChange(key)}
                      title={`Sắp xếp theo ${label}`}
                    >
                      <span>{label}</span>
                      {isActiveSort ? (
                        sortDirection === "asc" ? (
                          <ArrowUpIcon className="size-3 text-primary" />
                        ) : (
                          <ArrowDownIcon className="size-3 text-primary" />
                        )
                      ) : (
                        <ArrowUpDownIcon className="size-3 opacity-35" />
                      )}
                    </button>
                  ) : (
                    label
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {loading ? (
            <TableRow>
              <TableCell
                colSpan={Math.max(displayedColumns.length, 1)}
                className="h-44 text-center text-muted-foreground"
              >
                <div className="flex flex-col items-center justify-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    <span className="size-2 rounded-full bg-purple-500 animate-ping" />
                  </div>
                  <span className="text-xs font-medium text-foreground">
                    Đang đồng bộ dữ liệu đối tác...
                  </span>
                  <span className="text-[11px] text-muted-foreground font-mono">
                    Truy vấn từ cơ sở dữ liệu Postgres
                  </span>
                </div>
              </TableCell>
            </TableRow>
          ) : null}

          {!loading && rows.length === 0 ? (
            <TableRow>
              <TableCell
                colSpan={Math.max(displayedColumns.length, 1)}
                className="h-44 text-center text-muted-foreground"
              >
                <div className="flex flex-col items-center justify-center gap-2">
                  <div className="size-8 rounded-lg bg-muted/60 border border-border/50 flex items-center justify-center text-muted-foreground">
                    —
                  </div>
                  <p className="text-xs font-medium text-foreground">
                    Không tìm thấy bản ghi phù hợp
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Thử chọn tháng khác hoặc thay đổi từ khóa tìm kiếm.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          ) : null}

          {!loading
            ? rows.map((row, idx) => (
                <TableRow
                  key={row.id}
                  className={`hover:bg-accent/40 transition-colors border-b border-border/50 ${
                    idx % 2 === 1 ? "bg-muted/30" : "bg-card/50"
                  }`}
                >
                  {displayedColumns.map(([key]) => {
                    const isMoney = MONEY_COLUMNS.has(key);
                    return (
                      <TableCell
                        className={`max-w-[340px] truncate py-2.5 px-3.5 border-r border-border/30 last:border-r-0 ${
                          isMoney ? "text-right" : "text-left"
                        }`}
                        key={key}
                      >
                        {formatCellValue(key, row[key], row.currency)}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            : null}
        </TableBody>
      </Table>
    </div>
  );
}
