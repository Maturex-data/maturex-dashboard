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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

function formatMoney(val: unknown): string {
  if (val === null || val === undefined) return "0.00";
  const num = typeof val === "number" ? val : Number(val);
  return Number.isNaN(num) ? "0.00" : num.toFixed(2);
}

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

  // biome-ignore lint/suspicious/noExplicitAny: dynamic sheet row properties across 4 disparate sheet schemas
  type SheetRow = Record<string, any>;

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

  // Reset pagination and clear stale data when tab or month changes
  React.useEffect(() => {
    if (activeTab || selectedMonth) {
      setData([]);
      setPage(1);
      setSearch("");
      setDebouncedSearch("");
      setSupplierFilter("");
      setTypeFilter("");
      setAccountFilter("");
      setSortField(undefined);
    }
  }, [activeTab, selectedMonth]);

  // Debounce search
  React.useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(handler);
  }, [search]);

  // Fetch sheet rows
  const fetchRows = React.useCallback(async () => {
    try {
      setIsLoading(true);
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

      const res = await fetch(`/api/ec/sheet-rows?${params.toString()}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setData(json.data.rows || []);
        setTotal(json.data.total || 0);
        setTotalPages(json.data.totalPages || 1);
        if (json.data.filterOptions) {
          setFilterOptions(json.data.filterOptions);
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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const handleExport = () => {
    if (data.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, activeTab.toUpperCase());
    XLSX.writeFile(wb, `EC_${activeTab.toUpperCase()}_${selectedMonth}.xlsx`);
  };

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
            <SearchIcon className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm kiếm trong tab..."
              className="w-full bg-background pl-8 pr-3 rounded-lg border border-border/80 h-8 text-xs placeholder:text-muted-foreground focus:outline-hidden focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Supplier filter for COGS */}
          {activeTab === "cogs" &&
            filterOptions.suppliers &&
            filterOptions.suppliers.length > 0 && (
              <select
                value={supplierFilter}
                onChange={(e) => {
                  setSupplierFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg bg-background border border-border/80 px-2 text-xs text-foreground focus:outline-hidden"
              >
                <option value="">Tất cả Supplier</option>
                {filterOptions.suppliers.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            )}

          {/* Type filter for Payouts */}
          {activeTab === "payouts" &&
            filterOptions.types &&
            filterOptions.types.length > 0 && (
              <select
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg bg-background border border-border/80 px-2 text-xs text-foreground focus:outline-hidden"
              >
                <option value="">Tất cả Loại GD</option>
                {filterOptions.types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            )}

          {/* Account filter for Ads */}
          {activeTab === "ads" &&
            filterOptions.accounts &&
            filterOptions.accounts.length > 0 && (
              <select
                value={accountFilter}
                onChange={(e) => {
                  setAccountFilter(e.target.value);
                  setPage(1);
                }}
                className="h-8 rounded-lg bg-background border border-border/80 px-2 text-xs text-foreground focus:outline-hidden"
              >
                <option value="">Tất cả Account</option>
                {filterOptions.accounts.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
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
          <div className="overflow-x-auto max-h-[560px] relative divide-y divide-border/40">
            {/* 1. ORDERS TABLE */}
            {activeTab === "orders" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10 font-medium border-b border-border/60 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Month</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Row</th>
                    <th
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("orderName")}
                    >
                      Order{" "}
                      {sortField === "orderName" &&
                        (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                    <th
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("orderDate")}
                    >
                      Date{" "}
                      {sortField === "orderDate" &&
                        (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Gross sales
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Discounts
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Shipping
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Tax
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-foreground">
                      Corrected net
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Refund
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Before refund
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Source</th>
                    <th className="py-2.5 px-3 min-w-[200px]">Item name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="py-8 text-center text-muted-foreground font-sans"
                      >
                        {isLoading
                          ? "Đang tải dữ liệu..."
                          : "Không có bản ghi nào."}
                      </td>
                    </tr>
                  ) : (
                    data.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.month}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.sourceRow}
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground font-sans">
                          {r.orderName}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.orderDate}
                        </td>
                        <td className="py-2 px-3 text-right">
                          ${formatMoney(r.grossSales)}
                        </td>
                        <td className="py-2 px-3 text-right text-rose-600 dark:text-rose-400">
                          {Number(r.discounts) > 0
                            ? `-${formatMoney(r.discounts)}`
                            : "0.00"}
                        </td>
                        <td className="py-2 px-3 text-right">
                          ${formatMoney(r.shippingCharged)}
                        </td>
                        <td className="py-2 px-3 text-right">
                          ${formatMoney(r.originalTax)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-foreground">
                          ${formatMoney(r.correctedNet)}
                        </td>
                        <td className="py-2 px-3 text-right text-amber-600 dark:text-amber-400">
                          {Number(r.refundSnapshot) > 0
                            ? `-$${formatMoney(r.refundSnapshot)}`
                            : "0.00"}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          ${formatMoney(r.beforeRefund)}
                        </td>
                        <td className="py-2 px-3 font-sans text-muted-foreground">
                          {r.source || "—"}
                        </td>
                        <td
                          className="py-2 px-3 font-sans text-muted-foreground max-w-[240px] truncate"
                          title={r.itemName}
                        >
                          {r.itemName || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 2. COGS TABLE */}
            {activeTab === "cogs" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10 font-medium border-b border-border/60 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Month</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Row</th>
                    <th
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("supplier")}
                    >
                      Supplier{" "}
                      {sortField === "supplier" &&
                        (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                    <th
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("costDate")}
                    >
                      Date{" "}
                      {sortField === "costDate" &&
                        (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      Reference Order
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      Supplier Order
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-foreground">
                      Total cost
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Estimated cost
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Row key</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Treatment</th>
                    <th className="py-2.5 px-3 min-w-[180px]">Items name</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-8 text-center text-muted-foreground font-sans"
                      >
                        {isLoading
                          ? "Đang tải dữ liệu..."
                          : "Không có bản ghi nào."}
                      </td>
                    </tr>
                  ) : (
                    data.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.month}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.sourceRow}
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground font-sans">
                          {r.supplier}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.costDate}
                        </td>
                        <td className="py-2 px-3 font-sans text-foreground">
                          {r.referenceOrderId || "—"}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.supplierOrderId || "—"}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-foreground">
                          ${formatMoney(r.totalCost)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          ${formatMoney(r.estimatedCost)}
                        </td>
                        <td
                          className="py-2 px-3 text-muted-foreground text-[11px] truncate max-w-[140px]"
                          title={r.rowKey}
                        >
                          {r.rowKey}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <Badge
                            variant="outline"
                            className={`text-[10px] py-0 px-1 font-medium ${
                              r.treatment?.includes("Loại")
                                ? "border-muted text-muted-foreground bg-muted/40"
                                : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
                            }`}
                          >
                            {r.treatment || "—"}
                          </Badge>
                        </td>
                        <td
                          className="py-2 px-3 font-sans text-muted-foreground max-w-[200px] truncate"
                          title={r.itemsName}
                        >
                          {r.itemsName || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 3. ADS TABLE */}
            {activeTab === "ads" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10 font-medium border-b border-border/60 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">Month</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Row</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      External ID
                    </th>
                    <th
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("date")}
                    >
                      Date{" "}
                      {sortField === "date" && (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      Account ID
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Currency</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-foreground">
                      Spend
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      Granularity
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-8 text-center text-muted-foreground font-sans"
                      >
                        {isLoading
                          ? "Đang tải dữ liệu..."
                          : "Không có bản ghi nào."}
                      </td>
                    </tr>
                  ) : (
                    data.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.month}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.sourceRow}
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">
                          {r.externalId}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.date}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.accountId}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.currency}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-violet-600 dark:text-violet-400">
                          ${formatMoney(r.spend)}
                        </td>
                        <td className="py-2 px-3 font-sans text-muted-foreground">
                          {r.granularity}
                        </td>
                        <td className="py-2 px-3 font-sans text-muted-foreground">
                          {r.source || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}

            {/* 4. PAYOUTS TABLE */}
            {activeTab === "payouts" && (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-muted/60 text-muted-foreground sticky top-0 z-10 font-medium border-b border-border/60 backdrop-blur-md">
                  <tr>
                    <th className="py-2.5 px-3 whitespace-nowrap">
                      Month local
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Row</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Tx ID</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Payout ID</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Type</th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Currency</th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Gross
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap font-semibold text-foreground">
                      Fee
                    </th>
                    <th className="py-2.5 px-3 text-right whitespace-nowrap">
                      Net
                    </th>
                    <th
                      className="py-2.5 px-3 whitespace-nowrap cursor-pointer hover:text-foreground"
                      onClick={() => handleSort("processedUtc")}
                    >
                      Processed Vietnam{" "}
                      {sortField === "processedUtc" &&
                        (sortDir === "asc" ? "▲" : "▼")}
                    </th>
                    <th className="py-2.5 px-3 whitespace-nowrap">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40 font-mono">
                  {data.length === 0 ? (
                    <tr>
                      <td
                        colSpan={11}
                        className="py-8 text-center text-muted-foreground font-sans"
                      >
                        {isLoading
                          ? "Đang tải dữ liệu..."
                          : "Không có bản ghi nào."}
                      </td>
                    </tr>
                  ) : (
                    data.map((r) => (
                      <tr
                        key={r.id}
                        className="hover:bg-muted/30 transition-colors"
                      >
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.monthLocal}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.sourceRow}
                        </td>
                        <td className="py-2 px-3 font-semibold text-foreground text-[11px]">
                          {r.balanceTransactionId}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-[11px]">
                          {r.payoutId || "—"}
                        </td>
                        <td className="py-2 px-3 font-sans">
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1 font-medium"
                          >
                            {r.type}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {r.currency}
                        </td>
                        <td className="py-2 px-3 text-right">
                          ${formatMoney(r.gross)}
                        </td>
                        <td className="py-2 px-3 text-right font-bold text-sky-600 dark:text-sky-400">
                          ${formatMoney(r.fee)}
                        </td>
                        <td className="py-2 px-3 text-right text-muted-foreground">
                          ${formatMoney(r.net)}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">
                          {r.processedVietnam}
                        </td>
                        <td
                          className="py-2 px-3 font-sans text-muted-foreground max-w-[150px] truncate"
                          title={r.reason}
                        >
                          {r.reason || "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            )}
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
