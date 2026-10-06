"use client";

import { CalendarIcon } from "lucide-react";
import * as React from "react";
import { SheetTable } from "@/components/dashboard/ec/raw-tables/sheet-table";
import {
  cogsColumns,
  monthLabel,
  orderColumns,
  payoutColumns,
  type RawRow,
} from "@/components/dashboard/ec/raw-tables/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatVietnamMonth } from "@/lib/date-time";

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

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
            <CalendarIcon className="size-3.5" /> Kỳ đối soát:
          </span>
          <Select
            value={selectedMonth}
            onValueChange={(val) => {
              if (val) setSelectedMonth(String(val));
            }}
          >
            <SelectTrigger
              aria-label="Select Shopify month"
              className="h-8 min-w-[130px] text-xs font-mono"
            >
              <SelectValue placeholder="Chọn kỳ" />
            </SelectTrigger>
            <SelectContent>
              {orders.months.map((month) => (
                <SelectItem
                  key={month}
                  value={month}
                  className="text-xs font-mono"
                >
                  {monthLabel(month)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
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
