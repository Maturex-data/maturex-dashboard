"use client";

import {
  CalendarIcon,
  Columns3Icon,
  RefreshCwIcon,
  SearchIcon,
  StoreIcon,
  XIcon,
} from "lucide-react";
import { FlowaExportDropdown } from "@/components/dashboard/fl/table/flowa-export-dropdown";
import type {
  Column,
  ShopOption,
  TableTab,
} from "@/components/dashboard/fl/table/flowa-table-columns";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <StoreIcon className="size-3.5" /> Shop:
          </span>
          <Select
            value={selectedShop}
            onValueChange={(val) => {
              if (val) onShopChange(String(val));
            }}
          >
            <SelectTrigger
              aria-label="Lọc theo Shop"
              className="h-8 min-w-[140px] text-xs font-medium"
            >
              <SelectValue placeholder="Tất cả Shop (All)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Tất cả Shop (All)
              </SelectItem>
              {shops.map((s) => (
                <SelectItem key={s.code} value={s.code} className="text-xs">
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Month Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
            <CalendarIcon className="size-3.5" /> Kỳ:
          </span>
          <Select
            value={selectedMonth}
            onValueChange={(val) => {
              if (val) onMonthChange(String(val));
            }}
          >
            <SelectTrigger
              aria-label="Lọc theo Tháng"
              className="h-8 min-w-[130px] text-xs font-medium"
            >
              <SelectValue placeholder="Tất cả tháng" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">
                Tất cả tháng
              </SelectItem>
              {availableMonths.map((month) => {
                const [year, monthNumber] = month.split("-");
                return (
                  <SelectItem key={month} value={month} className="text-xs">
                    Tháng {Number(monthNumber)}/{year}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {/* Local Search Input */}
        <div className="relative w-48 sm:w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
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
            className="h-8 pl-8 pr-7 text-xs shadow-2xs"
          />
          {searchTerm ? (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2 top-2 text-muted-foreground hover:text-foreground text-xs size-4 flex items-center justify-center rounded-full hover:bg-muted"
              title="Xóa tìm kiếm"
            >
              <XIcon className="size-3" />
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
