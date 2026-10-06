"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  Columns3Icon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import {
  formatCellValue,
  normalizeText,
} from "@/components/dashboard/ec/raw-tables/cell-formatter";
import {
  type Column,
  MONEY_COLUMNS,
  PAGE_SIZE,
  type RawRow,
} from "@/components/dashboard/ec/raw-tables/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface SheetTableProps {
  name: string;
  rows: RawRow[];
  columns: readonly Column[];
  loading: boolean;
}

export function SheetTable({ name, rows, columns, loading }: SheetTableProps) {
  const [page, setPage] = React.useState(1);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [visible, setVisible] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map(([key]) => [key, true])),
  );

  const searchTokens = React.useMemo(() => {
    return normalizeText(searchTerm).split(/\s+/).filter(Boolean);
  }, [searchTerm]);

  const filteredRows = React.useMemo(() => {
    if (!searchTokens.length) return rows;

    return rows.filter((row) => {
      const haystack = columns
        .map(([key]) => normalizeText(row[key]))
        .join(" ");

      return searchTokens.every((token) => haystack.includes(token));
    });
  }, [rows, columns, searchTokens]);

  const displayedColumns = columns.filter(([key]) => visible[key]);
  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const pageRows = filteredRows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-2.5 p-4">
      {/* Table Local Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative w-56 sm:w-80">
            <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              type="text"
              placeholder="Tìm theo Order Name, Date, Status, Total..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="h-8 pl-8 pr-7 text-xs font-sans"
            />
            {searchTerm ? (
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                }}
                className="absolute right-1 top-1 size-6 text-muted-foreground hover:text-foreground"
                aria-label="Xóa tìm kiếm"
              >
                <XIcon className="size-3" />
              </Button>
            ) : null}
          </div>
          <span className="text-xs text-muted-foreground font-mono">
            <strong className="text-foreground">{filteredRows.length}</strong> /{" "}
            {rows.length} records
          </span>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1.5"
              />
            }
          >
            <Columns3Icon className="size-3.5" />
            Columns ({displayedColumns.length}/{columns.length})
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 max-h-80 overflow-y-auto"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs">
                Hiển thị cột
              </DropdownMenuLabel>
              {columns.map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  checked={visible[key]}
                  key={key}
                  className="text-xs"
                  onCheckedChange={(checked) =>
                    setVisible((current) => ({
                      ...current,
                      [key]: checked === true,
                    }))
                  }
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* High Density Bordered Table */}
      <div className="max-h-[500px] overflow-auto rounded-xl border border-border/60 bg-background/50">
        <Table className="min-w-max text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs border-b border-border/60 shadow-xs">
            <TableRow className="hover:bg-transparent">
              {displayedColumns.map(([key, label]) => {
                const isMoney = MONEY_COLUMNS.has(key);
                return (
                  <TableHead
                    className={`whitespace-nowrap py-2.5 px-3 font-semibold text-muted-foreground text-xs ${
                      isMoney ? "text-right" : "text-left"
                    }`}
                    key={key}
                  >
                    {label}
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
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Đang tải dữ liệu từ Neon DB...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={Math.max(displayedColumns.length, 1)}
                  className="h-28 text-center text-muted-foreground"
                >
                  Không tìm thấy bản ghi phù hợp.
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? pageRows.map((row, idx) => (
                  <TableRow
                    key={`${name}-${String(row.id ?? row[columns[0][0]] ?? idx)}`}
                    className="hover:bg-muted/40 transition-colors border-b border-border/40"
                  >
                    {displayedColumns.map(([key]) => {
                      const isMoney = MONEY_COLUMNS.has(key);
                      return (
                        <TableCell
                          className={`max-w-[320px] truncate py-2 px-3 ${
                            isMoney ? "text-right" : "text-left"
                          }`}
                          key={key}
                        >
                          {formatCellValue(key, row[key])}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-xs pt-1">
        <span className="font-mono">
          Hiển thị {filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
          {Math.min(page * PAGE_SIZE, filteredRows.length)} /{" "}
          {filteredRows.length} hàng
        </span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous page"
            disabled={page === 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            className="h-7 px-2"
            variant="outline"
          >
            <ArrowLeftIcon className="size-3.5" />
          </Button>
          <span className="min-w-16 text-center font-mono text-xs">
            Trang {page}/{pageCount}
          </span>
          <Button
            aria-label="Next page"
            disabled={page === pageCount || loading}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            size="sm"
            className="h-7 px-2"
            variant="outline"
          >
            <ArrowRightIcon className="size-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
