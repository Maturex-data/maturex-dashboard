"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  Columns3Icon,
  DatabaseIcon,
  FileClockIcon,
  FileSpreadsheetIcon,
  RefreshCwIcon,
  SearchIcon,
  ShoppingBagIcon,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface ShopOption {
  code: string;
  name: string;
}

type Column = readonly [string, string];

const orderColumns = [
  ["order_id", "Order ID"],
  ["shop_name", "Shop"],
  ["sale_date", "Sale Date"],
  ["full_name", "Buyer / Name"],
  ["number_of_items", "Items"],
  ["currency", "Curr"],
  ["order_value", "Order Value"],
  ["discount_amount", "Discount"],
  ["shipping", "Shipping"],
  ["sales_tax", "Sales Tax"],
  ["order_total", "Total"],
  ["card_processing_fees", "Fee (Card)"],
  ["order_net", "Order Net"],
  ["status", "Status"],
  ["date_shipped", "Shipped Date"],
  ["ship_country", "Country"],
  ["ship_city", "City"],
  ["sku", "SKU"],
] as const satisfies readonly Column[];

const itemColumns = [
  ["order_id", "Order ID"],
  ["shop_name", "Shop"],
  ["sale_date", "Sale Date"],
  ["item_name", "Item Name"],
  ["sku", "SKU"],
  ["variations", "Variations"],
  ["quantity", "Qty"],
  ["currency", "Curr"],
  ["price", "Price"],
  ["discount_amount", "Discount"],
  ["order_shipping", "Shipping"],
  ["order_sales_tax", "Sales Tax"],
  ["item_total", "Item Total"],
  ["transaction_id", "Transaction ID"],
  ["match_status", "Match"],
] as const satisfies readonly Column[];

const statementColumns = [
  ["statement_date", "Date"],
  ["shop_name", "Shop"],
  ["type", "Type"],
  ["title", "Title"],
  ["info", "Details / Info"],
  ["extracted_order_id", "Order Ref"],
  ["currency", "Curr"],
  ["amount", "Amount"],
  ["fees_and_taxes", "Fees & Taxes"],
  ["net", "Net"],
  ["tax_details", "Tax Details"],
] as const satisfies readonly Column[];

const MONEY_COLUMNS = new Set([
  "order_value",
  "discount_amount",
  "shipping",
  "sales_tax",
  "order_total",
  "card_processing_fees",
  "order_net",
  "price",
  "order_shipping",
  "order_sales_tax",
  "item_total",
  "amount",
  "fees_and_taxes",
  "net",
]);

type DataRow = Record<string, unknown>;

function formatCellValue(
  key: string,
  value: unknown,
  currency = "USD",
): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40 font-mono">—</span>;
  }

  const str = String(value);

  // Status badges
  if (key === "status" || key === "match_status") {
    const s = str.toLowerCase();
    const isSuccess =
      s.includes("paid") ||
      s.includes("completed") ||
      s.includes("matched") ||
      s.includes("shipped");
    const isPending =
      s.includes("pending") || s.includes("processing") || s.includes("open");
    const isDanger =
      s.includes("cancel") || s.includes("refund") || s.includes("unmatched");

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium ${
          isSuccess
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            : isPending
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              : isDanger
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                : "bg-muted text-muted-foreground border border-border/50"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${
            isSuccess
              ? "bg-emerald-500"
              : isPending
                ? "bg-amber-500"
                : isDanger
                  ? "bg-rose-500"
                  : "bg-muted-foreground"
          }`}
        />
        {str}
      </span>
    );
  }

  if (key === "type") {
    const s = str.toLowerCase();
    const isSale = s.includes("sale");
    const isFee =
      s.includes("fee") || s.includes("tax") || s.includes("shipping_label");
    const isDeposit = s.includes("deposit");
    const isRefund = s.includes("refund");

    return (
      <span
        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium ${
          isSale
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : isDeposit
              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
              : isRefund
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : isFee
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
        }`}
      >
        {str}
      </span>
    );
  }

  if (key === "shop_name") {
    return (
      <span className="inline-flex items-center font-semibold text-foreground text-xs">
        {str}
      </span>
    );
  }

  if (MONEY_COLUMNS.has(key)) {
    const num = Number(str.replaceAll(/[^0-9.-]/g, ""));
    if (!Number.isNaN(num)) {
      const isNegative =
        num < 0 || key === "card_processing_fees" || key === "discount_amount";
      const symbol = currency === "GBP" ? "£" : "$";
      return (
        <span
          className={`font-mono text-xs tabular-nums ${
            isNegative
              ? "text-rose-500 font-medium"
              : num > 0
                ? "text-foreground font-medium"
                : "text-muted-foreground"
          }`}
        >
          {num < 0 ? "-" : key === "card_processing_fees" ? "-" : ""}
          {symbol}
          {Math.abs(num).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      );
    }
  }

  if (
    key === "order_id" ||
    key === "transaction_id" ||
    key === "extracted_order_id"
  ) {
    return (
      <span className="font-mono text-xs font-semibold text-foreground">
        {str}
      </span>
    );
  }

  if (
    key === "sale_date" ||
    key === "statement_date" ||
    key === "date_shipped"
  ) {
    return (
      <span className="font-mono text-xs text-muted-foreground">{str}</span>
    );
  }

  return <span className="text-xs">{str}</span>;
}

