"use client";

import * as React from "react";
import { CogsCostDataTable } from "@/components/dashboard/po/product-cost/cogs-cost-data-table";
import { CogsFilterBar } from "@/components/dashboard/po/product-cost/cogs-filter-bar";
import { CogsSyncProgress } from "@/components/dashboard/po/product-cost/cogs-sync-progress";
import {
  type CogsRow,
  type CogsSyncJob,
  syncMonths,
} from "@/components/dashboard/po/product-cost/types";
import { formatVietnamMonth } from "@/lib/date-time";

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
      <CogsFilterBar
        month={month}
        onMonthChange={(m) => {
          setMonth(m);
          setSelectedSyncMonths([m]);
        }}
        supplier={supplier}
        onSupplierChange={setSupplier}
        suppliers={suppliers}
        totalCogs={totalCogs}
        visibleRowCount={visibleRows.length}
        message={message}
        syncing={syncing}
        historyRunning={historyRunning}
        selectedSyncMonths={selectedSyncMonths}
        onToggleSyncMonth={toggleSyncMonth}
        onSetSelectedSyncMonths={setSelectedSyncMonths}
        onSync={() => void sync()}
      />

      <CogsSyncProgress
        syncJob={syncJob}
        historyRunning={historyRunning}
        syncing={syncing}
        onRetryFailedSources={() => void retryFailedSources()}
      />

      <CogsCostDataTable rows={visibleRows} loading={loading} />
    </div>
  );
}
