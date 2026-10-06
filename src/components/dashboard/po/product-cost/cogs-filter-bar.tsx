"use client";

import { CalendarIcon, ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import { syncMonths } from "@/components/dashboard/po/product-cost/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CogsFilterBarProps {
  month: string;
  onMonthChange: (month: string) => void;
  supplier: string;
  onSupplierChange: (supplier: string) => void;
  suppliers: string[];
  totalCogs: number;
  visibleRowCount: number;
  message: string;
  syncing: boolean;
  historyRunning: boolean;
  selectedSyncMonths: string[];
  onToggleSyncMonth: (month: string, checked: boolean) => void;
  onSetSelectedSyncMonths: (months: string[]) => void;
  onSync: () => void;
}

export function CogsFilterBar({
  month,
  onMonthChange,
  supplier,
  onSupplierChange,
  suppliers,
  totalCogs,
  visibleRowCount,
  message,
  syncing,
  historyRunning,
  selectedSyncMonths,
  onToggleSyncMonth,
  onSetSelectedSyncMonths,
  onSync,
}: CogsFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
            <CalendarIcon className="size-3.5" /> Tháng:
          </span>
          <Select
            value={month}
            onValueChange={(val) => {
              if (val) {
                onMonthChange(String(val));
              }
            }}
          >
            <SelectTrigger
              aria-label="Select COGS month"
              className="h-8 min-w-[130px] text-xs font-mono"
            >
              <SelectValue placeholder="Chọn tháng" />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 12 }, (_, index) => {
                const value = `2026-${String(index + 1).padStart(2, "0")}`;
                return (
                  <SelectItem
                    key={value}
                    value={value}
                    className="text-xs font-mono"
                  >
                    Tháng {index + 1}/2026
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">
            Supplier:
          </span>
          <Select
            value={supplier}
            onValueChange={(val) => {
              if (val) onSupplierChange(String(val));
            }}
          >
            <SelectTrigger
              aria-label="Select COGS supplier"
              className="h-8 min-w-[120px] text-xs font-mono"
            >
              <SelectValue placeholder="Chọn Supplier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs font-mono">
                Tất cả
              </SelectItem>
              {suppliers.map((name) => (
                <SelectItem
                  key={name}
                  value={name}
                  className="text-xs font-mono"
                >
                  {name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="hidden sm:flex items-center gap-3 border-l border-border/60 pl-3 text-xs font-mono">
          <span className="text-muted-foreground">
            Total COGS:{" "}
            <strong className="text-foreground font-semibold">
              $
              {totalCogs.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </strong>
          </span>
          <span className="text-muted-foreground">
            ({visibleRowCount} dòng)
          </span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {message ? (
          <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded">
            {message}
          </span>
        ) : null}
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                disabled={syncing || historyRunning}
              />
            }
          >
            <RefreshCwIcon
              className={`size-3.5 ${syncing || historyRunning ? "animate-spin" : ""}`}
            />
            {syncing || historyRunning ? "Đang sync..." : "Sync COGS"}
            <ChevronDownIcon className="size-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Chọn tháng đồng bộ</DropdownMenuLabel>
              <DropdownMenuCheckboxItem
                checked={selectedSyncMonths.length === syncMonths.length}
                onCheckedChange={(checked) =>
                  onSetSelectedSyncMonths(checked === true ? syncMonths : [])
                }
              >
                Tất cả tháng
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              {syncMonths.map((value, index) => (
                <DropdownMenuCheckboxItem
                  checked={selectedSyncMonths.includes(value)}
                  key={value}
                  onCheckedChange={(checked) =>
                    onToggleSyncMonth(value, checked === true)
                  }
                >
                  Tháng {index + 1}/2026
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center font-medium"
              disabled={selectedSyncMonths.length === 0}
              onClick={onSync}
            >
              Đồng bộ đã chọn ({selectedSyncMonths.length})
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
