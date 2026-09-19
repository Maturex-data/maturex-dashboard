"use client";

import { CalendarIcon, ChevronDownIcon, RefreshCwIcon } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
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
import { formatVietnamMonth } from "@/lib/date-time";

type CogsRow = {
  supplier: string;
  date: string;
  reference_order_id: string | null;
  supplier_order_id: string | null;
  "total cost": string;
  "est.cost": string;
};

type CogsSyncSourceRun = {
  source: string;
  status: string;
  pagesProcessed: number;
  totalPages: number | null;
  rowsFetched: number;
  addedCount: number;
  skippedCount: number;
  errorMessage: string | null;
};

type CogsSyncJob = {
  id: string;
  status: string;
  syncType: string;
  addedCount: number;
  skippedCount: number;
  sourceRuns: CogsSyncSourceRun[];
};

const headers: Array<{
  key: keyof CogsRow;
  label: string;
  align?: "left" | "right";
}> = [
  { key: "supplier", label: "Supplier", align: "left" },
  { key: "date", label: "Date", align: "left" },
  { key: "reference_order_id", label: "Ref Order ID", align: "left" },
  { key: "supplier_order_id", label: "Supplier Order ID", align: "left" },
  { key: "total cost", label: "Total Cost", align: "right" },
  { key: "est.cost", label: "Est. Cost", align: "right" },
];

const syncMonths = Array.from(
  { length: 12 },
  (_, index) => `2026-${String(index + 1).padStart(2, "0")}`,
);

