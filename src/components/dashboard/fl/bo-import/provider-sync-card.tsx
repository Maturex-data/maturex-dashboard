"use client";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCw,
  Truck,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { vietnamMonthRange } from "@/lib/date-time";
import type { PrintifySyncOptions } from "@/lib/fl/printify/types";

interface ProviderSyncCardProps {
  provider: string;
  description: string;
  note: string;
  destinationUrl: string;
  sync: (options?: PrintifySyncOptions) => Promise<{
    success: boolean;
    error?: string;
    data?: {
      totalFetched: number;
      selectedCount?: number;
      insertedCount: number;
      updatedCount: number;
      skippedCount: number;
      missingStoreCount?: number;
    };
  }>;
}
export function ProviderSyncCard({
  provider,
  description,
  note,
  destinationUrl,
  sync,
}: ProviderSyncCardProps) {
  const today = new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10);
  const [mode, setMode] = useState("month"),
    [month, setMonth] = useState(today.slice(0, 7));
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`),
    [to, setTo] = useState(today);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function run() {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      let options: PrintifySyncOptions | undefined;
      if (mode === "month") {
        if (!/^\d{4}-\d{2}$/.test(month)) throw Error("Chọn tháng hợp lệ.");
        const range = vietnamMonthRange(month);
        options = {
          fromDate: range.from.toISOString(),
          toDate: new Date(range.to.getTime() - 1).toISOString(),
        };
      } else if (mode === "date") {
        if (!from || !to || from > to) throw Error("Khoảng ngày không hợp lệ.");
        options = {
          fromDate: new Date(`${from}T00:00:00+07:00`).toISOString(),
          toDate: new Date(`${to}T23:59:59.999+07:00`).toISOString(),
        };
      }
      const r = await sync(options);
      if (!r.success) throw Error(r.error);
      const d = r.data;
      setMessage(
        `Đã đọc ${d?.totalFetched ?? 0} đơn · Thêm ${d?.insertedCount ?? 0} · Cập nhật ${d?.updatedCount ?? 0} · Bỏ qua ${d?.skippedCount ?? 0}${d?.selectedCount !== undefined ? ` · Trong phạm vi ${d.selectedCount}` : ` · Chưa có Store ${d?.missingStoreCount ?? 0}`}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Đồng bộ thất bại.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <Card className="gap-0 rounded-2xl py-0 shadow-sm ring-border/70">
      <CardContent className="grid px-0 lg:grid-cols-[minmax(240px,0.8fr)_minmax(0,1.6fr)]">
        <div className="flex flex-col justify-between gap-8 border-b border-border/70 bg-muted/30 p-6 lg:border-r lg:border-b-0 lg:p-7">
          <div>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-xl bg-emerald-600 text-white">
                <Truck className="size-5" aria-hidden="true" />
              </div>
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  ĐỒNG BỘ NHÀ CUNG CẤP
                </p>
                <CardTitle className="mt-1 text-xl tracking-tight">
                  {provider}
                </CardTitle>
              </div>
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          </div>
          <div className="space-y-3">
            <a
              className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background px-3.5 py-3 text-sm font-medium transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-ring"
              href={destinationUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span>
                <span className="mr-2 text-muted-foreground font-normal">
                  Đích
                </span>
                RAW.COGS
              </span>
              <ArrowUpRight
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </a>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {note}
            </p>
          </div>
        </div>
        <div className="space-y-5 p-6 lg:p-7" aria-busy={busy}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Phạm vi đồng bộ</h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" aria-hidden="true" />
              Giờ Việt Nam · UTC+7
            </span>
          </div>
          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (!busy && value) setMode(String(value));
            }}
          >
            <TabsList
              aria-label={`Phạm vi đồng bộ ${provider}`}
              className="w-full rounded-xl p-1 group-data-horizontal/tabs:h-11"
            >
              {[
                ["month", "Theo tháng"],
                ["date", "Khoảng ngày"],
                ["all", "Toàn bộ"],
              ].map(([value, label]) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  disabled={busy}
                  className="rounded-lg px-2 text-xs sm:text-sm data-active:text-emerald-700 dark:data-active:text-emerald-400"
                >
                  {label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <div className="min-h-23">
            {mode === "month" && (
              <div className="space-y-2">
                <Label
                  htmlFor={`${provider}-month`}
                  className="text-xs text-muted-foreground"
                >
                  Tháng đồng bộ
                </Label>
                <Input
                  id={`${provider}-month`}
                  type="month"
                  value={month}
                  disabled={busy}
                  onChange={(e) => setMonth(e.target.value)}
                  className="h-11 rounded-lg bg-background"
                />
              </div>
            )}
            {mode === "date" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label
                    htmlFor={`${provider}-from`}
                    className="text-xs text-muted-foreground"
                  >
                    Từ ngày
                  </Label>
                  <Input
                    id={`${provider}-from`}
                    type="date"
                    value={from}
                    disabled={busy}
                    onChange={(e) => setFrom(e.target.value)}
                    className="h-11 rounded-lg"
                  />
                </div>
                <div className="space-y-2">
                  <Label
                    htmlFor={`${provider}-to`}
                    className="text-xs text-muted-foreground"
                  >
                    Đến ngày
                  </Label>
                  <Input
                    id={`${provider}-to`}
                    type="date"
                    value={to}
                    disabled={busy}
                    onChange={(e) => setTo(e.target.value)}
                    className="h-11 rounded-lg"
                  />
                </div>
              </div>
            )}
            {mode === "all" && (
              <p className="rounded-lg bg-muted/50 px-4 py-3 text-sm leading-relaxed text-muted-foreground">
                Lấy tất cả đơn hàng {provider} hiện có, không giới hạn thời
                gian.
              </p>
            )}
          </div>
          <div className="flex flex-col gap-4 border-t border-border/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-xs text-xs leading-relaxed text-muted-foreground">
              Bỏ qua dòng không đổi, cập nhật chi phí mới khi đồng bộ lại.
            </p>
            <Button
              disabled={busy}
              onClick={() => void run()}
              className="h-11 shrink-0 gap-2 rounded-lg bg-emerald-600 px-5 text-white hover:bg-emerald-700"
            >
              {busy ? (
                <Loader2
                  className="size-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <RefreshCw className="size-4" aria-hidden="true" />
              )}
              {busy ? "Đang đồng bộ…" : `Đồng bộ ${provider}`}
            </Button>
          </div>
          {message && (
            <output
              className="flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm leading-relaxed text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
              aria-live="polite"
            >
              <CheckCircle2
                className="mt-0.5 size-4 shrink-0"
                aria-hidden="true"
              />
              {message}
            </output>
          )}
          {error && (
            <p
              role="alert"
              className="rounded-lg bg-destructive/10 p-3 text-sm leading-relaxed text-destructive"
            >
              {error}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
