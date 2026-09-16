"use client";

import { ArrowLeftIcon, ArrowRightIcon, Columns3Icon } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type RawOrderRow = Record<string, string | number | null>;

const columns = [
  ["order_name", "Order Name"],
  ["order_date", "Order Date"],
  ["financial_status", "Financial Status"],
  ["fulfillment_status", "Fulfillment Status"],
  ["fulfillment_date", "Fulfillment Date"],
  ["delivery_status", "Delivery Status"],
  ["delivery_date", "Delivery Date"],
  ["gross_sales", "Gross Sales"],
  ["discounts", "Discounts"],
  ["shipping_charged", "Shipping Charged"],
  ["sales_tax", "Sales Tax"],
  ["order_total_before_refund", "Total Before Refund"],
  ["order_total", "Order Total"],
  ["refund_amount", "Refund Amount"],
  ["refund_date", "Refund Date"],
  ["items", "Items"],
  ["tag", "Tag"],
] as const;

type OrdersResponse = {
  month: string | null;
  months: string[];
  rows: RawOrderRow[];
};

function formatMonth(month: string): string {
  const [year, monthNumber] = month.split("-");
  return `Tháng ${Number(monthNumber)} năm ${year}`;
}

type ColumnKey = (typeof columns)[number][0];

const initialVisibility = Object.fromEntries(
  columns.map(([key]) => [key, true]),
) as Record<ColumnKey, boolean>;
const PAGE_SIZE = 50;

export function RawOrdersTable() {
  const [data, setData] = useState<OrdersResponse>({
    month: null,
    months: [],
    rows: [],
  });
  const [selectedMonth, setSelectedMonth] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [visibleColumns, setVisibleColumns] =
    useState<Record<ColumnKey, boolean>>(initialVisibility);
  const [currentPage, setCurrentPage] = useState(1);

  const displayedColumns = columns.filter(([key]) => visibleColumns[key]);
  const pageCount = Math.max(1, Math.ceil(data.rows.length / PAGE_SIZE));
  const pageRows = data.rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedMonth) params.set("month", selectedMonth);
    params.set("refresh", String(refreshKey));
    setIsLoading(true);
    fetch(`/api/shopify/orders?${params.toString()}`, { cache: "no-store" })
      .then((response) => response.json() as Promise<OrdersResponse>)
      .then((payload) => {
        setData(payload);
        setCurrentPage(1);
        if (!selectedMonth && payload.month) setSelectedMonth(payload.month);
      })
      .finally(() => setIsLoading(false));
  }, [refreshKey, selectedMonth]);

  useEffect(() => {
    const handleSync = () => setRefreshKey((value) => value + 1);
    window.addEventListener("shopify-orders-sync", handleSync);

    return () => window.removeEventListener("shopify-orders-sync", handleSync);
  }, []);

  return (
    <div className="space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-medium text-sm">RAW.ORDER</p>
          <p className="text-muted-foreground text-xs">
            {data.rows.length} orders in selected month
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-muted-foreground text-sm">
            Month
            <select
              aria-label="Select order month"
              className="h-8 rounded-lg border border-input bg-background px-2 text-foreground text-sm"
              onChange={(event) => setSelectedMonth(event.target.value)}
              value={selectedMonth}
            >
              {data.months.map((month) => (
                <option key={month} value={month}>
                  {formatMonth(month)}
                </option>
              ))}
            </select>
          </label>
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button size="sm" variant="outline" />}
            >
              <Columns3Icon />
              Columns
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Show columns</DropdownMenuLabel>
                {columns.map(([key, label]) => (
                  <DropdownMenuCheckboxItem
                    checked={visibleColumns[key]}
                    key={key}
                    onCheckedChange={(checked) =>
                      setVisibleColumns((current) => ({
                        ...current,
                        [key]: checked === true,
                      }))
                    }
                  >
                    {label}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="max-h-[520px] overflow-auto rounded-lg border">
        <Table className="min-w-[1800px]">
          <TableHeader>
            <TableRow>
              {displayedColumns.map(([key, label]) => (
                <TableHead key={key}>{label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={Math.max(displayedColumns.length, 1)}>
                  Loading orders...
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading && data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={Math.max(displayedColumns.length, 1)}>
                  No orders for this month.
                </TableCell>
              </TableRow>
            ) : null}
            {!isLoading
              ? pageRows.map((row, index) => (
                  <TableRow
                    key={`${row.order_name}-${row.order_date}-${index}`}
                  >
                    {displayedColumns.map(([key]) => (
                      <TableCell className="whitespace-nowrap" key={key}>
                        {row[key] ?? ""}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              : null}
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 text-muted-foreground text-sm">
        <span>
          Showing{" "}
          {data.rows.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1}-
          {Math.min(currentPage * PAGE_SIZE, data.rows.length)} of{" "}
          {data.rows.length} rows
        </span>
        <div className="flex items-center gap-2">
          <Button
            aria-label="Previous page"
            disabled={currentPage === 1 || isLoading}
            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
            size="sm"
            title="Previous page"
            variant="outline"
          >
            <ArrowLeftIcon />
          </Button>
          <span className="min-w-20 text-center">
            Page {currentPage} / {pageCount}
          </span>
          <Button
            aria-label="Next page"
            disabled={currentPage === pageCount || isLoading}
            onClick={() =>
              setCurrentPage((page) => Math.min(pageCount, page + 1))
            }
            size="sm"
            title="Next page"
            variant="outline"
          >
            <ArrowRightIcon />
          </Button>
        </div>
      </div>
    </div>
  );
}
