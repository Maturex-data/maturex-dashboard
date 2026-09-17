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
import { formatVietnamMonth } from "@/lib/date-time";

type CogsRow = {
  supplier: string;
  date: string;
  reference_order_id: string | null;
  supplier_order_id: string | null;
  "total cost": string;
  "est.cost": string;
};

const headers: Array<keyof CogsRow> = [
  "supplier",
  "date",
  "reference_order_id",
  "supplier_order_id",
  "total cost",
  "est.cost",
];

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
        `Added ${payload.added || 0}, skipped ${payload.skipped || 0}`,
    );
    await load();
    setSyncing(false);
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <label className="flex items-center gap-2 text-muted-foreground text-sm">
          Month
          <select
            aria-label="Select COGS month"
            className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            {Array.from({ length: 12 }, (_, index) => {
              const value = `2026-${String(index + 1).padStart(2, "0")}`;
              return (
                <option key={value} value={value}>
                  Tháng {index + 1} năm 2026
                </option>
              );
            })}
          </select>
        </label>
        <span className="text-muted-foreground text-xs">{message}</span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void sync()}
          disabled={syncing}
        >
          <RefreshCwIcon className={syncing ? "animate-spin" : ""} />
          Sync COGS
        </Button>
      </div>
      <div className="max-h-[520px] overflow-auto">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-muted/80">
            <TableRow>
              {headers.map((header) => (
                <TableHead key={header}>{header}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={headers.length}>Loading...</TableCell>
              </TableRow>
            ) : null}
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length}>No COGS records.</TableCell>
              </TableRow>
            ) : null}
            {rows.map((row, index) => (
              <TableRow
                key={`${row.supplier}-${row.supplier_order_id}-${index}`}
              >
                {headers.map((header) => (
                  <TableCell key={header} className="whitespace-nowrap">
                    {row[header] || ""}
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
