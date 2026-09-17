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

const headers: Array<{
  key: keyof AirwallexRow;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "transaction_date", label: "Date", align: "left" },
  { key: "transaction_type", label: "Type", align: "left" },
  { key: "card", label: "Card / Account", align: "left" },
  { key: "where_paid", label: "Merchant / Destination", align: "left" },
  { key: "credit", label: "Credit (+)", align: "right" },
  { key: "debit", label: "Debit (-)", align: "right" },
  { key: "currency", label: "Curr", align: "left" },
  { key: "ledger_status", label: "Ledger Status", align: "left" },
  { key: "transaction_details", label: "Details", align: "left" },
];

function monthOptions(): string[] {
  return vietnamMonthOptions();
}

function amount(value: string): string {
  const num = Number(value);
  if (Number.isNaN(num) || num === 0) return "—";
  return num.toLocaleString("en-US", {
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
      setMessage(`Đã nạp ${payload.fetched || 0} giao dịch`);
      await load();
    } catch (reason) {
      setMessage(
        reason instanceof Error ? reason.message : "Airwallex sync failed.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const totalCredit = rows.reduce((acc, r) => acc + (Number(r.credit) || 0), 0);
  const totalDebit = rows.reduce((acc, r) => acc + (Number(r.debit) || 0), 0);

  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <CalendarIcon className="size-3.5" /> Tháng:
            </span>
            <select
              aria-label="Select Airwallex month"
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
              Credit:{" "}
              <strong className="text-emerald-500 font-semibold">
                +$
                {totalCredit.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>
            <span className="text-muted-foreground">
              Debit:{" "}
              <strong className="text-rose-500 font-semibold">
                -$
                {totalDebit.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>
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
            Sync Airwallex
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
                    <span className="size-2 rounded-full bg-violet-500 animate-ping" />
                    <span>Đang tải lịch sử giao dịch Airwallex...</span>
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
                  Không có bản ghi Airwallex nào cho tháng này.
                </TableCell>
              </TableRow>
            ) : null}
            {!loading
              ? rows.map((row) => {
                  const creditVal = Number(row.credit) || 0;
                  const debitVal = Number(row.debit) || 0;
                  const isSettled = row.ledger_status
                    ?.toLowerCase()
                    .includes("settled");

                  return (
                    <TableRow
                      key={row.id}
                      className="hover:bg-muted/40 transition-colors border-b border-border/40 font-mono"
                    >
                      <TableCell className="text-muted-foreground">
                        {row.transaction_date?.slice(0, 10)}
                      </TableCell>
                      <TableCell className="font-sans font-medium text-foreground">
                        {row.transaction_type}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.card || row.account_number || "—"}
                        {row.card_nick_name ? ` (${row.card_nick_name})` : ""}
                      </TableCell>
                      <TableCell className="text-foreground max-w-[200px] truncate font-sans">
                        {row.where_paid || "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {creditVal > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400">
                            +${amount(row.credit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {debitVal > 0 ? (
                          <span className="text-rose-500">
                            -${amount(row.debit)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/40">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground uppercase">
                        {row.currency || "USD"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium ${
                            isSettled
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                              : "bg-muted text-muted-foreground border border-border/50"
                          }`}
                        >
                          <span
                            className={`size-1.5 rounded-full ${
                              isSettled
                                ? "bg-emerald-500"
                                : "bg-muted-foreground"
                            }`}
                          />
                          {row.ledger_status}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[300px] truncate text-muted-foreground text-xs font-sans">
                        {row.transaction_details || "—"}
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
