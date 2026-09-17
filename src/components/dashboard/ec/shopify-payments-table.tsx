"use client";

import { RefreshCwIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type PaymentRow = {
  id: string;
  recordType: string;
  transactionDate: string | null;
  currency: string | null;
  grossAmount: string | null;
  feeAmount: string | null;
  netAmount: string | null;
  payoutId: string | null;
  payoutStatus: string | null;
  sourceType: string | null;
  sourceOrderName: string | null;
  reason: string | null;
};

const columns: Array<{ key: keyof PaymentRow; label: string }> = [
  { key: "recordType", label: "record_type" },
  { key: "transactionDate", label: "transaction_date" },
  { key: "sourceType", label: "source_type" },
  { key: "sourceOrderName", label: "order" },
  { key: "grossAmount", label: "gross_amount" },
  { key: "feeAmount", label: "fee_amount" },
  { key: "netAmount", label: "net_amount" },
  { key: "currency", label: "currency" },
  { key: "payoutStatus", label: "payout_status" },
  { key: "payoutId", label: "payout_id" },
  { key: "reason", label: "reason" },
];

export function ShopifyPaymentsTable() {
  const [rows, setRows] = React.useState<PaymentRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    const response = await fetch("/api/shopify/payments", {
      cache: "no-store",
    });
    const payload = (await response.json()) as { rows?: PaymentRow[] };
    setRows(payload.rows || []);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setMessage("");
    const response = await fetch("/api/shopify/payments", { method: "POST" });
    const payload = (await response.json()) as {
      added?: number;
      skipped?: number;
      error?: string;
    };
    setMessage(
      payload.error ||
        `Last 1 month: added ${payload.added || 0}, skipped ${payload.skipped || 0}`,
    );
    await load();
    setSyncing(false);
  }

  return (
    <div className="w-full">
      <div className="flex items-center justify-end border-b px-4 py-3">
        <span className="mr-2 text-muted-foreground text-xs">{message}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void sync()}
          disabled={syncing}
        >
          <RefreshCwIcon className={syncing ? "animate-spin" : ""} />
          Sync last month
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => void load()}
          disabled={loading || syncing}
        >
          <RefreshCwIcon className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>
      <div className="max-h-[560px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/90">
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length}>Loading...</TableCell>
              </TableRow>
            ) : null}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length}>
                  No Shopify Payments records.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell key={column.key} className="whitespace-nowrap">
                    {row[column.key] || ""}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
