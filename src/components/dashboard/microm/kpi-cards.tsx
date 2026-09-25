"use client";

import {
  ArrowUpRightIcon,
  MegaphoneIcon,
  PackageIcon,
  ShoppingBagIcon,
  TrendingDownIcon,
  TrendingUpIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { MicromKpiMetrics } from "@/lib/microm/dashboard-queries";
import {
  formatCurrency,
  formatNumber,
  formatPercent,
  safeNumber,
} from "@/lib/microm/formatters";

interface MicromKpiCardsProps {
  kpi: MicromKpiMetrics;
  selectedTab?: string;
  onSelectTab?: (tab: string) => void;
}

export function MicromKpiCards({
  kpi,
  selectedTab,
  onSelectTab,
}: MicromKpiCardsProps) {
  const rev = safeNumber(kpi?.eligibleRevenueUsd);
  const cogs = safeNumber(kpi?.eligibleCogsUsd);
  const ads = safeNumber(kpi?.metaSpendUsd);
  const contribution = safeNumber(kpi?.estimatedContributionUsd);
  const ordersCount = safeNumber(kpi?.eligibleOrdersCount);

  const hasAnyData = kpi?.hasShopifyData || kpi?.hasCogsData || kpi?.hasAdsData;
  const contributionMargin = rev > 0 ? (contribution / rev) * 100 : 0;
  const roas = ads > 0 ? rev / ads : 0;
  const aov = ordersCount > 0 ? rev / ordersCount : 0;
  const cogsPercent = rev > 0 ? (cogs / rev) * 100 : 0;
  const isPositive = contribution >= 0;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3 sm:gap-4">
      {/* 1. Hero KPI: Estimated Contribution (Spans 4 columns on lg) */}
      <Card
        className={`lg:col-span-4 relative overflow-hidden transition-all duration-200 border ${
          isPositive
            ? "border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 via-background to-background"
            : "border-rose-500/30 bg-gradient-to-br from-rose-950/20 via-background to-background"
        }`}
      >
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Ước tính đóng góp
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-mono ${
                  !hasAnyData
                    ? "bg-muted text-muted-foreground border-border"
                    : isPositive
                      ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                      : "bg-rose-500/10 text-rose-400 border-rose-500/20"
                }`}
              >
                {hasAnyData && rev > 0
                  ? `${formatPercent(contributionMargin)} Margin`
                  : "Margin —"}
              </Badge>
            </div>
            <div
              className={`size-8 rounded-lg flex items-center justify-center ${
                !hasAnyData
                  ? "bg-muted text-muted-foreground"
                  : isPositive
                    ? "bg-emerald-500/10 text-emerald-400"
                    : "bg-rose-500/10 text-rose-400"
              }`}
            >
              {isPositive ? (
                <TrendingUpIcon className="size-4" />
              ) : (
                <TrendingDownIcon className="size-4" />
              )}
            </div>
          </div>

          <div className="my-4">
            <div className="text-3xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {hasAnyData ? formatCurrency(contribution, "$") : "—"}
            </div>
            <p className="text-[11px] text-muted-foreground mt-1">
              Doanh thu HL - Giá vốn POD - Chi phí Meta Ads
            </p>
          </div>

          <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] block">
                Tổng chi phí biến đổi
              </span>
              <span className="font-mono font-medium text-foreground">
                {hasAnyData ? formatCurrency(cogs + ads, "$") : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">
                Tỷ suất đóng góp
              </span>
              <span
                className={`font-mono font-medium ${!hasAnyData ? "text-muted-foreground" : isPositive ? "text-emerald-400" : "text-rose-400"}`}
              >
                {hasAnyData && rev > 0
                  ? formatPercent(contributionMargin)
                  : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Eligible Revenue (Spans 4 columns on lg) */}
      <Card
        className={`lg:col-span-4 cursor-pointer transition-all duration-200 hover:border-primary/50 ${
          selectedTab === "Orders"
            ? "border-primary/60 ring-1 ring-primary/20 bg-muted/20"
            : ""
        }`}
        onClick={() => onSelectTab?.("Orders")}
      >
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Doanh thu hợp lệ
              </span>
              <ArrowUpRightIcon className="size-3 text-muted-foreground/60" />
            </div>
            <Badge
              variant="outline"
              className="text-[10px] px-1.5 py-0 font-mono"
            >
              FX 1.15
            </Badge>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {kpi?.hasShopifyData ? formatCurrency(rev, "$") : "—"}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
              <span className="font-mono text-emerald-400 font-medium">
                {kpi?.hasShopifyData
                  ? formatCurrency(kpi?.eligibleRevenueEur, "€")
                  : "—"}
              </span>
              <span className="text-muted-foreground/60">
                {kpi?.hasShopifyData ? "gốc EUR" : "Chưa có dữ liệu"}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-[11px]">
              AOV (Giá trị ĐH TB)
            </span>
            <span className="font-mono font-medium text-foreground">
              {kpi?.hasShopifyData && aov > 0 ? formatCurrency(aov, "$") : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 3. Orders Count (Spans 4 columns on lg) */}
      <Card
        className={`lg:col-span-4 cursor-pointer transition-all duration-200 hover:border-primary/50 ${
          selectedTab === "Orders"
            ? "border-primary/60 ring-1 ring-primary/20 bg-muted/20"
            : ""
        }`}
        onClick={() => onSelectTab?.("Orders")}
      >
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Đơn hàng hợp lệ
            </span>
            <div className="size-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <ShoppingBagIcon className="size-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums text-foreground">
                {kpi?.hasShopifyData ? formatNumber(ordersCount) : "—"}
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                /{" "}
                {kpi?.hasShopifyData
                  ? `${formatNumber(kpi?.totalOrdersCount)} tổng đơn`
                  : "— tổng đơn"}
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1 truncate">
              {kpi?.hasShopifyData
                ? "Đã loại trừ đơn voided & cancelled"
                : "Chưa có dữ liệu đơn Shopify"}
            </p>
          </div>

          <div className="pt-3 border-t border-border/40 flex items-center justify-between text-xs">
            <span className="text-muted-foreground text-[11px]">
              Tỷ lệ duyệt đơn
            </span>
            <span className="font-mono font-medium text-emerald-400">
              {kpi?.hasShopifyData && kpi?.totalOrdersCount
                ? formatPercent((ordersCount / kpi.totalOrdersCount) * 100)
                : "—"}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* 4. Meta Ads Spend (Spans 6 columns on lg) */}
      <Card
        className={`lg:col-span-6 cursor-pointer transition-all duration-200 hover:border-sky-500/50 ${
          selectedTab === "Ads"
            ? "border-sky-500/60 ring-1 ring-sky-500/20 bg-muted/20"
            : ""
        }`}
        onClick={() => onSelectTab?.("Ads")}
      >
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Chi phí Meta Ads
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-mono ${
                  kpi?.hasAdsData && ads > 0
                    ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {kpi?.hasAdsData && ads > 0
                  ? `ROAS ${roas.toFixed(2)}x`
                  : "ROAS —"}
              </Badge>
            </div>
            <div className="size-8 rounded-lg bg-sky-500/10 text-sky-400 flex items-center justify-center">
              <MegaphoneIcon className="size-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {kpi?.hasAdsData ? formatCurrency(ads, "$") : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {kpi?.hasAdsData
                ? `${formatNumber(kpi?.metaClicks)} clicks · ${formatNumber(kpi?.metaPurchases)} purchases`
                : "Chưa có dữ liệu Meta Ads"}
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] block">
                Lượt hiển thị
              </span>
              <span className="font-mono font-medium text-foreground">
                {kpi?.hasAdsData ? formatNumber(kpi?.metaImpressions) : "—"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">
                Ads % Doanh thu
              </span>
              <span className="font-mono font-medium text-sky-400">
                {kpi?.hasAdsData && rev > 0
                  ? formatPercent((ads / rev) * 100)
                  : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 5. PGPrint COGS (Spans 6 columns on lg) */}
      <Card
        className={`lg:col-span-6 cursor-pointer transition-all duration-200 hover:border-amber-500/50 ${
          selectedTab === "COGS"
            ? "border-amber-500/60 ring-1 ring-amber-500/20 bg-muted/20"
            : ""
        }`}
        onClick={() => onSelectTab?.("COGS")}
      >
        <CardContent className="p-5 flex flex-col justify-between h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Giá vốn POD (PGPrint)
              </span>
              <Badge
                variant="outline"
                className={`text-[10px] px-1.5 py-0 font-mono ${
                  kpi?.hasCogsData
                    ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                    : "bg-muted text-muted-foreground border-border"
                }`}
              >
                {kpi?.hasCogsData
                  ? `COGS ${formatPercent(cogsPercent)}`
                  : "COGS —"}
              </Badge>
            </div>
            <div className="size-8 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
              <PackageIcon className="size-4" />
            </div>
          </div>

          <div className="my-3">
            <div className="text-2xl sm:text-3xl font-bold tracking-tight font-mono tabular-nums text-foreground">
              {kpi?.hasCogsData ? formatCurrency(cogs, "$") : "—"}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              {kpi?.hasCogsData
                ? `Nguồn PGPrint: ${formatCurrency(kpi?.totalCogsSourceUsd, "$")}`
                : "Chưa có dữ liệu PGPrint"}
            </div>
          </div>

          <div className="pt-3 border-t border-border/40 grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-muted-foreground text-[10px] block">
                Trạng thái
              </span>
              <span
                className={`font-mono font-medium ${kpi?.hasCogsData ? "text-emerald-400" : "text-muted-foreground"}`}
              >
                {kpi?.hasCogsData ? "Đã đối soát Sheet" : "Chưa có dữ liệu"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground text-[10px] block">
                COGS % Doanh thu
              </span>
              <span className="font-mono font-medium text-amber-400">
                {kpi?.hasCogsData && rev > 0 ? formatPercent(cogsPercent) : "—"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
