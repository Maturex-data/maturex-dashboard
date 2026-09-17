"use client";

import { CalendarIcon, RefreshCwIcon } from "lucide-react";
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
import { formatVietnamMonth } from "@/lib/date-time";

type CogsRow = {
  supplier: string;
  date: string;
  reference_order_id: string | null;
  supplier_order_id: string | null;
  "total cost": string;
  "est.cost": string;
};

const headers: Array<{
  key: keyof CogsRow;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "supplier", label: "Supplier", align: "left" },
  { key: "date", label: "Date", align: "left" },
  { key: "reference_order_id", label: "Ref Order ID", align: "left" },
  { key: "supplier_order_id", label: "Supplier Order ID", align: "left" },
  { key: "total cost", label: "Total Cost", align: "right" },
  { key: "est.cost", label: "Est. Cost", align: "right" },
];

function formatCost(val: string): string {
  const num = Number(val.replaceAll(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return val;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PoProductCostTable() {
  const [rows, setRows] = React.useState<CogsRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [month, setMonth] = React.useState(() =>
    formatVietnamMonth(new Date()),
  );

  const load = React.useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/cogs?month=${month}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as { rows?: CogsRow[] };
    setRows(payload.rows || []);
    setLoading(false);
  }, [month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setMessage("");
    const response = await fetch("/api/cogs", { method: "POST" });
    const payload = (await response.json()) as {
      added?: number;
      skipped?: number;
      error?: string;
    };
    setMessage(
      payload.error ||
        `Đã đồng bộ ${payload.added || 0} mới, bỏ qua ${payload.skipped || 0}`,
    );
    await load();
    setSyncing(false);
  }

  const totalCogs = rows.reduce(
    (acc, r) =>
      acc + (Number(r["total cost"]?.replaceAll(/[^0-9.-]/g, "")) || 0),
    0,
  );

  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <CalendarIcon className="size-3.5" /> Tháng:
            </span>
            <select
              aria-label="Select COGS month"
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground font-mono focus:outline-hidden"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {Array.from({ length: 12 }, (_, index) => {
                const value = `2026-${String(index + 1).padStart(2, "0")}`;
                return (
                  <option key={value} value={value}>
                    Tháng {index + 1}/2026
                  </option>
                );
              })}
            </select>
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
            <span className="text-muted-foreground">({rows.length} đơn)</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {message ? (
            <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded">
              {message}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs gap-1.5"
            onClick={() => void sync()}
            disabled={syncing}
          >
            <RefreshCwIcon
              className={`size-3.5 ${syncing ? "animate-spin" : ""}`}
            />
            Sync COGS
          </Button>
        </div>
      </div>

      <div className="max-h-[500px] overflow-auto rounded-xl border border-border/60 bg-background/50">
        <Table className="min-w-max text-xs">
          <TableHeader className="sticky top-0 z-10 bg-muted/90 backdrop-blur-xs border-b border-border/60">
            <TableRow className="hover:bg-transparent">
              {headers.map((h) => (
                <TableHead
                  key={h.key}
                  className={`py-2.5 px-3 font-semibold text-muted-foreground ${
                    h.align === "right" ? "text-right" : "text-left"
                  }`}
                >
                  {h.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="h-32 text-center text-muted-foreground"
                >
                  <div className="flex items-center justify-center gap-2">
                    <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                    <span>Đang tải chi phí Fulfillment...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="h-28 text-center text-muted-foreground"
                >
                  Không có bản ghi COGS nào trong tháng này.
                </TableCell>
              </TableRow>
            ) : null}
            {rows.map((row, index) => (
              <TableRow
                key={`${row.supplier}-${row.supplier_order_id}-${index}`}
                className="hover:bg-muted/40 transition-colors border-b border-border/40 font-mono"
              >
                <TableCell>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-foreground text-[11px] font-medium border border-border/50">
                    {row.supplier}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.date}
                </TableCell>
                <TableCell className="text-foreground">
                  {row.reference_order_id || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.supplier_order_id || "—"}
                </TableCell>
                <TableCell className="text-right text-foreground font-medium">
                  {formatCost(row["total cost"])}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCost(row["est.cost"])}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
