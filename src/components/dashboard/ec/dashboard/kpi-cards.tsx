"use client";

import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  DollarSignIcon,
  LayersIcon,
  MegaphoneIcon,
  PackageIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
} from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import type { DashboardSummary } from "@/lib/ec/dashboard/types";

interface KpiCardsProps {
  summary: DashboardSummary;
  onSelectTab?: (tab: string) => void;
}

function AnimatedNumber({
  value,
  prefix = "",
  suffix = "",
  decimals = 0,
  duration = 1000,
}: {
  value: number;
  prefix?: string;
  suffix?: string;
  decimals?: number;
  duration?: number;
}) {
  const [displayValue, setDisplayValue] = React.useState(value);
  const mountedRef = React.useRef(false);
  const currentValRef = React.useRef(0);

  React.useEffect(() => {
    let animFrame: number;
    let startTime: number | null = null;

    const start = mountedRef.current ? currentValRef.current : 0;
    const end = value;
    mountedRef.current = true;

    // Organic ease-out cubic
    const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

    const step = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);
      const current = start + (end - start) * eased;

      currentValRef.current = current;
      setDisplayValue(current);

      if (progress < 1) {
        animFrame = requestAnimationFrame(step);
      } else {
        currentValRef.current = end;
        setDisplayValue(end);
      }
    };

    animFrame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(animFrame);
  }, [value, duration]);

  return (
    <span>
      {prefix}
      {displayValue.toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
      })}
      {suffix}
    </span>
  );
}

function DiffBadge({ diff }: { diff: number | null }) {
  if (diff === null) return null;
  const isPositive = diff >= 0;
  return (
    <span
      className={`inline-flex items-center gap-0.5 text-[11px] font-mono font-medium ${
        isPositive
          ? "text-emerald-600 dark:text-emerald-400"
          : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {isPositive ? (
        <ArrowUpRightIcon className="size-3" />
      ) : (
        <ArrowDownRightIcon className="size-3" />
      )}
      {isPositive ? `+${diff}%` : `${diff}%`}
    </span>
  );
}

interface MetricCardProps {
  title: string;
  titleIcon: React.ReactNode;
  cornerIcon: React.ReactNode;
  badge?: string;
  badgeClass?: string;
  hoverBorder: string;
  onClick?: () => void;
  value: number;
  prefix?: string;
  decimals?: number;
  diffPercent: number | null;
  subLabel: string;
  subLabelTitle?: string;
  subContent: React.ReactNode;
}

function MetricCard({
  title,
  titleIcon,
  cornerIcon,
  badge,
  badgeClass,
  hoverBorder,
  onClick,
  value,
  prefix = "",
  decimals = 0,
  diffPercent,
  subLabel,
  subLabelTitle,
  subContent,
}: MetricCardProps) {
  return (
    <Card
      onClick={onClick}
      className={`border-border/60 bg-card/60 backdrop-blur-xs shadow-xs transition-colors group ${hoverBorder} ${
        onClick ? "cursor-pointer" : ""
      }`}
    >
      <CardContent className="p-4 sm:p-5 flex flex-col justify-between h-full space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors flex items-center gap-1.5">
            {titleIcon}
            {title}
            {badge && (
              <Badge
                variant="outline"
                className={`text-[9px] px-1 py-0 font-mono ${badgeClass || ""}`}
              >
                {badge}
              </Badge>
            )}
          </span>
          {cornerIcon}
        </div>

        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold font-mono tracking-tight text-foreground">
              <AnimatedNumber
                value={value}
                prefix={prefix}
                decimals={decimals}
              />
            </span>
            <DiffBadge diff={diffPercent} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span title={subLabelTitle}>{subLabel}</span>
            <span className="font-mono font-medium text-foreground">
              {subContent}
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function KpiCards({ summary, onSelectTab }: KpiCardsProps) {
  const { ordersMetric, netRevenueMetric, adSpendMetric, grossProfitMetric } =
    summary;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {/* 1. TỔNG ĐƠN HÀNG */}
      <MetricCard
        title="Tổng Đơn Hàng"
        titleIcon={<ShoppingBagIcon className="size-3.5 text-emerald-500" />}
        cornerIcon={
          <div className="size-7 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <PackageIcon className="size-3.5" />
          </div>
        }
        hoverBorder="hover:border-emerald-500/40"
        onClick={() => onSelectTab?.("orders")}
        value={ordersMetric.count}
        decimals={0}
        diffPercent={ordersMetric.diffPercent}
        subLabel="Tỷ lệ hoàn tiền:"
        subContent={
          <>
            <AnimatedNumber
              value={ordersMetric.refundIncidenceRate}
              decimals={1}
              suffix="%"
            />{" "}
            (
            <AnimatedNumber
              value={ordersMetric.refundCount}
              decimals={0}
              suffix=" đơn"
            />
            )
          </>
        }
      />

      {/* 2. DOANH THU THUẦN */}
      <MetricCard
        title="Doanh Thu Thuần"
        titleIcon={<DollarSignIcon className="size-3.5 text-sky-500" />}
        cornerIcon={
          <div className="size-7 rounded-lg bg-sky-500/10 flex items-center justify-center text-sky-600 dark:text-sky-400">
            <TrendingUpIcon className="size-3.5" />
          </div>
        }
        badge="calc"
        badgeClass="text-sky-600 border-sky-500/30 bg-sky-500/10"
        hoverBorder="hover:border-sky-500/40"
        value={netRevenueMetric.netRevenue}
        prefix="$"
        decimals={2}
        diffPercent={netRevenueMetric.diffPercent}
        subLabel="AOV thuần:"
        subLabelTitle={`Gross sales: $${netRevenueMetric.grossSales.toLocaleString(
          "en-US",
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          },
        )} | Tax: $${netRevenueMetric.originalTax.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`}
        subContent={
          <AnimatedNumber
            value={netRevenueMetric.aov}
            prefix="$"
            decimals={2}
          />
        }
      />

      {/* 3. CHI PHÍ ADS */}
      <MetricCard
        title="Chi Phí Ads"
        titleIcon={<MegaphoneIcon className="size-3.5 text-violet-500" />}
        cornerIcon={
          <div className="size-7 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-600 dark:text-violet-400">
            <MegaphoneIcon className="size-3.5" />
          </div>
        }
        hoverBorder="hover:border-violet-500/40"
        onClick={() => onSelectTab?.("ads")}
        value={adSpendMetric.spend}
        prefix="$"
        decimals={2}
        diffPercent={adSpendMetric.diffPercent}
        subLabel="Hệ số MER:"
        subContent={
          adSpendMetric.mer !== null ? (
            <AnimatedNumber value={adSpendMetric.mer} decimals={2} suffix="x" />
          ) : (
            "—"
          )
        }
      />

      {/* 4. LÃI GỘP SAU COGS */}
      <MetricCard
        title="Lãi Gộp Sau COGS"
        titleIcon={<LayersIcon className="size-3.5 text-amber-500" />}
        cornerIcon={
          <div className="size-7 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <LayersIcon className="size-3.5" />
          </div>
        }
        badge="calc"
        badgeClass="text-amber-600 border-amber-500/30 bg-amber-500/10"
        hoverBorder="hover:border-amber-500/40"
        onClick={() => onSelectTab?.("cogs")}
        value={grossProfitMetric.profit}
        prefix="$"
        decimals={2}
        diffPercent={grossProfitMetric.diffPercent}
        subLabel="Biên lãi gộp:"
        subContent={
          <AnimatedNumber
            value={grossProfitMetric.grossMargin}
            decimals={1}
            suffix="%"
          />
        }
      />
    </div>
  );
}
