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

type AirwallexRow = {
  id: string;
  transaction_date: string;
  transaction_type: string;
  card: string | null;
  card_nick_name: string | null;
  account_number: string | null;
  nick_name: string | null;
  where_paid: string | null;
  credit: string;
  debit: string;
  currency: string | null;
  ledger_status: string;
  transaction_details: string | null;
};

const headers = [
  "transaction_date",
  "transaction_type",
  "card",
  "card_nick_name",
  "account_number",
  "nick_name",
  "where_paid",
  "credit",
  "debit",
  "currency",
  "ledger_status",
  "transaction_details",
] as const;

function monthOptions(): string[] {
  return vietnamMonthOptions();
}

function amount(value: string): string {
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function AirwallexAccountActivityTable() {
  const options = React.useMemo(monthOptions, []);
  const [month, setMonth] = React.useState(options[0] || "2026-01");
  const [rows, setRows] = React.useState<AirwallexRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState("");

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/airwallex/account-activity?month=${month}`,
        { cache: "no-store" },
      );
      const payload = (await response.json()) as {
        rows?: AirwallexRow[];
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Unable to load Airwallex data.");
      setRows(payload.rows || []);
      setMessage("");
    } catch (reason) {
      setRows([]);
      setMessage(
        reason instanceof Error
          ? reason.message
          : "Unable to load Airwallex data.",
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
    setMessage("");
    try {
      const response = await fetch("/api/airwallex/account-activity", {
        method: "POST",
      });
      const payload = (await response.json()) as {
        fetched?: number;
        from?: string;
        until?: string;
        error?: string;
      };
      if (!response.ok)
        throw new Error(payload.error || "Airwallex sync failed.");
      setMessage(
        `Synced ${payload.fetched || 0} records (${payload.from?.slice(0, 10)} - ${payload.until?.slice(0, 10)})`,
      );
      await load();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Airwallex sync failed.",
      );
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
            aria-label="Select Airwallex month"
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
        <div className="flex items-center gap-3">
          <span className="text-muted-foreground text-xs">{message}</span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void sync()}
            disabled={syncing}
          >
            <RefreshCwIcon className={syncing ? "animate-spin" : ""} />
            Sync Airwallex
          </Button>
        </div>
      </div>
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
            {!loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={headers.length}>
                  No Airwallex records for this month.
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell>{row.transaction_date.slice(0, 10)}</TableCell>
                    <TableCell>{row.transaction_type}</TableCell>
                    <TableCell>{row.card || ""}</TableCell>
                    <TableCell>{row.card_nick_name || ""}</TableCell>
                    <TableCell>{row.account_number || ""}</TableCell>
                    <TableCell>{row.nick_name || ""}</TableCell>
                    <TableCell>{row.where_paid || ""}</TableCell>
                    <TableCell>{amount(row.credit)}</TableCell>
                    <TableCell>{amount(row.debit)}</TableCell>
                    <TableCell>{row.currency || ""}</TableCell>
                    <TableCell>{row.ledger_status}</TableCell>
                    <TableCell className="max-w-[420px] whitespace-pre-wrap">
                      {row.transaction_details || ""}
                    </TableCell>
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
