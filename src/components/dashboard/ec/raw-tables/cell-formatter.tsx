import type * as React from "react";
import {
  MONEY_COLUMNS,
  type RawValue,
} from "@/components/dashboard/ec/raw-tables/types";

export function formatCellValue(key: string, value: RawValue): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40 font-mono">—</span>;
  }

  const str = String(value);

  // Status badges
  if (
    key === "financial_status" ||
    key === "payout_status" ||
    key === "transaction_status"
  ) {
    const s = str.toLowerCase();
    const isSuccess =
      s.includes("paid") || s.includes("success") || s.includes("settled");
    const isPending = s.includes("pending") || s.includes("in_transit");
    const isDanger =
      s.includes("refund") || s.includes("fail") || s.includes("void");

    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-medium ${
          isSuccess
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
            : isPending
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20"
              : isDanger
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                : "bg-muted text-muted-foreground border border-border/50"
        }`}
      >
        <span
          className={`size-1.5 rounded-full ${
            isSuccess
              ? "bg-emerald-500"
              : isPending
                ? "bg-amber-500"
                : isDanger
                  ? "bg-rose-500"
                  : "bg-muted-foreground"
          }`}
        />
        {str}
      </span>
    );
  }

  if (key === "fulfillment_status" || key === "delivery_status") {
    const s = str.toLowerCase();
    const isFulfilled = s.includes("fulfilled") || s.includes("delivered");
    return (
      <span
        className={`inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-mono ${
          isFulfilled
            ? "bg-sky-500/10 text-sky-600 dark:text-sky-400 font-medium"
            : "text-muted-foreground"
        }`}
      >
        {str}
      </span>
    );
  }

  // Money values
  if (MONEY_COLUMNS.has(key)) {
    const num = Number(str.replaceAll(/[^0-9.-]/g, ""));
    if (!Number.isNaN(num)) {
      const isNegative =
        num < 0 || key === "refund_amount" || key === "discounts";
      return (
        <span
          className={`font-mono text-xs tabular-nums ${
            isNegative
              ? "text-rose-500 font-medium"
              : num > 0
                ? "text-foreground font-medium"
                : "text-muted-foreground"
          }`}
        >
          {num < 0 ? "-" : key === "refund_amount" ? "-" : ""}$
          {Math.abs(num).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      );
    }
  }

  // IDs or Codes
  if (
    key.includes("id") ||
    key === "order_name" ||
    key.includes("date") ||
    key === "currency"
  ) {
    return <span className="font-mono text-xs text-foreground/80">{str}</span>;
  }

  return <span className="text-xs">{str}</span>;
}

export function normalizeText(text: unknown): string {
  if (text === null || text === undefined) return "";
  return String(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
