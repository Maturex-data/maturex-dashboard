"use client";

import { CheckIcon, InfoIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { syncFastwayAction } from "@/actions/etsy";
import { vietnamMonthRange } from "@/lib/date-time";
import {
  type FastwaySyncMode,
  FlFastwayDialog,
} from "./drive-sync/fl-fastway-dialog";
import { FlSyncConfigCard } from "./drive-sync/fl-sync-config-card";
import { FlSyncHistoryTable } from "./drive-sync/fl-sync-history-table";
import { FlTargetCard } from "./drive-sync/fl-target-card";
import {
  type DriveConnectionInfo,
  type FlowaDriveRun,
  type ShopOption,
  sources,
} from "./drive-sync/types";

export type { FlowaDriveRun, DriveConnectionInfo, ShopOption };

export function FlowaDriveSync({
  connection,
  runs,
  shops,
  targetFileName,
}: {
  connection: DriveConnectionInfo | null;
  runs: FlowaDriveRun[];
  shops: ShopOption[];
  targetFileName?: string | null;
}) {
  const router = useRouter();
  const [fastwayLoading, setFastwayLoading] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [selectedSources, setSelectedSources] = useState<string[]>([
    ...sources,
  ]);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [fastwayModalOpen, setFastwayModalOpen] = useState(false);

  const currentDate = new Date(Date.now() + 7 * 60 * 60 * 1_000)
    .toISOString()
    .slice(0, 10);
  const [rangeType, setRangeType] = useState<"month" | "month-range" | "date">(
    "month",
  );
  const [month, setMonth] = useState("2026-08");
  const [fromMonth, setFromMonth] = useState("2026-07");
  const [toMonth, setToMonth] = useState("2026-08");
  const [fromDate, setFromDate] = useState("2026-08-01");
  const [toDate, setToDate] = useState(currentDate);

  const toggleSource = (source: string) => {
    setSelectedSources((prev) =>
      prev.includes(source)
        ? prev.filter((item) => item !== source)
        : [...prev, source],
    );
  };

  const handleFastwaySync = async (
    mode: FastwaySyncMode,
    customFrom?: string,
    customTo?: string,
  ) => {
    setFastwayLoading(true);
    setError(null);
    setSuccess(null);
    try {
      let options:
        | { fromDate?: string | Date; toDate?: string | Date }
        | undefined;

      if (mode === "current") {
        if (rangeType === "month") {
          const r = vietnamMonthRange(month);
          options = { fromDate: r.from, toDate: new Date(r.to.getTime() - 1) };
        } else if (rangeType === "month-range") {
          const rFrom = vietnamMonthRange(fromMonth);
          const rTo = vietnamMonthRange(toMonth);
          options = {
            fromDate: rFrom.from,
            toDate: new Date(rTo.to.getTime() - 1),
          };
        } else if (rangeType === "date") {
          options = { fromDate, toDate };
        }
      } else if (mode === "custom") {
        if (!customFrom || !customTo) {
          throw new Error("Vui lòng chọn đầy đủ Từ ngày và Đến ngày.");
        }
        options = { fromDate: customFrom, toDate: customTo };
      }

      const res = await syncFastwayAction(options);
      if (!res.success) {
        throw new Error(res.error || "Đồng bộ Fastway thất bại.");
      }

      const countMsg = `${res.data?.totalFetched ?? 0} đơn hàng Fastway (${res.data?.upserted ?? 0} bản ghi cập nhật vào COGS DB)`;
      const formatBound = (val: string | Date | undefined) =>
        val instanceof Date ? val.toISOString().slice(0, 10) : val;
      const rangeMsg =
        mode === "all"
          ? "toàn bộ lịch sử"
          : `từ ${formatBound(options?.fromDate)} đến ${formatBound(options?.toDate)}`;

      setSuccess(`Đã kéo thành công ${countMsg} [${rangeMsg}]!`);
      setFastwayModalOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setFastwayLoading(false);
    }
  };

  const handleClearReport = async () => {
    if (
      !confirm(
        "Bạn có chắc muốn xóa toàn bộ dữ liệu bắt đầu từ dòng 2 trên các sheet đã chọn?",
      )
    ) {
      return;
    }
    setClearing(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/flowa/drive/clear-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sources: selectedSources }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Xóa dữ liệu sheet thất bại.");
      }
      setSuccess("Đã xóa dữ liệu thành công từ dòng 2.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setClearing(false);
    }
  };

  const handleClearHistory = async () => {
    if (
      !confirm("Bạn có chắc muốn xóa toàn bộ lịch sử các phiên đồng bộ Flowa?")
    ) {
      return;
    }
    setClearingHistory(true);
    setError(null);
    try {
      const response = await fetch("/api/flowa/drive/clear-history", {
        method: "DELETE",
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Không thể xóa lịch sử.");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Đã có lỗi xảy ra.");
    } finally {
      setClearingHistory(false);
    }
  };

  return (
    <div className="flex-1 space-y-6 p-4 sm:p-6 max-w-[1400px] mx-auto w-full">
      {/* Target Destination Card with Fastway Dialog slot */}
      <FlTargetCard
        connection={connection}
        targetFileName={targetFileName}
        shops={shops}
        importModalOpen={importModalOpen}
        onImportModalOpenChange={setImportModalOpen}
        fastwayDialogSlot={
          <FlFastwayDialog
            open={fastwayModalOpen}
            onOpenChange={setFastwayModalOpen}
            loading={fastwayLoading}
            onSync={handleFastwaySync}
            rangeType={rangeType}
            month={month}
            fromMonth={fromMonth}
            toMonth={toMonth}
            fromDate={fromDate}
            toDate={toDate}
            defaultDate={currentDate}
          />
        }
      />

      {/* Notifications */}
      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive font-medium shadow-2xs">
          <InfoIcon className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-800 dark:text-emerald-300 font-medium shadow-2xs">
          <CheckIcon className="size-4 shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* Control & Configuration Section */}
      <FlSyncConfigCard
        selectedSources={selectedSources}
        onToggleSource={toggleSource}
        rangeType={rangeType}
        onRangeTypeChange={setRangeType}
        month={month}
        onMonthChange={setMonth}
        fromMonth={fromMonth}
        onFromMonthChange={setFromMonth}
        toMonth={toMonth}
        onToMonthChange={setToMonth}
        fromDate={fromDate}
        onFromDateChange={setFromDate}
        toDate={toDate}
        onToDateChange={setToDate}
        clearing={clearing}
        onClearReport={handleClearReport}
      />

      {/* Sync History Table */}
      <FlSyncHistoryTable
        runs={runs}
        clearingHistory={clearingHistory}
        onClearHistory={handleClearHistory}
      />
    </div>
  );
}