export function FlowaDataTable({ shops }: { shops: ShopOption[] }) {
  const [activeTab, setActiveTab] = React.useState<
    "orders" | "items" | "statements"
  >("orders");
  const [selectedShop, setSelectedShop] = React.useState("all");
  const [selectedMonth, setSelectedMonth] = React.useState("all");
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

  // Handle search debounce
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        shop: selectedShop,
        month: selectedMonth,
        page: String(page),
        limit: String(pageSize),
      });
      if (debouncedSearch) params.set("search", debouncedSearch);

      const endpoint =
        activeTab === "orders"
          ? "/api/etsy/orders"
          : activeTab === "items"
            ? "/api/etsy/items"
            : "/api/etsy/statements";

      const res = await fetch(`${endpoint}?${params.toString()}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (res.ok) {
        setRows(data.rows || []);
        setTotal(data.total || 0);
        setTotalPages(data.totalPages || 1);
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
  }, [activeTab, selectedShop, selectedMonth, debouncedSearch, page, pageSize]);

  React.useEffect(() => {
    void loadData();
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

  const displayedColumns = currentColumns.filter(([k]) => currentVisibility[k]);

  return (
    <div className="space-y-4">
      {/* Top Filter Strip */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-card/60 p-3.5 rounded-xl border border-border/60 shadow-xs backdrop-blur-xs">
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Shop Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium">
              Shop:
            </span>
            <select
              aria-label="Lọc theo Shop"
              value={selectedShop}
              onChange={(e) => {
                setSelectedShop(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground font-medium focus:outline-hidden"
            >
              <option value="all">Tất cả Shop (All)</option>
              {shops.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Month Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground font-medium flex items-center gap-1">
              <CalendarIcon className="size-3.5" /> Kỳ:
            </span>
            <select
              aria-label="Lọc theo Tháng"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setPage(1);
              }}
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground font-mono focus:outline-hidden"
            >
              <option value="all">Tất cả tháng</option>
              <option value="2026-08">Tháng 8/2026</option>
              <option value="2026-07">Tháng 7/2026</option>
            </select>
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
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-background pl-8 pr-7 py-1 rounded-lg border border-border/60 text-xs placeholder:text-muted-foreground focus:outline-hidden focus:border-foreground/60 transition-colors h-8 shadow-2xs"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
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
            onClick={() => void loadData()}
            disabled={loading}
          >
            <RefreshCwIcon
              className={`size-3.5 ${loading ? "animate-spin" : ""}`}
            />
            Tải lại
          </Button>

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
                      setCurrentVisibility((curr) => ({
                        ...curr,
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
      </div>

      {/* Main Card with Tabs */}
      <Card className="border-border/60 shadow-xs overflow-hidden bg-card/60 backdrop-blur-xs">
        <Tabs
          value={activeTab}
          onValueChange={(val) => {
            if (val === "orders" || val === "items" || val === "statements") {
              setActiveTab(val);
            }
            setPage(1);
          }}
          className="w-full"
        >
          <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShoppingBagIcon className="size-4 text-purple-500" />
                  Bảng Dữ Liệu Đối Tác Etsy (Flowa Hub)
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  Báo cáo đơn hàng bán ra, sản phẩm chi tiết và sao kê dòng tiền
                  thực tế từ các Shop Etsy.
                </CardDescription>
              </div>

              <TabsList className="bg-muted/70 p-1 rounded-xl h-auto border border-border/50 flex w-full sm:w-auto">
                <TabsTrigger
                  value="orders"
                  className="gap-1.5 text-xs py-1.5 px-3 rounded-lg data-active:bg-background data-active:text-foreground transition-all shrink-0"
                >
                  <FileSpreadsheetIcon className="size-3.5 text-emerald-500" />
                  <span>1. Đơn Hàng (Orders)</span>
                </TabsTrigger>
                <TabsTrigger
                  value="items"
                  className="gap-1.5 text-xs py-1.5 px-3 rounded-lg data-active:bg-background data-active:text-foreground transition-all shrink-0"
                >
                  <DatabaseIcon className="size-3.5 text-sky-500" />
                  <span>2. Chi Tiết SP (Items)</span>
                </TabsTrigger>
                <TabsTrigger
                  value="statements"
                  className="gap-1.5 text-xs py-1.5 px-3 rounded-lg data-active:bg-background data-active:text-foreground transition-all shrink-0"
                >
                  <FileClockIcon className="size-3.5 text-purple-500" />
                  <span>3. Sao Kê & Phí (Statements)</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </CardHeader>

          <CardContent className="p-0">
            {/* Table Area */}
            <div className="max-h-[600px] overflow-auto">
              <Table className="min-w-max text-xs">
                <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-xs border-b border-border/60 shadow-xs">
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
                        className="h-36 text-center text-muted-foreground"
                      >
                        <div className="flex items-center justify-center gap-2">
                          <span className="size-2 rounded-full bg-purple-500 animate-ping" />
                          <span>Đang truy xuất dữ liệu từ Postgres...</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!loading && rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={Math.max(displayedColumns.length, 1)}
                        className="h-32 text-center text-muted-foreground"
                      >
                        Không có bản ghi phù hợp với bộ lọc hiện tại.
                      </TableCell>
                    </TableRow>
                  ) : null}

                  {!loading
                    ? rows.map((row) => (
                        <TableRow
                          key={row.id}
                          className="hover:bg-muted/40 transition-colors border-b border-border/40"
                        >
                          {displayedColumns.map(([key]) => {
                            const isMoney = MONEY_COLUMNS.has(key);
                            return (
                              <TableCell
                                className={`max-w-[340px] truncate py-2 px-3 ${
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

            {/* Pagination Footer */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/60 px-4 py-3 text-muted-foreground text-xs bg-muted/10">
              <span className="font-mono">
                Tổng cộng:{" "}
                <strong className="text-foreground">
                  {total.toLocaleString()}
                </strong>{" "}
                bản ghi
                {total > 0 ? (
                  <span>
                    {" "}
                    (Hiển thị {(page - 1) * pageSize + 1} -{" "}
                    {Math.min(page * pageSize, total)})
                  </span>
                ) : null}
              </span>

              <div className="flex items-center gap-2">
                <Button
                  aria-label="Previous page"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  size="sm"
                  className="h-7 px-2"
                  variant="outline"
                >
                  <ArrowLeftIcon className="size-3.5" />
                </Button>
                <span className="min-w-16 text-center font-mono text-xs">
                  Trang {page} / {Math.max(1, totalPages)}
                </span>
                <Button
                  aria-label="Next page"
                  disabled={page >= totalPages || loading}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  size="sm"
                  className="h-7 px-2"
                  variant="outline"
                >
                  <ArrowRightIcon className="size-3.5" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Tabs>
      </Card>
    </div>
  );
}
