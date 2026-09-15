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
  accessor: (row: T) => ReactNode;
  headerClassName?: string;
  cellClassName?: string;
}

interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  keyExtractor: (row: T) => string | number;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
}: DataTableProps<T>) {
  return (
    <div className="w-full">
      <Table>
        <TableHeader className="bg-zinc-50/50 dark:bg-zinc-900/20">
          <TableRow className="hover:bg-transparent border-border/50">
            {columns.map((col, index) => {
              const columnKey =
                col.id ||
                (typeof col.header === "string" ? col.header : `col-${index}`);
              return (
                <TableHead
                  key={columnKey}
                  className={`h-12 font-semibold text-muted-foreground ${col.headerClassName || ""}`}
                >
                  {col.header}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((row) => (
            <TableRow
              key={keyExtractor(row)}
              className="transition-colors hover:bg-muted/40 border-border/50 group"
            >
              {columns.map((col, index) => {
                const columnKey =
                  col.id ||
                  (typeof col.header === "string"
                    ? col.header
                    : `col-${index}`);
                return (
                  <TableCell
                    key={columnKey}
                    className={`py-4 ${col.cellClassName || ""}`}
                  >
                    {col.accessor(row)}
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
