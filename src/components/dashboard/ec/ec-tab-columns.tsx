import type { ColumnDef } from "@/components/shared/data-table";
import { Badge } from "@/components/ui/badge";

export function formatMoney(val: unknown): string {
  if (val === null || val === undefined) return "0.00";
  const num = typeof val === "number" ? val : Number(val);
  return Number.isNaN(num) ? "0.00" : num.toFixed(2);
}

// biome-ignore lint/suspicious/noExplicitAny: dynamic sheet row
export type SheetRow = Record<string, any>;

export function getTabColumns(
  activeTab: string,
  sortField?: string,
  sortDir?: "asc" | "desc",
  onSort?: (field: string) => void,
): ColumnDef<SheetRow>[] {
  const renderSortIndicator = (key: string) => {
    if (sortField !== key) return null;
    return <span>{sortDir === "asc" ? " ▲" : " ▼"}</span>;
  };

  switch (activeTab) {
    case "orders":
      return [
        {
          id: "month",
          header: "Month",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.month}</span>
          ),
        },
        {
          id: "sourceRow",
          header: "Row",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.sourceRow}</span>
          ),
        },
        {
          id: "orderName",
          header: (
            <span className="select-none">
              Order{renderSortIndicator("orderName")}
            </span>
          ),
          headerClassName:
            "cursor-pointer hover:text-foreground whitespace-nowrap",
          onHeaderClick: onSort ? () => onSort("orderName") : undefined,
          accessor: (r) => (
            <span className="font-semibold text-foreground font-sans">
              {r.orderName}
            </span>
          ),
        },
        {
          id: "orderDate",
          header: (
            <span className="select-none">
              Date{renderSortIndicator("orderDate")}
            </span>
          ),
          headerClassName:
            "cursor-pointer hover:text-foreground whitespace-nowrap",
          onHeaderClick: onSort ? () => onSort("orderDate") : undefined,
          accessor: (r) => (
            <span className="text-muted-foreground">{r.orderDate}</span>
          ),
        },
        {
          id: "grossSales",
          header: "Gross sales",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right",
          accessor: (r) => `$${formatMoney(r.grossSales)}`,
        },
        {
          id: "discounts",
          header: "Discounts",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right text-rose-600 dark:text-rose-400",
          accessor: (r) =>
            Number(r.discounts) > 0 ? `-${formatMoney(r.discounts)}` : "0.00",
        },
        {
          id: "shippingCharged",
          header: "Shipping",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right",
          accessor: (r) => `$${formatMoney(r.shippingCharged)}`,
        },
        {
          id: "originalTax",
          header: "Tax",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right",
          accessor: (r) => `$${formatMoney(r.originalTax)}`,
        },
        {
          id: "correctedNet",
          header: "Corrected net",
          headerClassName:
            "text-right whitespace-nowrap font-semibold text-foreground",
          cellClassName: "text-right font-bold text-foreground",
          accessor: (r) => `$${formatMoney(r.correctedNet)}`,
        },
        {
          id: "refundSnapshot",
          header: "Refund",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right text-amber-600 dark:text-amber-400",
          accessor: (r) =>
            Number(r.refundSnapshot) > 0
              ? `-$${formatMoney(r.refundSnapshot)}`
              : "0.00",
        },
        {
          id: "beforeRefund",
          header: "Before refund",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right text-muted-foreground",
          accessor: (r) => `$${formatMoney(r.beforeRefund)}`,
        },
        {
          id: "source",
          header: "Source",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-sans text-muted-foreground",
          accessor: (r) => r.source || "—",
        },
        {
          id: "itemName",
          header: "Item name",
          headerClassName: "whitespace-nowrap",
          cellClassName:
            "font-sans text-muted-foreground max-w-[240px] truncate",
          accessor: (r) => <span title={r.itemName}>{r.itemName || "—"}</span>,
        },
      ];

    case "cogs":
      return [
        {
          id: "month",
          header: "Month",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.month}</span>
          ),
        },
        {
          id: "sourceRow",
          header: "Row",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.sourceRow}</span>
          ),
        },
        {
          id: "supplier",
          header: (
            <span className="select-none">
              Supplier{renderSortIndicator("supplier")}
            </span>
          ),
          headerClassName:
            "cursor-pointer hover:text-foreground whitespace-nowrap",
          onHeaderClick: onSort ? () => onSort("supplier") : undefined,
          accessor: (r) => (
            <span className="font-semibold text-foreground font-sans">
              {r.supplier}
            </span>
          ),
        },
        {
          id: "costDate",
          header: (
            <span className="select-none">
              Date{renderSortIndicator("costDate")}
            </span>
          ),
          headerClassName:
            "cursor-pointer hover:text-foreground whitespace-nowrap",
          onHeaderClick: onSort ? () => onSort("costDate") : undefined,
          accessor: (r) => (
            <span className="text-muted-foreground">{r.costDate}</span>
          ),
        },
        {
          id: "referenceOrderId",
          header: "Reference Order",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-sans text-foreground",
          accessor: (r) => r.referenceOrderId || "—",
        },
        {
          id: "supplierOrderId",
          header: "Supplier Order",
          headerClassName: "whitespace-nowrap",
          cellClassName: "text-muted-foreground",
          accessor: (r) => r.supplierOrderId || "—",
        },
        {
          id: "totalCost",
          header: "Total cost",
          headerClassName:
            "text-right whitespace-nowrap font-semibold text-foreground",
          cellClassName: "text-right font-bold text-foreground",
          accessor: (r) => `$${formatMoney(r.totalCost)}`,
        },
        {
          id: "estimatedCost",
          header: "Estimated cost",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right text-muted-foreground",
          accessor: (r) => `$${formatMoney(r.estimatedCost)}`,
        },
        {
          id: "rowKey",
          header: "Row key",
          headerClassName: "whitespace-nowrap",
          cellClassName:
            "text-muted-foreground text-[11px] truncate max-w-[140px]",
          accessor: (r) => <span title={r.rowKey}>{r.rowKey}</span>,
        },
        {
          id: "treatment",
          header: "Treatment",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-sans",
          accessor: (r) => (
            <Badge
              variant="outline"
              className={`text-[10px] py-0 px-1 font-medium ${
                r.treatment?.includes("Loại")
                  ? "border-muted text-muted-foreground bg-muted/40"
                  : "border-emerald-500/30 text-emerald-600 bg-emerald-500/10"
              }`}
            >
              {r.treatment || "—"}
            </Badge>
          ),
        },
        {
          id: "itemsName",
          header: "Items name",
          headerClassName: "whitespace-nowrap",
          cellClassName:
            "font-sans text-muted-foreground max-w-[200px] truncate",
          accessor: (r) => (
            <span title={r.itemsName}>{r.itemsName || "—"}</span>
          ),
        },
      ];

    case "ads":
      return [
        {
          id: "month",
          header: "Month",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.month}</span>
          ),
        },
        {
          id: "sourceRow",
          header: "Row",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.sourceRow}</span>
          ),
        },
        {
          id: "externalId",
          header: "External ID",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-medium text-foreground",
          accessor: (r) => r.externalId,
        },
        {
          id: "date",
          header: (
            <span className="select-none">
              Date{renderSortIndicator("date")}
            </span>
          ),
          headerClassName:
            "cursor-pointer hover:text-foreground whitespace-nowrap",
          onHeaderClick: onSort ? () => onSort("date") : undefined,
          accessor: (r) => (
            <span className="text-muted-foreground">{r.date}</span>
          ),
        },
        {
          id: "accountId",
          header: "Account ID",
          headerClassName: "whitespace-nowrap",
          cellClassName: "text-muted-foreground",
          accessor: (r) => r.accountId,
        },
        {
          id: "currency",
          header: "Currency",
          headerClassName: "whitespace-nowrap",
          cellClassName: "text-muted-foreground",
          accessor: (r) => r.currency,
        },
        {
          id: "spend",
          header: "Spend",
          headerClassName:
            "text-right whitespace-nowrap font-semibold text-foreground",
          cellClassName:
            "text-right font-bold text-violet-600 dark:text-violet-400",
          accessor: (r) => `$${formatMoney(r.spend)}`,
        },
        {
          id: "granularity",
          header: "Granularity",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-sans text-muted-foreground",
          accessor: (r) => r.granularity,
        },
        {
          id: "source",
          header: "Source",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-sans text-muted-foreground",
          accessor: (r) => r.source || "—",
        },
      ];

    case "payouts":
      return [
        {
          id: "monthLocal",
          header: "Month local",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.monthLocal}</span>
          ),
        },
        {
          id: "sourceRow",
          header: "Row",
          accessor: (r) => (
            <span className="text-muted-foreground">{r.sourceRow}</span>
          ),
        },
        {
          id: "balanceTransactionId",
          header: "Tx ID",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-semibold text-foreground text-[11px]",
          accessor: (r) => r.balanceTransactionId,
        },
        {
          id: "payoutId",
          header: "Payout ID",
          headerClassName: "whitespace-nowrap",
          cellClassName: "text-muted-foreground text-[11px]",
          accessor: (r) => r.payoutId || "—",
        },
        {
          id: "type",
          header: "Type",
          headerClassName: "whitespace-nowrap",
          cellClassName: "font-sans",
          accessor: (r) => (
            <Badge
              variant="outline"
              className="text-[10px] py-0 px-1 font-medium"
            >
              {r.type}
            </Badge>
          ),
        },
        {
          id: "currency",
          header: "Currency",
          headerClassName: "whitespace-nowrap",
          cellClassName: "text-muted-foreground",
          accessor: (r) => r.currency,
        },
        {
          id: "gross",
          header: "Gross",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right",
          accessor: (r) => `$${formatMoney(r.gross)}`,
        },
        {
          id: "fee",
          header: "Fee",
          headerClassName:
            "text-right whitespace-nowrap font-semibold text-foreground",
          cellClassName: "text-right font-bold text-sky-600 dark:text-sky-400",
          accessor: (r) => `$${formatMoney(r.fee)}`,
        },
        {
          id: "net",
          header: "Net",
          headerClassName: "text-right whitespace-nowrap",
          cellClassName: "text-right text-muted-foreground",
          accessor: (r) => `$${formatMoney(r.net)}`,
        },
        {
          id: "processedVietnam",
          header: (
            <span className="select-none">
              Processed Vietnam{renderSortIndicator("processedUtc")}
            </span>
          ),
          headerClassName:
            "cursor-pointer hover:text-foreground whitespace-nowrap",
          cellClassName: "text-muted-foreground whitespace-nowrap",
          onHeaderClick: onSort ? () => onSort("processedUtc") : undefined,
          accessor: (r) => r.processedVietnam,
        },
        {
          id: "reason",
          header: "Reason",
          headerClassName: "whitespace-nowrap",
          cellClassName:
            "font-sans text-muted-foreground max-w-[150px] truncate",
          accessor: (r) => <span title={r.reason}>{r.reason || "—"}</span>,
        },
      ];

    default:
      return [];
  }
}
