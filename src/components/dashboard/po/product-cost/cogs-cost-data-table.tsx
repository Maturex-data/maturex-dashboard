"use client";

import {
  type CogsRow,
  formatCost,
  headers,
} from "@/components/dashboard/po/product-cost/types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CogsCostDataTableProps {
  rows: CogsRow[];
  loading: boolean;
}

export function CogsCostDataTable({ rows, loading }: CogsCostDataTableProps) {
  return (
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
                  <span className="size-2 rounded-full bg-amber-500 animate-ping" />
                  <span>Đang tải chi phí Fulfillment...</span>
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
                Không có bản ghi COGS nào trong tháng này.
              </TableCell>
            </TableRow>
          ) : null}
          {!loading &&
            rows.map((row, index) => (
              <TableRow
                key={`${row.supplier}-${row.supplier_order_id}-${index}`}
                className="hover:bg-muted/40 transition-colors border-b border-border/40 font-mono"
              >
                <TableCell>
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-muted text-foreground text-[11px] font-medium border border-border/50">
                    {row.supplier}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.date}
                </TableCell>
                <TableCell className="text-foreground">
                  {row.reference_order_id || "—"}
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {row.supplier_order_id || "—"}
                </TableCell>
                <TableCell className="text-right text-foreground font-medium">
                  {formatCost(row["total cost"])}
                </TableCell>
                <TableCell className="text-right text-muted-foreground">
                  {formatCost(row["est.cost"])}
                </TableCell>
              </TableRow>
            ))}
        </TableBody>
      </Table>
    </div>
  );
}
