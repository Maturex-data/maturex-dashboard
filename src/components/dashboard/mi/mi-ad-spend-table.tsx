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
import { vietnamMonthOptions } from "@/lib/date-time";

type MetaRow = {
  id: string;
  account_id: string;
  date_start: string;
  date_stop: string;
  currency: string | null;
  spend: string;
  purchase_count: string;
  purchase_value: string;
  purchase_roas: string;
  cost_per_purchase: string;
  impressions: string;
  clicks: string;
  cpc: string;
  cpm: string;
  ctr: string;
};

const headers = [
  "account_id",
  "date_start",
  "date_stop",
  "currency",
  "spend",
  "purchase_count",
  "purchase_value",
  "purchase_roas",
  "cost_per_purchase",
  "impressions",
  "clicks",
  "cpc",
  "cpm",
  "ctr",
] as const;

function formatNumber(value: string, fractionDigits = 2): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
}

function monthOptions(): string[] {
  return vietnamMonthOptions();
}

export function MiAdSpendTable() {
  const options = React.useMemo(monthOptions, []);
  const [month, setMonth] = React.useState(options[0] || "2026-01");
  const [rows, setRows] = React.useState<MetaRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [error, setError] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/meta/daily-financials?month=${month}`,
        {
          cache: "no-store",
        },
      );
      const payload = (await response.json()) as {
        rows?: MetaRow[];
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Unable to load Meta data.");
      }
      setRows(payload.rows || []);
    } catch (reason) {
      setRows([]);
      setError(
        reason instanceof Error ? reason.message : "Unable to load Meta data.",
      );
    } finally {
      setLoading(false);
    }
  }, [month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function sync() {
    setSyncing(true);
    setError("");
    try {
      const response = await fetch("/api/meta/daily-financials", {
        method: "POST",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "Meta sync failed.");
      }
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Meta sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <label className="flex items-center gap-2 text-muted-foreground text-sm">
          Month
          <select
            aria-label="Select Meta month"
            className="h-8 rounded-lg border border-input bg-background px-2 text-foreground"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          >
            {options.map((value) => (
              <option key={value} value={value}>
                Tháng {Number(value.slice(5))} năm {value.slice(0, 4)}
              </option>
            ))}
          </select>
        </label>
        <Button
          size="sm"
          variant="outline"
          onClick={() => void sync()}
          disabled={syncing}
        >
          <RefreshCwIcon className={syncing ? "animate-spin" : ""} />
          Sync Meta
        </Button>
      </div>
      {error ? (
        <p className="px-4 py-3 text-destructive text-xs">{error}</p>
      ) : null}
      <div className="max-h-[520px] overflow-auto">
        <Table className="min-w-max">
          <TableHeader className="sticky top-0 z-10 bg-muted/95">
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
            {!loading && !error && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length}>
                  No Meta financial records for this month.
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.account_id}</TableCell>
                    <TableCell>{row.date_start}</TableCell>
                    <TableCell>{row.date_stop}</TableCell>
                    <TableCell>{row.currency || ""}</TableCell>
                    <TableCell>{formatNumber(row.spend)}</TableCell>
                    <TableCell>{formatNumber(row.purchase_count)}</TableCell>
                    <TableCell>{formatNumber(row.purchase_value)}</TableCell>
                    <TableCell>{formatNumber(row.purchase_roas)}</TableCell>
                    <TableCell>{formatNumber(row.cost_per_purchase)}</TableCell>
                    <TableCell>{formatNumber(row.impressions, 0)}</TableCell>
                    <TableCell>{formatNumber(row.clicks, 0)}</TableCell>
                    <TableCell>{formatNumber(row.cpc)}</TableCell>
                    <TableCell>{formatNumber(row.cpm)}</TableCell>
                    <TableCell>{formatNumber(row.ctr)}</TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
