"use client";

import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarIcon,
  Columns3Icon,
  SearchIcon,
} from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatVietnamMonth } from "@/lib/date-time";

type RawValue = string | number | null;
type RawRow = Record<string, RawValue>;
type Column = readonly [string, string];

const orderColumns = [
  ["order_name", "Order Name"],
  ["order_date", "Order Date"],
  ["financial_status", "Financial"],
  ["fulfillment_status", "Fulfillment"],
  ["fulfillment_date", "Fulfillment Date"],
  ["delivery_status", "Delivery"],
  ["delivery_date", "Delivery Date"],
  ["gross_sales", "Gross Sales"],
  ["discounts", "Discounts"],
  ["shipping_charged", "Shipping"],
  ["sales_tax", "Tax"],
  ["order_total_before_refund", "Total Pre-Refund"],
  ["calc_net_order_after_refund", "Net Post-Refund"],
  ["refund_amount", "Refund"],
  ["refund_date", "Refund Date"],
  ["items", "Items"],
  ["tag", "Tags"],
] as const satisfies readonly Column[];

const cogsColumns = [
  ["supplier", "Supplier"],
  ["date", "Date"],
  ["reference_order_id", "Ref Order ID"],
  ["supplier_order_id", "Supplier Order ID"],
  ["total cost", "Total Cost"],
  ["est.cost", "Est. Cost"],
] as const satisfies readonly Column[];

const payoutColumns = [
  ["balance_transaction_id", "Balance Tx ID"],
  ["payout_id", "Payout ID"],
  ["payout_status", "Payout Status"],
  ["transaction_type", "Type"],
  ["transaction_status", "Status"],
  ["currency", "Currency"],
  ["gross_amount", "Gross Amount"],
  ["fee_amount", "Fee"],
  ["net_amount", "Net Amount"],
  ["source_order_name", "Order Name"],
  ["processed_at_vietnam", "Processed Date (VN)"],
  ["adjustment_reason", "Reason"],
] as const satisfies readonly Column[];

const PAGE_SIZE = 40;

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)}/${year}`;
}

const MONEY_COLUMNS = new Set([
  "gross_sales",
  "discounts",
  "shipping_charged",
  "sales_tax",
  "order_total_before_refund",
  "calc_net_order_after_refund",
  "refund_amount",
  "total cost",
  "est.cost",
  "gross_amount",
  "fee_amount",
  "net_amount",
]);

function formatCellValue(key: string, value: RawValue): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40 font-mono">—</span>;
  }

  const str = String(value);

  // Status badges
  if (
    key === "financial_status" ||
    key === "payout_status" ||
    key === "transaction_status"
  ) {
    const s = str.toLowerCase();
    const isSuccess =
      s.includes("paid") || s.includes("success") || s.includes("settled");
    const isPending = s.includes("pending") || s.includes("in_transit");
    const isDanger =
      s.includes("refund") || s.includes("fail") || s.includes("void");

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

  if (key === "fulfillment_status" || key === "delivery_status") {
    const s = str.toLowerCase();
    const isFulfilled = s.includes("fulfilled") || s.includes("delivered");
    return (
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono ${
          isFulfilled
            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium"
            : "text-muted-foreground"
        }`}
      >
        {str}
      </span>
    );
  }

  // Money values
  if (MONEY_COLUMNS.has(key)) {
    const num = Number(str.replaceAll(/[^0-9.-]/g, ""));
    if (!Number.isNaN(num)) {
      const isNegative =
        num < 0 || key === "refund_amount" || key === "discounts";
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
          {num < 0 ? "-" : key === "refund_amount" ? "-" : ""}$
          {Math.abs(num).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      );
    }
  }

  // IDs or Codes
  if (
    key.includes("id") ||
    key === "order_name" ||
    key.includes("date") ||
    key === "currency"
  ) {
    return <span className="font-mono text-xs text-foreground/80">{str}</span>;
  }

  return <span className="text-xs">{str}</span>;
}

