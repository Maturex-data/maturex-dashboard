"use client";

import {
  CalendarIcon,
  Columns3Icon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FlowaExportDropdown } from "./flowa-export-dropdown";
import type { Column, ShopOption, TableTab } from "./flowa-table-columns";

interface FlowaFilterBarProps {
  activeTab: TableTab;
  shops: ShopOption[];
  selectedShop: string;
  onShopChange: (shop: string) => void;
  selectedMonth: string;
  onMonthChange: (month: string) => void;
  availableMonths: string[];
  searchTerm: string;
  onSearchChange: (val: string) => void;
  debouncedSearch: string;
  loading: boolean;
  onRefresh: () => void;
  currentColumns: readonly Column[];
  currentVisibility: Record<string, boolean>;
  onVisibilityChange: (key: string, checked: boolean) => void;
  displayedColumns: Column[];
  sortKey: string;
  sortDirection: "asc" | "desc";
}

export function FlowaFilterBar({
  activeTab,
  shops,
  selectedShop,
  onShopChange,
  selectedMonth,
  onMonthChange,
  availableMonths,
  searchTerm,
  onSearchChange,
  debouncedSearch,
  loading,
  onRefresh,
  currentColumns,
  currentVisibility,
  onVisibilityChange,
  displayedColumns,
  sortKey,
  sortDirection,
}: FlowaFilterBarProps) {
  return (
    <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/60 p-3.5 rounded-xl border border-border/60 shadow-xs backdrop-blur-xs">
      <div className="flex flex-wrap items-center gap-2.5">
        {/* Shop Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">
            Shop:
          </span>
          <div className="relative">
            <select
              aria-label="Lọc theo Shop"
              value={selectedShop}
              onChange={(e) => onShopChange(e.target.value)}
              className="h-8 rounded-lg border border-border/60 bg-background pl-2.5 pr-7 text-xs text-foreground font-medium focus:outline-hidden focus:border-foreground/40 transition-colors appearance-none cursor-pointer shadow-2xs"
            >
              <option value="all">Tất cả Shop (All)</option>
              {shops.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-[9px]">
              ▼
            </div>
          </div>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <CalendarIcon className="size-3.5" /> Kỳ:
          </span>
          <div className="relative">
            <select
              aria-label="Lọc theo Tháng"
              value={selectedMonth}
              onChange={(e) => onMonthChange(e.target.value)}
              className="h-8 rounded-lg border border-border/60 bg-background pl-2.5 pr-7 text-xs text-foreground font-mono focus:outline-hidden focus:border-foreground/40 transition-colors appearance-none cursor-pointer shadow-2xs"
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
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/60 text-[9px]">
              ▼
            </div>
          </div>
        </div>

        {/* Local Search Input */}
        <div className="relative w-48 sm:w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
          <input
            type="text"
            placeholder={
              activeTab === "orders"
                ? "Tìm Order ID, khách hàng, SKU..."
                : activeTab === "items"
                  ? "Tìm Order ID, tên SP, SKU..."
                  : "Tìm nội dung, Order Ref, loại phí..."
            }
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-background pl-8 pr-7 py-1 rounded-lg border border-border/60 text-xs placeholder:text-muted-foreground focus:outline-hidden focus:border-foreground/60 transition-colors h-8 shadow-2xs"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground text-xs size-4 flex items-center justify-center rounded-full hover:bg-muted"
              title="Xóa tìm kiếm"
            >
              ✕
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-2 justify-end">
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={onRefresh}
          disabled={loading}
        >
          <RefreshCwIcon
            className={`size-3.5 ${loading ? "animate-spin" : ""}`}
          />
          Tải lại
        </Button>

        <FlowaExportDropdown
          activeTab={activeTab}
          shops={shops}
          availableMonths={availableMonths}
          displayedColumns={displayedColumns}
          debouncedSearch={debouncedSearch}
          sortKey={sortKey}
          sortDirection={sortDirection}
          disabled={loading}
        />

        {/* Column Toggle Dropdown */}
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
            Cột ({displayedColumns.length}/{currentColumns.length})
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 max-h-80 overflow-y-auto"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="text-xs">
                Hiển thị cột
              </DropdownMenuLabel>
              {currentColumns.map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  checked={currentVisibility[key]}
                  key={key}
                  className="text-xs"
                  onCheckedChange={(checked) =>
                    onVisibilityChange(key, checked === true)
                  }
                >
                  {label}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
