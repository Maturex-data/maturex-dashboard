"use client";

import {
  CalendarDaysIcon,
  ExternalLinkIcon,
  RefreshCwIcon,
  Rows3Icon,
} from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RAW_SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU/edit?gid=366069407#gid=366069407";

function currentVietnamMonth(): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
    })
      .formatToParts(new Date())
      .map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}`;
}

export function EcShopifyRawSyncCard({ connected }: { connected: boolean }) {
  const [month, setMonth] = useState(currentVietnamMonth);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function syncMonth(): Promise<void> {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/ec/drive/shopify-raw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month }),
      });
      const payload = (await response.json()) as {
        error?: string;
        rowsWritten?: number;
        replacedRows?: number;
      };
      if (!response.ok) {
        throw new Error(
          payload.error || "Không thể đồng bộ Shopify lên RAW sàn.",
        );
      }
      setMessage(
        `Đã cập nhật ${payload.rowsWritten ?? 0} giao dịch tháng ${month}; thay ${payload.replacedRows ?? 0} dòng cũ.`,
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Không thể đồng bộ Shopify lên RAW sàn.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SectionCard
      icon={<Rows3Icon className="size-3.5 stroke-[2.2]" />}
      title="Shopify → RAW sàn"
      description="Đồng bộ giao dịch Shopify Payments vào tab RAW sàn."
      action={
        <Badge
          variant="outline"
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          Shopify API
        </Badge>
      }
      contentClassName="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Chỉ thay dữ liệu của tháng đã chọn; các tháng khác được giữ nguyên.
          </p>
          <a
            href={RAW_SHEET_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Mở tab RAW sàn <ExternalLinkIcon className="size-3.5" />
          </a>
        </div>
      }
    >
      <div className="max-w-xl space-y-1.5">
        <Label htmlFor="shopify-raw-month" className="text-xs font-semibold">
          Tháng giao dịch
        </Label>
        <div className="flex flex-wrap items-center gap-2">
          <CalendarDaysIcon className="size-4 shrink-0 text-muted-foreground" />
          <Input
            id="shopify-raw-month"
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
            disabled={syncing}
            className="h-9 w-44"
          />
          <span className="text-xs text-muted-foreground">
            Lọc theo ngày giao dịch Việt Nam.
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
