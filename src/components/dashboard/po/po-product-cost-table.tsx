import {
  FileSpreadsheetIcon,
  MapPinIcon,
  Package2Icon,
  PrinterIcon,
} from "lucide-react";
import { type ColumnDef, DataTable } from "@/components/shared/data-table";
import type { ProductCostRecord } from "@/lib/mock-data";

const columns: ColumnDef<ProductCostRecord>[] = [
  {
    header: "Nguồn Supplier",
    headerClassName: "pl-6",
    cellClassName: "pl-6 align-top",
    accessor: (rec) => {
      let SourceIcon = Package2Icon;
      let iconColor = "";
      let sourceColor = "";

      if (rec.source === "Printify") {
        SourceIcon = PrinterIcon;
        iconColor = "text-emerald-600 dark:text-emerald-400";
        sourceColor =
          "bg-emerald-100 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800";
      } else if (rec.source === "PG Print 1") {
        SourceIcon = Package2Icon;
        iconColor = "text-sky-600 dark:text-sky-400";
        sourceColor =
          "bg-sky-100 dark:bg-sky-900/30 border-sky-200 dark:border-sky-800";
      } else {
        SourceIcon = FileSpreadsheetIcon;
        iconColor = "text-amber-600 dark:text-amber-400";
        sourceColor =
          "bg-amber-100 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800";
      }

      return (
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm border ${sourceColor} ${iconColor}`}
          >
            <SourceIcon className="w-5 h-5" />
          </div>
          <span className={`font-semibold text-sm ${iconColor}`}>
            {rec.source}
          </span>
        </div>
      );
    },
  },
  {
    header: "Mã đơn & Sản phẩm",
    cellClassName: "align-top",
    accessor: (rec) => (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-foreground text-sm font-mono group-hover:text-primary transition-colors">
            {rec.shopifyOrderRef}
          </span>
          <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded-md font-mono">
            {rec.externalOrderId}
          </span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-foreground text-sm truncate max-w-[250px]">
            {rec.productName}
          </span>
          <span className="text-xs text-muted-foreground">{rec.variant}</span>
        </div>
      </div>
    ),
  },
  {
    header: "SL",
    headerClassName: "text-center",
    cellClassName: "text-center align-top",
    accessor: (rec) => (
      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-muted font-mono font-medium text-foreground text-sm">
        {rec.quantity}
      </span>
    ),
  },
  {
    header: "Chi phí (Cost + Ship)",
    headerClassName: "text-right",
    cellClassName: "text-right align-top",
    accessor: (rec) => (
      <div className="flex flex-col items-end gap-1">
        <span className="text-muted-foreground font-mono text-sm">
          Base:{" "}
          <strong className="text-foreground">
            ${rec.baseCost.toFixed(2)}
          </strong>
        </span>
        <span className="text-[11px] text-muted-foreground font-mono flex items-center gap-1">
          <MapPinIcon className="w-3 h-3" />
          Ship: ${rec.shippingCost.toFixed(2)}
        </span>
      </div>
    ),
  },
  {
    header: "Tổng COGS",
    headerClassName: "text-right",
    cellClassName: "text-right align-top",
    accessor: (rec) => (
      <span className="font-bold text-foreground text-[16px] font-mono tracking-tight">
        ${rec.totalCost.toFixed(2)}
      </span>
    ),
  },
  {
    header: "Trạng thái SX",
    headerClassName: "text-center pr-6",
    cellClassName: "text-center pr-6 align-top",
    accessor: (rec) => (
      <>
        {rec.productionStatus === "Completed" ? (
          <div className="mx-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Hoàn tất ({rec.productionTimeDays}d)
          </div>
        ) : rec.productionStatus === "Shipped" ? (
          <div className="mx-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-600 dark:text-sky-400">
            <span className="h-1.5 w-1.5 rounded-full bg-sky-500"></span>
            Đã xuất xưởng
          </div>
        ) : (
          <div className="mx-auto inline-flex items-center justify-center gap-1.5 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            Đang in
          </div>
        )}
      </>
    ),
  },
];

export function PoProductCostTable({
  records,
}: {
  records: ProductCostRecord[];
}) {
  return (
    <DataTable
      columns={columns}
      data={records}
      keyExtractor={(rec) => rec.id}
    />
  );
}
