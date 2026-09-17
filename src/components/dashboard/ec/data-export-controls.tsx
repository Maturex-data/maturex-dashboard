"use client";

import { DownloadIcon } from "lucide-react";
import * as React from "react";
import * as XLSX from "xlsx";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { vietnamMonthOptions } from "@/lib/date-time";

type TableRow = Record<string, unknown>;
type ExportTable = {
  label: string;
  sheet: string;
  rows: TableRow[];
};

const tableOptions = [
  ["orders", "RAW.ORDER"],
  ["cogs", "RAW.COGS"],
  ["payouts", "RAW.PAYOUT_DETAIL"],
  ["meta", "META_ADS"],
  ["airwallex", "AIRWALLEX"],
  ["all", "All tables"],
] as const;

function monthOptions(): string[] {
  return ["all", ...vietnamMonthOptions()];
}

function csvValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function toCsv(rows: TableRow[]): string {
  const columns = [...new Set(rows.flatMap((row) => Object.keys(row)))];
  return [
    columns,
    ...rows.map((row) => columns.map((column) => csvValue(row[column]))),
  ]
    .map((row) =>
      row
        .map((value) => `"${csvValue(value).replaceAll('"', '""')}"`)
        .join(","),
    )
    .join("\n");
}

function downloadCsv(table: ExportTable, month: string): void {
  const blob = new Blob([`\uFEFF${toCsv(table.rows)}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${table.sheet.toLowerCase().replaceAll(".", "-")}-${month}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function downloadXlsx(tables: ExportTable[], month: string): void {
  const workbook = XLSX.utils.book_new();
  for (const table of tables) {
    const sheet = XLSX.utils.json_to_sheet(table.rows);
    XLSX.utils.book_append_sheet(workbook, sheet, table.sheet.slice(0, 31));
  }
  XLSX.writeFile(workbook, `maturex-data-${month}.xlsx`);
}

async function loadJson<T extends TableRow>(url: string): Promise<T[]> {
  const response = await fetch(url, { cache: "no-store" });
  const body = await response.text();
  let payload: { rows?: T[]; error?: string } = {};
  if (body) {
    try {
      payload = JSON.parse(body) as { rows?: T[]; error?: string };
    } catch {
      throw new Error(`Invalid response from ${url} (${response.status}).`);
    }
  }
  if (!response.ok) throw new Error(payload.error || `Unable to load ${url}`);
  if (!body) throw new Error(`Empty response from ${url}.`);
  return payload.rows || [];
}

function payoutRows(rows: TableRow[]): TableRow[] {
  return rows
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
      processed_at_utc: row.processedAtUtc,
      processed_at_gmt7: row.processedAtGmt7,
      processed_at_vietnam: row.processedAtVietnam,
      adjustment_reason: row.reason,
      source: row.source,
      snapshot_at: row.snapshotAt,
      pull_run_id: row.externalId,
      raw_json: row.payload ? JSON.stringify(row.payload) : null,
    }));
}

function orderRows(rows: TableRow[]): TableRow[] {
  return rows.map((row) => ({
    order_name: row.order_name,
    order_date: row.order_date,
    financial_status: row.financial_status,
    fulfillment_status: row.fulfillment_status,
    fulfillment_date: row.fulfillment_date,
    delivery_status: row.delivery_status,
    delivery_date: row.delivery_date,
    gross_sales: row.gross_sales,
    discounts: row.discounts,
    shipping_charged: row.shipping_charged,
    sales_tax: row.sales_tax,
    order_total_before_refund: row.order_total_before_refund,
    calc_net_order_after_refund: row.calc_order_net_after_refund,
    refund_amount: row.refund_amount,
    refund_date: row.refund_date,
    items: row.items,
    tag: row.tag,
  }));
}

function cogsRows(rows: TableRow[]): TableRow[] {
  return rows.map((row) => ({
    supplier: row.supplier,
    date: row.date,
    reference_order_id: row.reference_order_id,
    supplier_order_id: row.supplier_order_id,
    "total cost": row["total cost"],
    "est.cost": row["est.cost"],
  }));
}

export function DataExportControls() {
  const options = React.useMemo(monthOptions, []);
  const [month, setMonth] = React.useState(options[0] || "2026-01");
  const [table, setTable] = React.useState("all");
  const [format, setFormat] = React.useState("xlsx");
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");

  async function exportData() {
    setLoading(true);
    setMessage("");
    try {
      const query = `?month=${month}`;
      const selected =
        table === "all"
          ? tableOptions.slice(0, -1)
          : tableOptions.filter(([value]) => value === table);
      const loaded = await Promise.all(
        selected.map(async ([value, label]) => {
          const endpoint =
            value === "orders"
              ? `/api/shopify/orders${query}`
              : value === "cogs"
                ? `/api/cogs${query}`
                : value === "payouts"
                  ? `/api/shopify/payments${query}&includePayload=1`
                  : value === "meta"
                    ? `/api/meta/daily-financials${query}`
                    : `/api/airwallex/account-activity${query}`;
          const rows = await loadJson(endpoint);
          return {
            label,
            sheet: label,
            rows:
              value === "orders"
                ? orderRows(rows)
                : value === "cogs"
                  ? cogsRows(rows)
                  : value === "payouts"
                    ? payoutRows(rows)
                    : rows,
          };
        }),
      );
      if (format === "csv") {
        if (loaded.length === 1) downloadCsv(loaded[0], month);
        else {
          const combined = loaded.flatMap((item) =>
            item.rows.map((row) => ({ table: item.sheet, ...row })),
          );
          downloadCsv(
            { label: "All tables", sheet: "maturex-data", rows: combined },
            month,
          );
        }
      } else downloadXlsx(loaded, month);
      setMessage(
        `Exported ${loaded.reduce((total, item) => total + item.rows.length, 0)} rows`,
      );
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "Export failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button size="sm" variant="outline" />}>
        <DownloadIcon />
        Export
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-3">
        <div className="space-y-3">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="px-0">Export data</DropdownMenuLabel>
          </DropdownMenuGroup>
          <label className="block space-y-1 text-xs text-muted-foreground">
            Table
            <select
              aria-label="Select export table"
              className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
              value={table}
              onChange={(event) => setTable(event.target.value)}
            >
              {tableOptions.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1 text-xs text-muted-foreground">
              Month
              <select
                aria-label="Select export month"
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
              >
                {options.map((value) => (
                  <option key={value} value={value}>
                    {value === "all"
                      ? "All months"
                      : `Tháng ${Number(value.slice(5))}/${value.slice(0, 4)}`}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-xs text-muted-foreground">
              Format
              <select
                aria-label="Select export format"
                className="h-8 w-full rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                value={format}
                onChange={(event) => setFormat(event.target.value)}
              >
                <option value="xlsx">XLSX</option>
                <option value="csv">CSV</option>
              </select>
            </label>
          </div>
          <Button
            className="w-full"
            onClick={() => void exportData()}
            disabled={loading}
          >
            <DownloadIcon />
            {loading ? "Exporting..." : "Download"}
          </Button>
          {message ? (
            <p className="text-muted-foreground text-xs">{message}</p>
          ) : null}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
