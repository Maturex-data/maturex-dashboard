"use client";

import {
  CalendarDaysIcon,
  ExternalLinkIcon,
  LandmarkIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useState } from "react";
import { SectionCard } from "@/components/shared/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const RAW_BANK_URL =
  "https://docs.google.com/spreadsheets/d/1HACGNDMqlvS6f1UI59_DFrfG9tWCD0Jnhlara0k67RU/edit?gid=373655258#gid=373655258";

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

export function EcAirwallexBankSyncCard({ connected }: { connected: boolean }) {
  const [scope, setScope] = useState<"all" | "month">("month");
  const [month, setMonth] = useState(currentVietnamMonth);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const scopeLabel = scope === "all" ? "tất cả từ 01/2026" : `tháng ${month}`;

  async function sync(): Promise<void> {
    setSyncing(true);
    setMessage(null);
    setError(null);
    try {
      const response = await fetch("/api/ec/drive/airwallex-bank", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ selection: scope === "all" ? "all" : month }),
      });
      const payload = (await response.json()) as {
        error?: string;
        fetched?: number;
        added?: number;
        updated?: number;
        unchanged?: number;
        replacedShopify?: number;
      };
      if (!response.ok)
        throw new Error(payload.error || "Không thể đồng bộ Airwallex.");
      const replacement = payload.replacedShopify
        ? ` Đã thay ${payload.replacedShopify} dòng Shopify đặt nhầm.`
        : "";
      setMessage(
        `Airwallex (${scopeLabel}): ${payload.fetched ?? 0} giao dịch; thêm ${payload.added ?? 0}, cập nhật ${payload.updated ?? 0}, không đổi ${payload.unchanged ?? 0}.${replacement}`,
      );
    } catch (syncError) {
      setError(
        syncError instanceof Error
          ? syncError.message
          : "Không thể đồng bộ Airwallex.",
      );
    } finally {
      setSyncing(false);
    }
  }

  return (
    <SectionCard
      icon={<LandmarkIcon className="size-3.5 stroke-[2.2]" />}
      title="Airwallex → RAW ngân hàng"
      description="Giao dịch đã ghi sổ và số dư ví cash từ Airwallex API."
      action={
        <Badge
          variant="outline"
          className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          Airwallex API
        </Badge>
      }
      contentClassName="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      footer={
        <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Đối chiếu ID giao dịch với lịch sử số dư. Dự án, store và mã chuyển
            nội bộ để trống khi chưa có mapping.
          </p>
          <a
            href={RAW_BANK_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-emerald-700 hover:underline dark:text-emerald-300"
          >
            Mở RAW ngân hàng <ExternalLinkIcon className="size-3.5" />
          </a>
        </div>
      }
    >
      <div className="max-w-xl space-y-2">
        <fieldset className="flex items-center gap-2">
          <legend className="sr-only">Phạm vi đồng bộ Airwallex</legend>
          <Button
            type="button"
            size="sm"
            variant={scope === "month" ? "default" : "outline"}
            onClick={() => setScope("month")}
            disabled={syncing}
          >
            Theo tháng
          </Button>
          <Button
            type="button"
            size="sm"
            variant={scope === "all" ? "default" : "outline"}
            onClick={() => setScope("all")}
            disabled={syncing}
          >
            Tất cả từ 01/2026
          </Button>
        </fieldset>
        <p className="text-xs text-muted-foreground">
          Đang chọn:{" "}
          <span className="font-medium text-foreground">
            {scope === "all"
              ? "Tất cả từ 01/2026"
              : `Tháng ${month} (theo giờ Việt Nam)`}
          </span>
        </p>
        {scope === "month" && (
          <div className="space-y-1.5">
            <Label
              htmlFor="airwallex-bank-month"
              className="text-xs font-semibold"
            >
              Tháng ghi sổ
            </Label>
            <div className="flex items-center gap-2">
              <CalendarDaysIcon className="size-4 text-muted-foreground" />
              <Input
                id="airwallex-bank-month"
                type="month"
                min="2026-01"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                disabled={syncing}
                className="h-9 w-44"
              />
            </div>
          </div>
        )}
        {(message || error) && (
          <p
            role={error ? "alert" : "status"}
            className={`text-xs ${error ? "text-destructive" : "text-emerald-700 dark:text-emerald-300"}`}
          >
            {error || message}
          </p>
        )}
      </div>
      <Button
        type="button"
        size="sm"
        onClick={sync}
        disabled={!connected || syncing || (scope === "month" && !month)}
        className="h-9 shrink-0 gap-2 bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700"
      >
        <RefreshCwIcon
          className={`size-3.5 ${syncing ? "animate-spin" : ""}`}
        />
        {syncing ? `Đang đồng bộ ${scopeLabel}…` : "Đồng bộ"}
      </Button>
    </SectionCard>
  );
}
