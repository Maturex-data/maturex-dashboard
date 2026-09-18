import type * as React from "react";
import { MONEY_COLUMNS } from "./flowa-table-columns";

export function formatCellValue(
  key: string,
  value: unknown,
  currency = "USD",
): React.ReactNode {
  if (value === null || value === undefined || value === "") {
    return <span className="text-muted-foreground/40 font-mono">—</span>;
  }

  const str = String(value);

  // Status badges
  if (key === "status" || key === "match_status") {
    const s = str.toLowerCase();
    const isSuccess =
      s.includes("paid") ||
      s.includes("completed") ||
      s.includes("matched") ||
      s.includes("shipped");
    const isPending =
      s.includes("pending") || s.includes("processing") || s.includes("open");
    const isDanger =
      s.includes("cancel") || s.includes("refund") || s.includes("unmatched");

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

  if (key === "type") {
    const s = str.toLowerCase();
    const isSale = s.includes("sale");
    const isFee =
      s.includes("fee") || s.includes("tax") || s.includes("shipping_label");
    const isDeposit = s.includes("deposit");
    const isRefund = s.includes("refund");

    return (
      <span
        className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-mono font-medium ${
          isSale
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : isDeposit
              ? "bg-sky-500/10 text-sky-600 dark:text-sky-400"
              : isRefund
                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                : isFee
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  : "bg-muted text-muted-foreground"
        }`}
      >
        {str}
      </span>
    );
  }

  if (key === "shop_name") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-500/20 shadow-2xs">
        {str}
      </span>
    );
  }

  if (MONEY_COLUMNS.has(key)) {
    const num = Number(str.replaceAll(/[^0-9.-]/g, ""));
    if (!Number.isNaN(num)) {
      const isNegative =
        num < 0 || key === "card_processing_fees" || key === "discount_amount";
      const symbol = currency === "GBP" ? "£" : "$";
      return (
        <span
          className={`font-mono text-xs tabular-nums tracking-tight ${
            isNegative
              ? "text-rose-600 dark:text-rose-400 font-semibold"
              : num > 0
                ? "text-emerald-700 dark:text-emerald-300 font-semibold"
                : "text-muted-foreground/60"
          }`}
        >
          {num < 0 ||
          [
            "card_processing_fees",
            "discount_amount",
            "shipping_discount",
            "in_person_discount",
          ].includes(key)
            ? "-"
            : ""}
          {symbol}
          {Math.abs(num).toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
      );
    }
  }

  if (
    key === "order_id" ||
    key === "transaction_id" ||
    key === "extracted_order_id"
  ) {
    return (
      <span className="font-mono text-xs font-bold text-foreground tracking-normal select-all bg-muted/50 px-1.5 py-0.5 rounded border border-border/40">
        {str}
      </span>
    );
  }

  if (
    key === "sale_date" ||
    key === "statement_date" ||
    key === "date_shipped" ||
    key === "date_paid"
  ) {
    return (
      <span className="font-mono text-xs text-foreground/80 font-medium tracking-tight">
        {str}
      </span>
    );
  }

  if (key === "number_of_items") {
    return (
      <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-muted font-mono text-[11px] font-semibold text-foreground border border-border/60">
        {str}
      </span>
    );
  }

  if (key === "payment_method") {
    return (
      <span className="text-xs text-muted-foreground font-medium">{str}</span>
    );
  }

  if (key === "currency") {
    return (
      <span className="font-mono text-[11px] text-muted-foreground uppercase font-semibold">
        {str}
      </span>
    );
  }

  if (key === "buyer_user_id") {
    return (
      <span className="font-mono text-xs text-muted-foreground/90 bg-muted/30 px-1 py-0.5 rounded">
        {str}
      </span>
    );
  }

  if (key === "full_name" || key === "buyer") {
    return (
      <span className="font-semibold text-foreground text-xs hover:text-primary transition-colors">
        {str}
      </span>
    );
  }

  return <span className="text-xs text-foreground/80">{str}</span>;
}
