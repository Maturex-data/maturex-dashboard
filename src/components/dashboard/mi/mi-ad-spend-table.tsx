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

const headers: Array<{
  key: keyof MetaRow;
  label: string;
  align?: "right" | "left";
}> = [
  { key: "account_id", label: "Account ID", align: "left" },
  { key: "date_start", label: "Date Start", align: "left" },
  { key: "date_stop", label: "Date Stop", align: "left" },
  { key: "currency", label: "Curr", align: "left" },
  { key: "spend", label: "Spend", align: "right" },
  { key: "purchase_count", label: "Purchases", align: "right" },
  { key: "purchase_value", label: "Purch Value", align: "right" },
  { key: "purchase_roas", label: "ROAS", align: "right" },
  { key: "cost_per_purchase", label: "CPP", align: "right" },
  { key: "impressions", label: "Impressions", align: "right" },
  { key: "clicks", label: "Clicks", align: "right" },
  { key: "cpc", label: "CPC", align: "right" },
  { key: "cpm", label: "CPM", align: "right" },
  { key: "ctr", label: "CTR", align: "right" },
];

function formatNumber(value: string, fractionDigits = 2): string {
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return num.toLocaleString("en-US", {
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

  const totalSpend = rows.reduce((acc, r) => acc + (Number(r.spend) || 0), 0);
  const totalValue = rows.reduce(
    (acc, r) => acc + (Number(r.purchase_value) || 0),
    0,
  );
  const avgRoas = totalSpend > 0 ? (totalValue / totalSpend).toFixed(2) : "0";

  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <CalendarIcon className="size-3.5" /> Tháng:
            </span>
            <select
              aria-label="Select Meta month"
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground font-mono focus:outline-hidden"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            >
              {options.map((value) => (
                <option key={value} value={value}>
                  Tháng {Number(value.slice(5))}/{value.slice(0, 4)}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-3 border-l border-border/60 pl-3 text-xs font-mono">
            <span className="text-muted-foreground">
              Total Spend:{" "}
              <strong className="text-rose-500 font-semibold">
                ${formatNumber(String(totalSpend))}
              </strong>
            </span>
            <span className="text-muted-foreground">
              Avg ROAS:{" "}
              <strong className="text-emerald-500 font-semibold">
                {avgRoas}x
              </strong>
            </span>
          </div>
        </div>

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
          Sync Meta Daily
        </Button>
      </div>

      {error ? <p className="px-1 text-destructive text-xs">{error}</p> : null}

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
                    <span className="size-2 rounded-full bg-sky-500 animate-ping" />
                    <span>Đang tải số liệu Meta Ads...</span>
                  </div>
                </TableCell>
              </TableRow>
            ) : null}
            {!loading && !error && rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={headers.length}
                  className="h-28 text-center text-muted-foreground"
                >
                  Không có dữ liệu chi phí Meta cho tháng này.
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? rows.map((row) => {
                  const roas = Number(row.purchase_roas) || 0;
                  return (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/40 transition-colors border-b border-border/40 font-mono"
                    >
                      <TableCell className="font-semibold text-foreground">
                        {row.account_id}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.date_start}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.date_stop}
                      </TableCell>
                      <TableCell className="text-muted-foreground uppercase">
                        {row.currency || "USD"}
                      </TableCell>
                      <TableCell className="text-right text-rose-500 font-medium">
                        ${formatNumber(row.spend)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.purchase_count, 0)}
                      </TableCell>
                      <TableCell className="text-right text-emerald-600 dark:text-emerald-400 font-medium">
                        ${formatNumber(row.purchase_value)}
                      </TableCell>
                      <TableCell className="text-right">
                        <span
                          className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            roas >= 2
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : roas >= 1
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {formatNumber(row.purchase_roas)}x
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        ${formatNumber(row.cost_per_purchase)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(row.impressions, 0)}
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatNumber(row.clicks, 0)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${formatNumber(row.cpc)}
                      </TableCell>
                      <TableCell className="text-right">
                        ${formatNumber(row.cpm)}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatNumber(row.ctr)}%
                      </TableCell>
                    </TableRow>
                  );
                })
              : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