function normalizeText(text: unknown): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function SheetTable({
  name,
  rows,
  columns,
  loading,
}: {
  name: string;
  rows: RawRow[];
  columns: readonly Column[];
  loading: boolean;
}) {
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
      // Build a search haystack string from all column values in the row
      const haystack = columns
        .map(([key]) => normalizeText(row[key]))
        .join(" ");

      // Every word typed must appear somewhere in the row's values (AND matching)
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
            <SearchIcon className="absolute left-2.5 top-2.5 size-3.5 text-muted-foreground" />
            <input
              type="text"
              placeholder={`Tìm theo Order Name, Date, Status, Total...`}
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full bg-background pl-8 pr-7 py-1 rounded-lg border border-border/60 text-xs placeholder:text-muted-foreground focus:outline-hidden focus:border-foreground/60 transition-colors h-8 shadow-2xs font-sans"
            />
            {searchTerm ? (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm("");
                  setPage(1);
                }}
                className="absolute right-2 top-2 text-muted-foreground hover:text-foreground text-xs size-4 flex items-center justify-center rounded-full hover:bg-muted"
                title="Xóa tìm kiếm"
              >
                ✕
              </button>
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

type OrdersResponse = {
  month: string | null;
  months: string[];
  rows: RawRow[];
};

export function ShopifyRawTables() {
  const [orders, setOrders] = React.useState<OrdersResponse>({
    month: null,
    months: [],
    rows: [],
  });
  const currentMonth = formatVietnamMonth(new Date());
  const [selectedMonth, setSelectedMonth] = React.useState(currentMonth);
  const [cogs, setCogs] = React.useState<RawRow[]>([]);
  const [payouts, setPayouts] = React.useState<RawRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const load = React.useCallback(async () => {
    setLoading(true);
    setErrors({});
    const monthQuery = `?month=${selectedMonth}`;
    const requestInit: RequestInit = {
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    };
    const orderPromise = fetch(`/api/shopify/orders${monthQuery}`, requestInit)
      .then((response) => response.json() as Promise<OrdersResponse>)
      .then((payload) => {
        setOrders(payload);
      })
      .catch(() =>
        setErrors((current) => ({
          ...current,
          orders: "Unable to load RAW.ORDER.",
        })),
      )
      .finally(() => setLoading(false));
    const cogsPromise = fetch(`/api/cogs?month=${selectedMonth}`, requestInit)
      .then((response) => response.json() as Promise<{ rows?: RawRow[] }>)
      .then((payload) => setCogs(payload.rows || []))
      .catch(() =>
        setErrors((current) => ({
          ...current,
          cogs: "Unable to load RAW.COGS.",
        })),
      );
    const payoutPromise = fetch(
      `/api/shopify/payments?month=${selectedMonth}`,
      requestInit,
    )
      .then((response) => response.json() as Promise<{ rows?: RawRow[] }>)
      .then((payload) =>
        setPayouts(
          (payload.rows || [])
            .filter((row) => row.recordType === "BALANCE_TRANSACTION")
            .map((row) => ({
              balance_transaction_id: row.payloadId,
              payout_id: row.payoutId,
              payout_status: row.payoutStatus,
              transaction_type: row.sourceType,
              transaction_status: row.transactionStatus,
              currency: row.currency,
              gross_amount: row.grossAmount,
              fee_amount: row.feeAmount,
              net_amount: row.netAmount,
              source_id: row.sourceId,
              source_type: row.sourceType,
              source_order_id: row.sourceOrderId,
              source_order_name: row.sourceOrderName,
              source_order_transaction_id: row.sourceOrderTransactionId,
              processed_at_utc: row.processedAt,
              processed_at_gmt7: row.processedAt,
              processed_at_vietnam: row.processedAt,
              adjustment_reason: row.reason,
              source: "shopify_payments_balance_transactions",
              snapshot_at: row.snapshotAt,
              pull_run_id: row.externalId,
              raw_json: null,
            })),
        ),
      )
      .catch(() =>
        setErrors((current) => ({
          ...current,
          payout: "Unable to load RAW.PAYOUT_DETAIL.",
        })),
      );
    await Promise.allSettled([orderPromise, cogsPromise, payoutPromise]);
    setLoading(false);
  }, [selectedMonth]);

  React.useEffect(() => {
    void load();
  }, [load]);
  React.useEffect(() => {
    const refresh = () => void load();
    window.addEventListener("shopify-orders-sync", refresh);
    return () => window.removeEventListener("shopify-orders-sync", refresh);
  }, [load]);

  return (
    <Tabs defaultValue="orders" className="w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/60 px-4 py-2.5 gap-3 bg-muted/10">
        <TabsList variant="line" className="gap-2">
          <TabsTrigger value="orders" className="text-xs">
            RAW.ORDER ({orders.rows.length})
          </TabsTrigger>
          <TabsTrigger value="cogs" className="text-xs">
            RAW.COGS ({cogs.length})
          </TabsTrigger>
          <TabsTrigger value="payout" className="text-xs">
            RAW.PAYOUT_DETAIL ({payouts.length})
          </TabsTrigger>
        </TabsList>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
            <CalendarIcon className="size-3.5" /> Kỳ đối soát:
          </span>
          <select
            aria-label="Select Shopify month"
            className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground font-mono focus:outline-hidden"
            onChange={(event) => setSelectedMonth(event.target.value)}
            value={selectedMonth}
          >
            {orders.months.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <TabsContent value="orders" className="mt-0">
        <SheetTable
          key={`${selectedMonth}-${orders.rows.length}`}
          name="RAW.ORDER"
          rows={orders.rows}
          columns={orderColumns}
          loading={loading}
        />
        {errors.orders ? (
          <p className="px-4 pb-4 text-destructive text-xs">{errors.orders}</p>
        ) : null}
      </TabsContent>
      <TabsContent value="cogs" className="mt-0">
        <SheetTable
          name="RAW.COGS"
          rows={cogs}
          columns={cogsColumns}
          loading={loading}
        />
        {errors.cogs ? (
          <p className="px-4 pb-4 text-destructive text-xs">{errors.cogs}</p>
        ) : null}
      </TabsContent>
      <TabsContent value="payout" className="mt-0">
        <SheetTable
          name="RAW.PAYOUT_DETAIL"
          rows={payouts}
          columns={payoutColumns}
          loading={loading}
        />
        {errors.payout ? (
          <p className="px-4 pb-4 text-destructive text-xs">{errors.payout}</p>
        ) : null}
      </TabsContent>
    </Tabs>
  );
}