function formatCost(val: string): string {
  const num = Number(val.replaceAll(/[^0-9.-]/g, ""));
  if (Number.isNaN(num)) return val;
  return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function PoProductCostTable() {
  const [rows, setRows] = React.useState<CogsRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [supplier, setSupplier] = React.useState("all");
  const [month, setMonth] = React.useState(() =>
    formatVietnamMonth(new Date()),
  );
  const [selectedSyncMonths, setSelectedSyncMonths] = React.useState<string[]>(
    () => [formatVietnamMonth(new Date())],
  );
  const [syncJob, setSyncJob] = React.useState<CogsSyncJob | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    const response = await fetch(`/api/cogs?month=${month}`, {
      cache: "no-store",
    });
    const payload = (await response.json()) as { rows?: CogsRow[] };
    setRows(payload.rows || []);
    setLoading(false);
  }, [month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const loadSyncJob = React.useCallback(async (jobId?: string) => {
    const query = jobId ? `jobId=${jobId}` : "syncStatus=latest";
    const response = await fetch(`/api/cogs?${query}`, { cache: "no-store" });
    if (!response.ok) return null;
    const payload = (await response.json()) as { job?: CogsSyncJob | null };
    setSyncJob(payload.job || null);
    return payload.job || null;
  }, []);

  React.useEffect(() => {
    void loadSyncJob();
  }, [loadSyncJob]);

  const historyRunning =
    syncJob?.status === "QUEUED" || syncJob?.status === "RUNNING";

  React.useEffect(() => {
    if (!syncJob?.id || !historyRunning) return;
    const timer = window.setInterval(async () => {
      const job = await loadSyncJob(syncJob.id);
      if (job && !["QUEUED", "RUNNING"].includes(job.status)) {
        setMessage(
          job.status === "COMPLETED"
            ? `Đã đồng bộ lịch sử: ${job.addedCount} mới, ${job.skippedCount} cập nhật`
            : "Đồng bộ lịch sử hoàn tất một phần. Có thể chạy lại nguồn lỗi.",
        );
        await load();
      }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [historyRunning, load, loadSyncJob, syncJob?.id]);

  function toggleSyncMonth(value: string, checked: boolean) {
    setSelectedSyncMonths((current) => {
      if (checked) return [...new Set([...current, value])].sort();
      return current.filter((item) => item !== value);
    });
  }

  async function sync() {
    if (selectedSyncMonths.length === 0) return;
    setSyncing(true);
    setMessage("");
    if (selectedSyncMonths.length === syncMonths.length) {
      try {
        const response = await fetch("/api/cogs?mode=history", {
          method: "POST",
        });
        const payload = (await response.json()) as {
          jobId?: string;
          reused?: boolean;
          error?: string;
        };
        if (!response.ok || !payload.jobId) {
          setMessage(payload.error || "Không thể bắt đầu đồng bộ lịch sử.");
          return;
        }
        await loadSyncJob(payload.jobId);
        setMessage(
          payload.reused
            ? "Đang tiếp tục job đồng bộ hiện có."
            : "Đã bắt đầu đồng bộ lịch sử.",
        );
      } finally {
        setSyncing(false);
      }
      return;
    }
    let added = 0;
    let skipped = 0;
    const errors: string[] = [];

    try {
      for (const syncMonth of selectedSyncMonths) {
        const response = await fetch(`/api/cogs?month=${syncMonth}`, {
          method: "POST",
        });
        const payload = (await response.json()) as {
          added?: number;
          skipped?: number;
          error?: string;
        };
        if (!response.ok || payload.error) {
          errors.push(`T${Number(syncMonth.slice(5))}`);
          continue;
        }
        added += payload.added || 0;
        skipped += payload.skipped || 0;
      }
      setMessage(
        errors.length > 0
          ? `Đã sync ${selectedSyncMonths.length - errors.length}/${selectedSyncMonths.length} tháng; lỗi ${errors.join(", ")}`
          : `Đã đồng bộ ${added} mới, bỏ qua ${skipped} (${selectedSyncMonths.length} tháng)`,
      );
      await load();
    } finally {
      setSyncing(false);
    }
  }

  async function retryFailedSources() {
    if (!syncJob) return;
    setSyncing(true);
    try {
      const response = await fetch(
        `/api/cogs?action=retry&jobId=${syncJob.id}`,
        { method: "POST" },
      );
      const payload = (await response.json()) as { retried?: boolean };
      if (payload.retried) {
        await loadSyncJob(syncJob.id);
        setMessage("Đang chạy lại các nguồn bị lỗi.");
      }
    } finally {
      setSyncing(false);
    }
  }

  const suppliers = React.useMemo(
    () => [...new Set(rows.map((row) => row.supplier))].sort(),
    [rows],
  );
  const visibleRows = React.useMemo(
    () =>
      supplier === "all"
        ? rows
        : rows.filter((row) => row.supplier === supplier),
    [rows, supplier],
  );
  const totalCogs = visibleRows.reduce(
    (acc, r) =>
      acc + (Number(r["total cost"]?.replaceAll(/[^0-9.-]/g, "")) || 0),
    0,
  );

  return (
    <div className="w-full space-y-3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground flex items-center gap-1 font-medium">
              <CalendarIcon className="size-3.5" /> Tháng:
            </span>
            <select
              aria-label="Select COGS month"
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground font-mono focus:outline-hidden"
              value={month}
              onChange={(event) => {
                const value = event.target.value;
                setMonth(value);
                setSelectedSyncMonths([value]);
              }}
            >
              {Array.from({ length: 12 }, (_, index) => {
                const value = `2026-${String(index + 1).padStart(2, "0")}`;
                return (
                  <option key={value} value={value}>
                    Tháng {index + 1}/2026
                  </option>
                );
              })}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              Supplier:
            </span>
            <select
              aria-label="Select COGS supplier"
              className="h-8 rounded-lg border border-border/60 bg-background px-2.5 text-xs text-foreground font-mono focus:outline-hidden"
              value={supplier}
              onChange={(event) => setSupplier(event.target.value)}
            >
              <option value="all">Tất cả</option>
              {suppliers.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </div>

          <div className="hidden sm:flex items-center gap-3 border-l border-border/60 pl-3 text-xs font-mono">
            <span className="text-muted-foreground">
              Total COGS:{" "}
              <strong className="text-foreground font-semibold">
                $
                {totalCogs.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>
            <span className="text-muted-foreground">
              ({visibleRows.length} dòng)
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {message ? (
            <span className="text-xs text-muted-foreground font-mono bg-muted/60 px-2 py-0.5 rounded">
              {message}
            </span>
          ) : null}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs"
                  disabled={syncing || historyRunning}
                />
              }
            >
              <RefreshCwIcon
                className={`size-3.5 ${syncing || historyRunning ? "animate-spin" : ""}`}
              />
              {syncing || historyRunning ? "Đang sync..." : "Sync COGS"}
              <ChevronDownIcon className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuLabel>Chọn tháng đồng bộ</DropdownMenuLabel>
                <DropdownMenuCheckboxItem
                  checked={selectedSyncMonths.length === syncMonths.length}
                  onCheckedChange={(checked) =>
                    setSelectedSyncMonths(checked === true ? syncMonths : [])
                  }
                >
                  Tất cả tháng
                </DropdownMenuCheckboxItem>
                <DropdownMenuSeparator />
                {syncMonths.map((value, index) => (
                  <DropdownMenuCheckboxItem
                    checked={selectedSyncMonths.includes(value)}
                    key={value}
                    onCheckedChange={(checked) =>
                      toggleSyncMonth(value, checked === true)
                    }
                  >
                    Tháng {index + 1}/2026
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="justify-center font-medium"
                disabled={selectedSyncMonths.length === 0}
                onClick={() => void sync()}
              >
                Đồng bộ đã chọn ({selectedSyncMonths.length})
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {syncJob &&
      (historyRunning ||
        syncJob.status === "PARTIAL_FAILED" ||
        syncJob.status === "FAILED") ? (
        <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold text-foreground">
                Đồng bộ lịch sử COGS
              </p>
              <p className="text-[11px] text-muted-foreground">
                {syncJob.status === "RUNNING" || syncJob.status === "QUEUED"
                  ? "Đang quét mỗi nhà cung cấp một lần"
                  : "Một số nguồn chưa hoàn tất"}
              </p>
            </div>
            {syncJob.sourceRuns.some((source) => source.status === "FAILED") &&
            !historyRunning ? (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                disabled={syncing}
                onClick={() => void retryFailedSources()}
              >
                Chạy lại nguồn lỗi
              </Button>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {syncJob.sourceRuns.map((source) => {
              const percent = source.totalPages
                ? Math.min(
                    100,
                    Math.round(
                      (source.pagesProcessed / source.totalPages) * 100,
                    ),
                  )
                : source.status === "COMPLETED"
                  ? 100
                  : 0;
              return (
                <div
                  key={source.source}
                  className="space-y-1.5 rounded-md border border-border/50 bg-background p-2"
                >
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="font-medium text-foreground">
                      {source.source}
                    </span>
                    <span className="text-muted-foreground">
                      {source.status === "FAILED"
                        ? "Lỗi"
                        : source.status === "COMPLETED"
                          ? "Xong"
                          : `${percent}%`}
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full transition-all ${source.status === "FAILED" ? "bg-destructive" : "bg-foreground"}`}
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {source.errorMessage ||
                      `${source.pagesProcessed}${source.totalPages ? `/${source.totalPages}` : ""} trang · ${source.rowsFetched} dòng`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

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
            {!loading && visibleRows.length === 0 ? (
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
              visibleRows.map((row, index) => (
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
    </div>
  );
}
