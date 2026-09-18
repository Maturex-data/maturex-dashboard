"use client";

import {
  DatabaseIcon,
  FileClockIcon,
  FileSpreadsheetIcon,
  ShoppingBagIcon,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import * as React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type EtsyTableResponse,
  getEtsyTableCache,
  invalidateEtsyTableCache,
  setEtsyTableCache,
} from "@/lib/etsy-table-cache";
import { FlowaFilterBar } from "./table/flowa-filter-bar";
import { FlowaPagination } from "./table/flowa-pagination";
import {
  type Column,
  currentMonth,
  type DataRow,
  endpointForTab,
  isTableTab,
  itemColumns,
  orderColumns,
  type ShopOption,
  statementColumns,
  type TableTab,
} from "./table/flowa-table-columns";
import { FlowaTableContent } from "./table/flowa-table-content";

export type { ShopOption };

export function FlowaDataTable({ shops }: { shops: ShopOption[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryTab = searchParams.get("tab");
  const queryShop = searchParams.get("shop");
  const queryMonth = searchParams.get("month");
  const initialTab: TableTab = isTableTab(queryTab) ? queryTab : "orders";
  const initialShop =
    queryShop &&
    (queryShop === "all" || shops.some((shop) => shop.code === queryShop))
      ? queryShop
      : "all";

  const [activeTab, setActiveTab] = React.useState<TableTab>(initialTab);
  const [selectedShop, setSelectedShop] = React.useState(initialShop);
  const [selectedMonth, setSelectedMonth] = React.useState(
    queryMonth || currentMonth(),
  );
  const [sortKey, setSortKey] = React.useState("sale_date");
  const [sortDirection, setSortDirection] = React.useState<"asc" | "desc">(
    "desc",
  );
  const [availableMonths, setAvailableMonths] = React.useState<string[]>([]);
  const [searchTerm, setSearchTerm] = React.useState("");
  const [debouncedSearch, setDebouncedSearch] = React.useState("");

  // Pagination states
  const [page, setPage] = React.useState(1);
  const [pageSize] = React.useState(50);

  // Data states
  const [rows, setRows] = React.useState<DataRow[]>([]);
  const [total, setTotal] = React.useState(0);
  const [totalPages, setTotalPages] = React.useState(1);
  const [loading, setLoading] = React.useState(true);

  // Column visibility
  const [orderVisible, setOrderVisible] = React.useState<
    Record<string, boolean>
  >(() => Object.fromEntries(orderColumns.map(([k]) => [k, true])));
  const [itemVisible, setItemVisible] = React.useState<Record<string, boolean>>(
    () => Object.fromEntries(itemColumns.map(([k]) => [k, true])),
  );
  const [statementVisible, setStatementVisible] = React.useState<
    Record<string, boolean>
  >(() => Object.fromEntries(statementColumns.map(([k]) => [k, true])));

  const replaceTableUrl = React.useCallback(
    (tab: TableTab, shop: string, month: string) => {
      const params = new URLSearchParams();
      params.set("tab", tab);
      params.set("shop", shop);
      params.set("month", month);
      router.replace(`/flowa?${params.toString()}`, { scroll: false });
    },
    [router],
  );

  React.useEffect(() => {
    setActiveTab(isTableTab(queryTab) ? queryTab : "orders");
    setSelectedShop(initialShop);
    setSelectedMonth(queryMonth || currentMonth());
    setPage(1);
  }, [initialShop, queryMonth, queryTab]);

  const applyResponse = React.useCallback(
    (data: EtsyTableResponse) => {
      setRows(data.rows || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
      const months = Array.isArray(data.availableMonths)
        ? data.availableMonths.filter(
            (month: unknown): month is string => typeof month === "string",
          )
        : [];
      setAvailableMonths(months);
      if (months.length > 0 && !months.includes(selectedMonth)) {
        setSelectedMonth(months[0]);
        setPage(1);
        replaceTableUrl(activeTab, selectedShop, months[0]);
      }
    },
    [activeTab, replaceTableUrl, selectedMonth, selectedShop],
  );

  // Handle search debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = React.useCallback(
    async (force = false) => {
      const cacheKey = [
        activeTab,
        selectedShop,
        selectedMonth,
        debouncedSearch,
        sortKey,
        sortDirection,
        page,
        pageSize,
      ].join("|");

      if (!force) {
        const cached = getEtsyTableCache(cacheKey);
        if (cached) {
          applyResponse(cached);
          setLoading(false);
          return;
        }
      }

      setLoading(true);
      try {
        const params = new URLSearchParams({
          shop: selectedShop,
          month: selectedMonth,
          page: String(page),
          limit: String(pageSize),
          sort: sortKey,
          direction: sortDirection,
        });
        if (debouncedSearch) params.set("search", debouncedSearch);

        const endpoint = endpointForTab(activeTab);

        const res = await fetch(`${endpoint}?${params.toString()}`, {
          cache: "no-store",
        });
        const data = await res.json();
        if (res.ok) {
          const response = data as EtsyTableResponse;
          setEtsyTableCache(cacheKey, response);
          applyResponse(response);
        } else {
          setRows([]);
          setTotal(0);
        }
      } catch {
        setRows([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [
      activeTab,
      applyResponse,
      selectedShop,
      selectedMonth,
      debouncedSearch,
      page,
      pageSize,
      sortKey,
      sortDirection,
    ],
  );

  React.useEffect(() => {
    void loadData();
  }, [loadData]);

  React.useEffect(() => {
    const handleCacheInvalidation = () => {
      invalidateEtsyTableCache();
      void loadData(true);
    };
    window.addEventListener("etsy-cache-invalidated", handleCacheInvalidation);
    return () =>
      window.removeEventListener(
        "etsy-cache-invalidated",
        handleCacheInvalidation,
      );
  }, [loadData]);

  const currentColumns =
    activeTab === "orders"
      ? orderColumns
      : activeTab === "items"
        ? itemColumns
        : statementColumns;

  const currentVisibility =
    activeTab === "orders"
      ? orderVisible
      : activeTab === "items"
        ? itemVisible
        : statementVisible;

  const setCurrentVisibility =
    activeTab === "orders"
      ? setOrderVisible
      : activeTab === "items"
        ? setItemVisible
        : setStatementVisible;

  const displayedColumns = currentColumns.filter(
    ([k]) => currentVisibility[k],
  ) as Column[];

  const handleSortChange = (key: string) => {
    if (sortKey === key) {
      setSortDirection((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDirection(key.includes("date") ? "desc" : "asc");
    }
    setPage(1);
  };

  return (
    <div className="space-y-4">
      {/* Top Filter Strip */}
      <FlowaFilterBar
        activeTab={activeTab}
        shops={shops}
        selectedShop={selectedShop}
        onShopChange={(shop) => {
          setSelectedShop(shop);
          setPage(1);
          replaceTableUrl(activeTab, shop, selectedMonth);
        }}
        selectedMonth={selectedMonth}
        onMonthChange={(month) => {
          setSelectedMonth(month);
          setPage(1);
          replaceTableUrl(activeTab, selectedShop, month);
        }}
        availableMonths={availableMonths}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        debouncedSearch={debouncedSearch}
        loading={loading}
        onRefresh={() => void loadData(true)}
        currentColumns={currentColumns}
        currentVisibility={currentVisibility}
        onVisibilityChange={(key, checked) =>
          setCurrentVisibility((curr) => ({
            ...curr,
            [key]: checked,
          }))
        }
        displayedColumns={displayedColumns}
        sortKey={sortKey}
        sortDirection={sortDirection}
      />

      {/* Main Card with Tabs */}
      <Card className="border-border/60 shadow-xs overflow-hidden bg-card/60 backdrop-blur-xs">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            if (val === "orders" || val === "items" || val === "statements") {
              setActiveTab(val);
              replaceTableUrl(val, selectedShop, selectedMonth);
            }
            setPage(1);
          }}
          className="w-full"
        >
          <div className="border-b border-border/60 bg-muted/10 px-5 pt-4 pb-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2 text-foreground tracking-tight">
                  <ShoppingBagIcon className="size-4 text-primary" />
                  Bảng Dữ Liệu Đối Tác Etsy (Flowa Hub)
                </h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Báo cáo đơn hàng, sao kê dòng tiền và dữ liệu sản phẩm chi
                  tiết.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground bg-muted/40 px-2.5 py-1 rounded-md border border-border/40">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>{total.toLocaleString()} bản ghi</span>
              </div>
            </div>

            <TabsList variant="line" className="gap-4 -mb-px">
              <TabsTrigger
                value="orders"
                className="gap-2 text-xs py-2 px-1 font-medium transition-colors hover:text-foreground"
              >
                <FileSpreadsheetIcon className="size-3.5 text-emerald-500" />
                <span>1. Đơn Hàng (Orders)</span>
                {activeTab === "orders" && (
                  <span className="ml-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono font-semibold">
                    {total}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="statements"
                className="gap-2 text-xs py-2 px-1 font-medium transition-colors hover:text-foreground"
              >
                <FileClockIcon className="size-3.5 text-purple-500" />
                <span>2. Sao Kê & Phí (Statements)</span>
                {activeTab === "statements" && (
                  <span className="ml-1 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.2 text-[10px] font-mono font-semibold">
                    {total}
                  </span>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="items"
                className="gap-2 text-xs py-2 px-1 font-medium transition-colors hover:text-foreground"
              >
                <DatabaseIcon className="size-3.5 text-sky-500" />
                <span>3. Chi Tiết SP (chỉ Artisanhand)</span>
                {activeTab === "items" && (
                  <span className="ml-1 rounded-full bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.2 text-[10px] font-mono font-semibold">
                    {total}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          <CardContent className="p-0">
            <FlowaTableContent
              displayedColumns={displayedColumns}
              rows={rows}
              loading={loading}
              sortKey={sortKey}
              sortDirection={sortDirection}
              onSortChange={handleSortChange}
            />

            <FlowaPagination
              page={page}
              pageSize={pageSize}
              total={total}
              totalPages={totalPages}
              loading={loading}
              onPageChange={setPage}
            />
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
