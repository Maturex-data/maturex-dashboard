"use client";

import { CalendarDaysIcon, LandmarkIcon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

function currentVietnamMonth(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .replace("/", "-");
}

export function EcShopifyPayoutSyncCard({ connected }: { connected: boolean }) {
  const [month, setMonth] = useState(currentVietnamMonth);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncMonth(): Promise<void> {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/ec/drive/shopify-payouts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const payload = (await response.json()) as {
        error?: string;
        rowsWritten?: number;
      };
      if (!response.ok) {
        throw new Error(payload.error || "Không thể đồng bộ payouts Shopify.");
      }
      setMessage(
        `Đã đồng bộ ${payload.rowsWritten ?? 0} payout cho tháng ${month}.`,
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Không thể đồng bộ payouts Shopify.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SectionCard
      icon={<LandmarkIcon className="size-3.5 stroke-[2.2]" />}
      title="Shopify Payouts → Store — Deerlys"
      description="Lấy trực tiếp từ Shopify và cập nhật Phần 2 trong file dòng tiền store."
      action={
        <Badge
          variant="outline"
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          Shopify API
        </Badge>
      }
      contentClassName="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
    >
      <div className="max-w-xl space-y-1.5">
        <Label htmlFor="shopify-payout-month" className="text-xs font-semibold">
          Tháng payout
        </Label>
        <div className="flex items-center gap-2">
          <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            id="shopify-payout-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            disabled={syncing}
            className="h-9 w-44"
          />
          <span className="text-xs text-muted-foreground">
            Lọc theo ngày payout; tháng khác được giữ nguyên.
          </span>
        </div>
        {(message || error) && (
          <p
            role={error ? "alert" : "status"}
            className={`pt-1 text-xs ${error ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}
          >
            {error || message}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        onClick={syncMonth}
        disabled={!connected || !month || syncing}
        className="h-9 shrink-0 gap-2 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <RefreshCwIcon
          className={`size-3.5 ${syncing ? "animate-spin" : ""}`}
        />
        {syncing ? "Đang đồng bộ…" : "Đồng bộ tháng"}
      </Button>
    </SectionCard>
  );
}
