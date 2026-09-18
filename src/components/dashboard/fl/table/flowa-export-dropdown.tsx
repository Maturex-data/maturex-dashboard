"use client";

import {
  ArrowDownToLineIcon,
  DownloadIcon,
  FileSpreadsheetIcon,
  LayersIcon,
} from "lucide-react";
import * as React from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  type Column,
  type DataRow,
  endpointForTab,
  itemColumns,
  orderColumns,
  type ShopOption,
  statementColumns,
  type TableTab,
} from "./flowa-table-columns";

interface FlowaExportDropdownProps {
  activeTab: TableTab;
  shops: ShopOption[];
  availableMonths: string[];
  displayedColumns: Column[];
  debouncedSearch: string;
  sortKey: string;
  sortDirection: "asc" | "desc";
  disabled?: boolean;
}

export function FlowaExportDropdown({
  activeTab,
  shops,
  availableMonths,
  displayedColumns,
  debouncedSearch,
  sortKey,
  sortDirection,
  disabled = false,
}: FlowaExportDropdownProps) {
  const [exporting, setExporting] = React.useState(false);
  const [exportShop, setExportShop] = React.useState("all");
  const [exportMonth, setExportMonth] = React.useState("all");

  const exportData = async () => {
    setExporting(true);
    try {
      const endpoint = endpointForTab(activeTab);
      const allRows: DataRow[] = [];
      let exportPage = 1;
      let pageCount = 1;

      do {
        const params = new URLSearchParams({
          shop: exportShop,
          month: exportMonth,
          page: String(exportPage),
          limit: "100",
          sort: sortKey,
          direction: sortDirection,
        });
        if (debouncedSearch) params.set("search", debouncedSearch);
        const response = await fetch(`${endpoint}?${params.toString()}`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Export request failed");
        const data = await response.json();
        allRows.push(...(data.rows || []));
        pageCount = data.totalPages || 1;
        exportPage += 1;
      } while (exportPage <= pageCount);

      const exportRows = allRows.map((row) =>
        Object.fromEntries(
          displayedColumns.map(([key, label]) => [label, row[key] ?? ""]),
        ),
      );
      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, activeTab);
      XLSX.writeFile(
        workbook,
        `flowa-${activeTab}-${exportMonth || "all"}.xlsx`,
      );
    } finally {
      setExporting(false);
    }
  };

  const exportAllData = async () => {
    setExporting(true);
    try {
      const configs = [
        { tab: "orders" as const, sheet: "Orders", columns: orderColumns },
        {
          tab: "statements" as const,
          sheet: "Statements",
          columns: statementColumns,
        },
        { tab: "items" as const, sheet: "Items", columns: itemColumns },
      ];
      const workbook = XLSX.utils.book_new();

      for (const config of configs) {
        const allRows: DataRow[] = [];
        let exportPage = 1;
        let pageCount = 1;
        do {
          const params = new URLSearchParams({
            shop: exportShop,
            month: exportMonth,
            page: String(exportPage),
            limit: "100",
            sort: config.tab === "statements" ? "statement_date" : "sale_date",
            direction: "desc",
          });
          if (debouncedSearch) params.set("search", debouncedSearch);
          const response = await fetch(
            `${endpointForTab(config.tab)}?${params.toString()}`,
            { cache: "no-store" },
          );
          if (!response.ok) throw new Error("Export request failed");
          const data = await response.json();
          allRows.push(...(data.rows || []));
          pageCount = data.totalPages || 1;
          exportPage += 1;
        } while (exportPage <= pageCount);

        const exportRows = allRows.map((row) =>
          Object.fromEntries(
            config.columns.map(([key, label]) => [label, row[key] ?? ""]),
          ),
        );
        XLSX.utils.book_append_sheet(
          workbook,
          XLSX.utils.json_to_sheet(exportRows),
          config.sheet,
        );
      }

      XLSX.writeFile(workbook, `flowa-all-${exportMonth || "all"}.xlsx`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5 cursor-pointer font-medium hover:border-foreground/30 transition-all"
            disabled={disabled || exporting}
          />
        }
      >
        <DownloadIcon
          className={`size-3.5 text-muted-foreground ${
            exporting ? "animate-pulse text-purple-600" : ""
          }`}
        />
        <span>{exporting ? "Đang xuất..." : "Xuất"}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="w-72 p-2.5 rounded-xl border border-border/70 shadow-lg bg-popover/95 backdrop-blur-md"
      >
        <DropdownMenuGroup>
          <div className="px-1 pt-0.5 pb-2">
            <p className="text-xs font-semibold text-foreground">
              Xuất dữ liệu Excel (.xlsx)
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Lọc phạm vi dữ liệu tải về máy tính
            </p>
          </div>

          <div className="space-y-2.5 py-2 px-1">
            <div>
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Gian hàng
              </span>
              <div className="relative">
                <select
                  aria-label="Shop xuất dữ liệu"
                  className="h-8 w-full rounded-lg border border-border/70 bg-muted/30 px-2.5 text-xs text-foreground font-medium focus:outline-hidden focus:border-foreground/50 transition-colors appearance-none cursor-pointer pr-7"
                  value={exportShop}
                  onChange={(event) => setExportShop(event.target.value)}
                >
                  <option value="all">Tất cả Shop (All)</option>
                  {shops.map((shop) => (
                    <option key={shop.code} value={shop.code}>
                      {shop.name}
                    </option>
                  ))}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-[10px]">
                  ▼
                </div>
              </div>
            </div>

            <div>
              <span className="text-[11px] font-medium text-muted-foreground block mb-1">
                Kỳ phát sinh
              </span>
              <div className="relative">
                <select
                  aria-label="Tháng xuất dữ liệu"
                  className="h-8 w-full rounded-lg border border-border/70 bg-muted/30 px-2.5 text-xs text-foreground font-mono focus:outline-hidden focus:border-foreground/50 transition-colors appearance-none cursor-pointer pr-7"
                  value={exportMonth}
                  onChange={(event) => setExportMonth(event.target.value)}
                >
                  <option value="all">Tất cả tháng</option>
                  {availableMonths.map((month) => {
                    const [year, monthNumber] = month.split("-");
                    return (
                      <option key={month} value={month}>
                        Tháng {Number(monthNumber)}/{year}
                      </option>
                    );
                  })}
                </select>
                <div className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-[10px]">
                  ▼
                </div>
              </div>
            </div>
          </div>

          <DropdownMenuSeparator className="my-2 -mx-1" />

          <div className="space-y-1 pt-0.5">
            <DropdownMenuItem
              onClick={() => void exportData()}
              className="p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs hover:bg-accent focus:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
                  <FileSpreadsheetIcon className="size-3.5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">
                    Xuất tab hiện tại
                  </p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {activeTab} sheet ({displayedColumns.length} cột)
                  </p>
                </div>
              </div>
              <ArrowDownToLineIcon className="size-3.5 text-muted-foreground" />
            </DropdownMenuItem>

            <DropdownMenuItem
              onClick={() => void exportAllData()}
              className="p-2 rounded-lg cursor-pointer flex items-center justify-between text-xs hover:bg-accent focus:bg-accent transition-colors"
            >
              <div className="flex items-center gap-2">
                <div className="size-6 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <LayersIcon className="size-3.5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-foreground">
                    Xuất toàn bộ dữ liệu
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Gộp cả 3 sheet (Orders, Items, Statements)
                  </p>
                </div>
              </div>
              <ArrowDownToLineIcon className="size-3.5 text-muted-foreground" />
            </DropdownMenuItem>
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
