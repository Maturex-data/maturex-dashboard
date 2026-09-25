"use client";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  DownloadIcon,
  InboxIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatCurrency, formatNumber } from "@/lib/microm/formatters";

interface MicromTabsProps {
  selectedMonth: string;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function MicromTabs({
  selectedMonth,
  activeTab,
  onTabChange,
}: MicromTabsProps) {
  const [rows, setRows] = React.useState<Record<string, unknown>[]>([]);
  const [totalCount, setTotalCount] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(50);
  const [search, setSearch] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [dataTab, setDataTab] = React.useState(activeTab);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          tab: activeTab,
          month: selectedMonth,
          page: String(page),
          limit: String(limit),
        });
        if (search.trim()) {
          params.set("search", search.trim());
        }

        const res = await fetch(`/api/microm/rows?${params.toString()}`);
        const json = await res.json();
        if (!cancelled && res.ok && json.success) {
          setRows(json.data?.rows || []);
          setTotalCount(json.data?.totalCount || 0);
          setDataTab(activeTab);
        }
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to load rows:", err);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, selectedMonth, page, limit, search]);

  const handleTabChange = (newTab: string) => {
    setPage(1);
    onTabChange(newTab);
  };

  const handleClearSearch = () => {
    setSearch("");
    setPage(1);
  };

  const totalPages = Math.ceil(totalCount / limit) || 1;

  const handleExport = (format: "csv" | "xlsx") => {
    const url = `/api/microm/export?tab=${activeTab}&month=${selectedMonth}&format=${format}`;
    window.open(url, "_blank");
  };

  const isTabLoading = loading || dataTab !== activeTab;

  return (
    <Card className="border border-border/60 overflow-hidden">
      <div className="p-3.5 sm:p-4 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-muted/20">
        <Tabs
          value={activeTab}
          onValueChange={handleTabChange}
          className="w-full sm:w-auto"
        >
          <TabsList className="bg-muted/70 p-1">
            <TabsTrigger value="Orders" className="text-xs px-3">
              Orders
            </TabsTrigger>
            <TabsTrigger value="COGS" className="text-xs px-3">
              COGS
            </TabsTrigger>
            <TabsTrigger value="Ads" className="text-xs px-3">
              Ads
            </TabsTrigger>
            <TabsTrigger value="Shopify_Items" className="text-xs px-3">
              Shopify Items
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex items-center gap-2 self-end sm:self-auto">
          {/* Search box with clear button */}
          <div className="relative">
            <SearchIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm kiếm mã đơn, tài khoản..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="h-8 w-44 sm:w-56 pl-8 pr-7 text-xs rounded-md bg-background border border-border/60 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground/60"
            />
            {search && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <XIcon className="size-3" />
              </button>
            )}
          </div>

          {/* Export buttons */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleExport("xlsx")}
            className="h-8 text-xs gap-1 border-border/60"
          >
            <DownloadIcon className="size-3.5" />
            <span className="hidden xs:inline">Excel</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleExport("csv")}
            className="h-8 text-xs"
          >
            CSV
          </Button>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="overflow-x-auto min-h-[360px] max-h-[600px] relative">
          {isTabLoading ? (
            <div className="h-72 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <div className="size-5 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <span>Đang tải dữ liệu {activeTab}...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="h-72 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground">
              <InboxIcon className="size-8 text-muted-foreground/40" />
              <span className="font-medium text-foreground">
                Không tìm thấy dữ liệu trong tháng {selectedMonth}
              </span>
              <span className="text-[11px] text-muted-foreground/60 max-w-sm text-center">
                Vui lòng kiểm tra lại bộ lọc tìm kiếm hoặc thực hiện Import
                Sheet → DB snapshot
              </span>
            </div>
          ) : (
            <table className="w-full text-left text-xs whitespace-nowrap">
              <thead className="bg-muted/40 text-muted-foreground border-b border-border/40 font-medium sticky top-0 backdrop-blur-md z-10">
                {activeTab === "Orders" && (
                  <tr>
                    <th className="py-2.5 px-3.5">Mã Đơn</th>
                    <th className="py-2.5 px-3">Shopify ID</th>
                    <th className="py-2.5 px-3">Ngày tạo</th>
                    <th className="py-2.5 px-3">Kỳ</th>
                    <th className="py-2.5 px-3">Thanh toán</th>
                    <th className="py-2.5 px-3">Fulfillment</th>
                    <th className="py-2.5 px-3 text-right">Gross (EUR)</th>
                    <th className="py-2.5 px-3 text-right">
                      Doanh thu HL (EUR)
                    </th>
                    <th className="py-2.5 px-3 text-right">
                      Doanh thu HL (USD)
                    </th>
                    <th className="py-2.5 px-3">Nguồn dòng</th>
                  </tr>
                )}
                {activeTab === "COGS" && (
                  <tr>
                    <th className="py-2.5 px-3.5">PGPrint Order ID</th>
                    <th className="py-2.5 px-3">PGC Order ID</th>
                    <th className="py-2.5 px-3">Customer Order ID</th>
                    <th className="py-2.5 px-3">Ngày tạo</th>
                    <th className="py-2.5 px-3">Kỳ</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Production</th>
                    <th className="py-2.5 px-3 text-right">Shipping</th>
                    <th className="py-2.5 px-3 text-right">
                      COGS Source (USD)
                    </th>
                    <th className="py-2.5 px-3 text-right">COGS Đủ ĐK (USD)</th>
                    <th className="py-2.5 px-3">Kiểm soát</th>
                  </tr>
                )}
                {activeTab === "Ads" && (
                  <tr>
                    <th className="py-2.5 px-3.5">Tài khoản</th>
                    <th className="py-2.5 px-3">Account ID</th>
                    <th className="py-2.5 px-3">Ngày</th>
                    <th className="py-2.5 px-3">Kỳ</th>
                    <th className="py-2.5 px-3 text-right">Chi tiêu (USD)</th>
                    <th className="py-2.5 px-3 text-right">Lượt hiển thị</th>
                    <th className="py-2.5 px-3 text-right">Lượt click</th>
                    <th className="py-2.5 px-3 text-right">Purchases</th>
                    <th className="py-2.5 px-3">Ghi chú</th>
                  </tr>
                )}
                {activeTab === "Shopify_Items" && (
                  <tr>
                    <th className="py-2.5 px-3.5">Mã đơn</th>
                    <th className="py-2.5 px-3">Line Item ID</th>
                    <th className="py-2.5 px-3">Tên sản phẩm</th>
                    <th className="py-2.5 px-3">SKU</th>
                    <th className="py-2.5 px-3 text-right">Số lượng</th>
                    <th className="py-2.5 px-3 text-right">Line Total (EUR)</th>
                    <th className="py-2.5 px-3">Fulfillment</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-border/20 font-mono tabular-nums">
                {activeTab === "Orders" &&
                  rows.map((r, idx) => (
                    <tr
                      key={String(r.id || idx)}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-semibold text-foreground font-sans">
                        {String(r.orderId || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {String(r.shopifyId || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {String(r.orderDate || "-")}
                      </td>
                      <td className="py-2.5 px-3">{String(r.period || "-")}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className={`font-sans text-[10px] py-0 ${
                            r.financialStatus === "paid"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                          }`}
                        >
                          {String(r.financialStatus || "-")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-sans text-[11px]">
                        {String(r.fulfillmentStatus || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-medium text-foreground">
                        {formatCurrency(r.grossOrder, "€")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                        {formatCurrency(r.eligibleRevenueEur, "€")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-sky-400">
                        {formatCurrency(r.eligibleRevenueUsdCalc, "$")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px] truncate max-w-xs font-sans">
                        {String(r.sourceLine || "")}
                      </td>
                    </tr>
                  ))}

                {activeTab === "COGS" &&
                  rows.map((r, idx) => (
                    <tr
                      key={String(r.id || idx)}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-semibold text-foreground font-sans">
                        {String(r.pgprintOrderId || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {String(r.pgcOrderId || "-")}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground font-sans">
                        {String(r.customerOrderId || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {String(r.costDate || "-")}
                      </td>
                      <td className="py-2.5 px-3">{String(r.period || "-")}</td>
                      <td className="py-2.5 px-3">
                        <Badge
                          variant="outline"
                          className="font-sans text-[10px] py-0"
                        >
                          {String(r.sourceStatus || "pending")}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatCurrency(r.production, "$")}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatCurrency(r.shipping, "$")}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatCurrency(r.cogsSourceUsd, "$")}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-amber-400">
                        {formatCurrency(r.eligibleCogsUsd, "$")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-xs truncate font-sans">
                        {String(r.controlNote || "-")}
                      </td>
                    </tr>
                  ))}

                {activeTab === "Ads" &&
                  rows.map((r, idx) => (
                    <tr
                      key={String(r.id || idx)}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-semibold text-foreground font-sans">
                        {String(r.accountName || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {String(r.accountId || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {String(r.date || "-")}
                      </td>
                      <td className="py-2.5 px-3">{String(r.period || "-")}</td>
                      <td className="py-2.5 px-3 text-right font-semibold text-sky-400">
                        {formatCurrency(r.spendUsd, "$")}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatNumber(r.impressions)}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatNumber(r.clicks)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                        {formatNumber(r.purchases)}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px] max-w-xs truncate font-sans">
                        {String(r.controlNote || "-")}
                      </td>
                    </tr>
                  ))}

                {activeTab === "Shopify_Items" &&
                  rows.map((r, idx) => (
                    <tr
                      key={String(r.id || idx)}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="py-2.5 px-3.5 font-semibold text-foreground font-sans">
                        {String(r.orderId || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {String(r.lineItemId || "-")}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-foreground max-w-sm truncate font-sans">
                        {String(r.productName || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                        {String(r.sku || "-")}
                      </td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">
                        {formatNumber(r.quantity)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-semibold text-emerald-400">
                        {formatCurrency(r.lineTotal, "€")}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground font-sans text-[11px]">
                        {String(r.fulfillment || "unfulfilled")}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination Bar */}
        <div className="p-3 sm:px-4 border-t border-border/40 flex items-center justify-between text-xs text-muted-foreground bg-muted/10 font-sans">
          <span className="font-mono">
            {totalCount > 0 ? (
              <>
                <span className="text-foreground font-semibold">
                  {(page - 1) * limit + 1}-{Math.min(page * limit, totalCount)}
                </span>{" "}
                / {formatNumber(totalCount)} bản ghi
              </>
            ) : (
              "0 bản ghi"
            )}
          </span>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px]">
              Trang {page} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="size-7 border-border/60"
              disabled={page <= 1 || isTabLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeftIcon className="size-3.5" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7 border-border/60"
              disabled={page >= totalPages || isTabLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRightIcon className="size-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
