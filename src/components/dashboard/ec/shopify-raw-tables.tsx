"use client";

import { ArrowLeftIcon, ArrowRightIcon, Columns3Icon } from "lucide-react";
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
  ["order_name", "order_name"],
  ["order_date", "order_date"],
  ["financial_status", "financial_status"],
  ["fulfillment_status", "fulfillment_status"],
  ["fulfillment_date", "fulfillment_date"],
  ["delivery_status", "delivery_status"],
  ["delivery_date", "delivery_date"],
  ["gross_sales", "gross_sales"],
  ["discounts", "discounts"],
  ["shipping_charged", "shipping_charged"],
  ["sales_tax", "sales_tax"],
  ["order_total_before_refund", "order_total_before_refund"],
  ["calc_net_order_after_refund", "calc_net_order_after_refund"],
  ["refund_amount", "refund_amount"],
  ["refund_date", "refund_date"],
  ["items", "items"],
  ["tag", "tag"],
] as const satisfies readonly Column[];

const cogsColumns = [
  ["supplier", "supplier"],
  ["date", "date"],
  ["reference_order_id", "reference_order_id"],
  ["supplier_order_id", "supplier_order_id"],
  ["total cost", "total cost"],
  ["est.cost", "est.cost"],
] as const satisfies readonly Column[];

const payoutColumns = [
  ["balance_transaction_id", "balance_transaction_id"],
  ["payout_id", "payout_id"],
  ["payout_status", "payout_status"],
  ["transaction_type", "transaction_type"],
  ["transaction_status", "transaction_status"],
  ["currency", "currency"],
  ["gross_amount", "gross_amount"],
  ["fee_amount", "fee_amount"],
  ["net_amount", "net_amount"],
  ["source_id", "source_id"],
  ["source_type", "source_type"],
  ["source_order_id", "source_order_id"],
  ["source_order_name", "source_order_name"],
  ["source_order_transaction_id", "source_order_transaction_id"],
  ["processed_at_utc", "processed_at_utc"],
  ["processed_at_gmt7", "processed_at_gmt7"],
  ["processed_at_vietnam", "processed_at_vietnam"],
  ["adjustment_reason", "adjustment_reason"],
  ["source", "source"],
  ["snapshot_at", "snapshot_at"],
  ["pull_run_id", "pull_run_id"],
  ["raw_json", "raw_json"],
] as const satisfies readonly Column[];

const PAGE_SIZE = 50;

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)} năm ${year}`;
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
  const [visible, setVisible] = React.useState<Record<string, boolean>>(() =>
    Object.fromEntries(columns.map(([key]) => [key, true])),
  );
  const displayedColumns = columns.filter(([key]) => visible[key]);
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm">{name}</p>
          <p className="text-muted-foreground text-xs">{rows.length} rows</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
            <Columns3Icon />
            Columns
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuGroup>
              <DropdownMenuLabel>Show columns</DropdownMenuLabel>
              {columns.map(([key, label]) => (
                <DropdownMenuCheckboxItem
                  checked={visible[key]}
                  key={key}
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
      <div className="max-h-[520px] overflow-auto rounded-lg border">
        <Table className="min-w-max">
          <TableHeader className="sticky top-0 z-10 bg-muted/95">
            <TableRow>
              {displayedColumns.map(([key, label]) => (
                <TableHead className="whitespace-nowrap" key={key}>
                  {label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={Math.max(displayedColumns.length, 1)}>
                  Loading...
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(displayedColumns.length, 1)}>
                  No data.
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? pageRows.map((row) => (
                  <TableRow
                    key={`${name}-${String(row.id ?? row[columns[0][0]] ?? "row")}`}
                  >
                    {displayedColumns.map(([key]) => (
                      <TableCell
                        className="max-w-[360px] whitespace-nowrap"
                        key={key}
                      >
                        {row[key] ?? ""}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm">
        <span>
          Showing {rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1}-
          {Math.min(page * PAGE_SIZE, rows.length)} of {rows.length} rows
        </span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous page"
            disabled={page === 1 || loading}
            onClick={() => setPage((value) => Math.max(1, value - 1))}
            size="sm"
            title="Previous page"
            variant="outline"
          >
            <ArrowLeftIcon />
          </Button>
          <span className="min-w-20 text-center">
            Page {page} / {pageCount}
          </span>
          <Button
            aria-label="Next page"
            disabled={page === pageCount || loading}
            onClick={() => setPage((value) => Math.min(pageCount, value + 1))}
            size="sm"
            title="Next page"
            variant="outline"
          >
            <ArrowRightIcon />
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
      <div className="border-b px-4 pt-3">
        <TabsList variant="line">
          <TabsTrigger value="orders">RAW.ORDER</TabsTrigger>
          <TabsTrigger value="cogs">RAW.COGS</TabsTrigger>
          <TabsTrigger value="payout">RAW.PAYOUT_DETAIL</TabsTrigger>
        </TabsList>
      </div>
      <div className="flex items-center gap-2 px-4 pt-4 text-sm">
        <label className="flex items-center gap-2 text-muted-foreground">
          Month
          <select
            aria-label="Select Shopify month"
            className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
            onChange={(event) => setSelectedMonth(event.target.value)}
            value={selectedMonth}
          >
            {orders.months.map((month) => (
              <option key={month} value={month}>
                {monthLabel(month)}
              </option>
            ))}
          </select>
        </label>
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
