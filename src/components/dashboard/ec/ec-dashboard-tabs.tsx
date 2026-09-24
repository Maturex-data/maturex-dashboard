"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  Loader2Icon,
  MegaphoneIcon,
  PackageCheckIcon,
  SearchIcon,
  ShoppingBagIcon,
  WalletCardsIcon,
} from "lucide-react";
import * as React from "react";
import * as XLSX from "xlsx";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getTabColumns, type SheetRow } from "./ec-tab-columns";

interface EcDashboardTabsProps {
  selectedMonth: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function EcDashboardTabs({
  selectedMonth,
  activeTab,
  onTabChange,
}: EcDashboardTabsProps) {
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(50);
  const [sortField, setSortField] = React.useState<string | undefined>();
  const [sortDir, setSortDir] = React.useState<"asc" | "desc">("desc");
  const [search, setSearch] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // Filters
  const [supplierFilter, setSupplierFilter] = React.useState<string>("");
  const [typeFilter, setTypeFilter] = React.useState<string>("");
  const [accountFilter, setAccountFilter] = React.useState<string>("");

  // Data state
  const [isLoading, setIsLoading] = React.useState(false);
  const [data, setData] = React.useState<SheetRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [filterOptions, setFilterOptions] = React.useState<{
    suppliers?: string[];
    types?: string[];
    accounts?: string[];
  }>({});

  // In-memory tab cache to make switching instantaneous (0ms)
  const tabCacheRef = React.useRef<
    Record<
      string,
      {
        data: SheetRow[];
        total: number;
        totalPages: number;
        filterOptions?: {
          suppliers?: string[];
          types?: string[];
          accounts?: string[];
        };
      }
    >
  >({});

  // Clear cache if month changes
  React.useEffect(() => {
    if (selectedMonth) {
      tabCacheRef.current = {};
      setData([]);
      setPage(1);
      setSearch("");
      setDebouncedSearch("");
      setSupplierFilter("");
      setTypeFilter("");
      setAccountFilter("");
      setSortField(undefined);
    }
  }, [selectedMonth]);

  // Reset filters & page on tab change without wiping existing cached data
  React.useEffect(() => {
    if (activeTab) {
      setPage(1);
      setSearch("");
      setDebouncedSearch("");
      setSupplierFilter("");
      setTypeFilter("");
      setAccountFilter("");
      setSortField(undefined);
    }
  }, [activeTab]);

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch sheet rows with instant memory cache
  const fetchRows = React.useCallback(async () => {
    const params = new URLSearchParams({
      sheet: activeTab,
      month: selectedMonth,
      page: String(page),
      limit: String(limit),
    });

    if (sortField) {
      params.set("sort", sortField);
      params.set("dir", sortDir);
    }
    if (debouncedSearch) params.set("search", debouncedSearch);
    if (supplierFilter) params.set("supplier", supplierFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (accountFilter) params.set("account", accountFilter);

    const cacheKey = params.toString();
    const cached = tabCacheRef.current[cacheKey];

    // If cached, display instantly with 0ms delay and no loading spinner
    if (cached) {
      setData(cached.data);
      setTotal(cached.total);
      setTotalPages(cached.totalPages);
      if (cached.filterOptions) {
        setFilterOptions(cached.filterOptions);
      }
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const res = await fetch(`/api/ec/sheet-rows?${cacheKey}`);
      const json = await res.json();
      if (res.ok && json.success) {
        const rows = json.data.rows || [];
        const tot = json.data.total || 0;
        const totPages = json.data.totalPages || 1;
        const opts = json.data.filterOptions;

        tabCacheRef.current[cacheKey] = {
          data: rows,
          total: tot,
          totalPages: totPages,
          filterOptions: opts,
        };

        setData(rows);
        setTotal(tot);
        setTotalPages(totPages);
        if (opts) {
          setFilterOptions(opts);
        }
      }
    } catch {
      // Keep existing data on error
    } finally {
      setIsLoading(false);
    }
  }, [
    activeTab,
    selectedMonth,
    page,
    limit,
    sortField,
    sortDir,
    debouncedSearch,
    supplierFilter,
    typeFilter,
    accountFilter,
  ]);

  React.useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  const handleSort = React.useCallback((field: string) => {
    setSortField((currentField) => {
      if (currentField === field) {
        setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
        return field;
      }
      setSortDir("desc");
      return field;
    });
  }, []);

  const handleExport = () => {
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.toUpperCase());
    XLSX.writeFile(wb, `EC_${activeTab.toUpperCase()}_${selectedMonth}.xlsx`);
  };

  const columns = React.useMemo(
    () => getTabColumns(activeTab, sortField, sortDir, handleSort),
    [activeTab, sortField, sortDir, handleSort],
  );

  return (
    <Tabs
      value={activeTab}
      onValueChange={onTabChange}
      className="space-y-4 min-w-0"
    >
      <div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="bg-muted/70 p-1 rounded-xl h-auto border border-border/50 flex w-max sm:w-auto">
            <TabsTrigger
              value="orders"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <ShoppingBagIcon className="size-3.5 text-emerald-500 shrink-0" />
              <span>1. Orders</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                Sheet
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="cogs"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <PackageCheckIcon className="size-3.5 text-amber-500 shrink-0" />
              <span>2. COGS</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                Sheet
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="ads"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <MegaphoneIcon className="size-3.5 text-violet-500 shrink-0" />
              <span>3. Ads</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                Sheet
              </span>
            </TabsTrigger>

            <TabsTrigger
              value="payouts"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <WalletCardsIcon className="size-3.5 text-sky-500 shrink-0" />
              <span>4. Payouts</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                Shopify
              </span>
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Global Tab Controls (Search, Filters, Export) */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="relative w-44 sm:w-56">
            <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground z-10 pointer-events-none" />
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm trong tab..."
              className="w-full bg-background pl-8 pr-3 h-8 text-xs border-border/80"
            />
          </div>

          {/* Supplier filter for COGS */}
          {activeTab === "cogs" &&
            filterOptions.suppliers &&
            filterOptions.suppliers.length > 0 && (
              <Select
                value={supplierFilter || "__ALL__"}
                onValueChange={(val) => {
                  setSupplierFilter(!val || val === "__ALL__" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-[130px] rounded-lg bg-background border-border/80 px-2.5 text-xs text-foreground shadow-2xs">
                  <SelectValue placeholder="Tất cả Supplier" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="__ALL__" className="text-xs">
                    Tất cả Supplier
                  </SelectItem>
                  {filterOptions.suppliers.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs">
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

          {/* Type filter for Payouts */}
          {activeTab === "payouts" &&
            filterOptions.types &&
            filterOptions.types.length > 0 && (
              <Select
                value={typeFilter || "__ALL__"}
                onValueChange={(val) => {
                  setTypeFilter(!val || val === "__ALL__" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-[130px] rounded-lg bg-background border-border/80 px-2.5 text-xs text-foreground shadow-2xs">
                  <SelectValue placeholder="Tất cả Loại GD" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="__ALL__" className="text-xs">
                    Tất cả Loại GD
                  </SelectItem>
                  {filterOptions.types.map((t) => (
                    <SelectItem key={t} value={t} className="text-xs">
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

          {/* Account filter for Ads */}
          {activeTab === "ads" &&
            filterOptions.accounts &&
            filterOptions.accounts.length > 0 && (
              <Select
                value={accountFilter || "__ALL__"}
                onValueChange={(val) => {
                  setAccountFilter(!val || val === "__ALL__" ? "" : val);
                  setPage(1);
                }}
              >
                <SelectTrigger className="h-8 w-auto min-w-[130px] rounded-lg bg-background border-border/80 px-2.5 text-xs text-foreground shadow-2xs">
                  <SelectValue placeholder="Tất cả Account" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="__ALL__" className="text-xs">
                    Tất cả Account
                  </SelectItem>
                  {filterOptions.accounts.map((a) => (
                    <SelectItem key={a} value={a} className="text-xs">
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleExport}
            disabled={data.length === 0}
            className="h-8 text-xs gap-1.5"
          >
            <DownloadIcon className="size-3.5" />
            <span className="hidden sm:inline">Xuất Excel</span>
          </Button>
        </div>
      </div>

      {/* TAB CONTENT CARDS */}
      <Card className="border-border/60 shadow-xs overflow-hidden bg-card/60 backdrop-blur-xs">
        <CardHeader className="py-3 px-4 bg-muted/20 border-b border-border/50 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              {activeTab === "orders" &&
                "Dữ Liệu Đơn Hàng Chi Tiết (Orders Sheet)"}
              {activeTab === "cogs" && "Dữ Liệu Chi Phí Sản Phẩm (COGS Sheet)"}
              {activeTab === "ads" && "Dữ Liệu Chi Phí Meta Ads (Ads Sheet)"}
              {activeTab === "payouts" &&
                "Dữ Liệu Đối Soát Payout (Shopify Payments)"}
            </CardTitle>
            <CardDescription className="text-xs mt-0.5">
              Hiển thị {data.length} / {total.toLocaleString()} dòng dữ liệu
              được đồng bộ từ Google Spreadsheet.
            </CardDescription>
          </div>
          {isLoading && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
              <Loader2Icon className="size-3.5 animate-spin text-primary" />
              <span>Đang tải...</span>
            </div>
          )}
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto max-h-[560px] relative border-b border-border/40">
            <DataTable
              columns={columns}
              data={data}
              keyExtractor={(r, idx) => r.id || `${activeTab}-${idx}`}
              tableClassName="text-xs border-collapse"
              headerClassName="bg-muted/70 sticky top-0 z-10 font-medium border-b border-border/60 backdrop-blur-md"
              rowClassName={() =>
                "hover:bg-muted/30 transition-colors border-border/40 font-mono"
              }
              emptyMessage={
                <div className="py-12 text-center text-muted-foreground font-sans">
                  {isLoading ? "Đang tải dữ liệu..." : "Không có bản ghi nào."}
                </div>
              }
            />
          </div>

          {/* Pagination Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 border-t border-border/50 text-xs bg-muted/10">
            <span className="text-muted-foreground">
              Trang{" "}
              <span className="font-mono font-medium text-foreground">
                {page}
              </span>{" "}
              / <span className="font-mono">{totalPages}</span> (Tổng{" "}
              {total.toLocaleString()} dòng)
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="outline"
                disabled={page <= 1 || isLoading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-7 w-7 p-0"
              >
                <ChevronLeftIcon className="size-3.5" />
              </Button>

              <span className="text-xs font-mono px-2 text-foreground font-medium">
                {page}
              </span>

              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages || isLoading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-7 w-7 p-0"
              >
                <ChevronRightIcon className="size-3.5" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </Tabs>
  );
}
