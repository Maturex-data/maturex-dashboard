import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface ColumnDef<T> {
  id?: string;
  header: ReactNode;
  accessor: (row: T, index: number) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string | number;
  emptyMessage?: ReactNode;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: (row: T, index: number) => string;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "Không có dữ liệu.",
  tableClassName,
  headerClassName,
  rowClassName,
}: DataTableProps<T>) {
  if (data.length === 0) {
    return <div className="w-full">{emptyMessage}</div>;
  }

  return (
    <div className="w-full">
      <Table className={tableClassName}>
        <TableHeader
          className={headerClassName ?? "bg-zinc-50/50 dark:bg-zinc-900/20"}
        >
          <TableRow className="hover:bg-transparent border-border/50">
            {columns.map((col, index) => {
              const columnKey =
                col.id ||
                (typeof col.header === "string" ? col.header : `col-${index}`);
              return (
                <TableHead
                  key={columnKey}
                  className={
                    col.headerClassName ||
                    "h-10 px-3 font-semibold text-muted-foreground"
                  }
                >
                  {col.header}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row, rowIndex) => (
            <TableRow
              key={keyExtractor(row, rowIndex)}
              className={`transition-colors hover:bg-muted/40 border-border/50 group ${
                rowClassName ? rowClassName(row, rowIndex) : ""
              }`}
            >
              {columns.map((col, colIndex) => {
                const columnKey =
                  col.id ||
                  (typeof col.header === "string"
                    ? col.header
                    : `col-${colIndex}`);
                return (
                  <TableCell
                    key={columnKey}
                    className={col.cellClassName || "p-3"}
                  >
                    {col.accessor(row, rowIndex)}
                  </TableCell>
                );
              })}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
