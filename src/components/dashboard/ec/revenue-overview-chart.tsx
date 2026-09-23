"use client";

import * as React from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  type ChartConfig,
  ChartContainer,
  ChartTooltip,
} from "@/components/ui/chart";

export interface TrendItem {
  month: string;
  label: string;
  netRevenue: number;
  cogs: number;
  adSpend: number;
  isProvisional?: boolean;
}

interface RevenueOverviewChartProps {
  trendSeries?: TrendItem[];
}

const chartConfig = {
  netRevenue: {
    label: "Doanh thu thuần",
    color: "#10b981",
  },
  cogs: {
    label: "COGS ghi nhận",
    color: "#f59e0b",
  },
  adSpend: {
    label: "Chi phí Ads",
    color: "#8b5cf6",
  },
} satisfies ChartConfig;

function CustomChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: TrendItem }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const item = payload[0]?.payload;
  if (!item) return null;

  const rev = item.netRevenue;
  const cogs = item.cogs;
  const ads = item.adSpend;
  const grossProfit = rev - cogs;
  const grossMargin = rev > 0 ? ((grossProfit / rev) * 100).toFixed(1) : "0";

  return (
    <div className="grid min-w-52 items-start gap-1.5 rounded-lg border border-border/80 bg-background/95 p-3 text-xs shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5 gap-2">
        <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
          {label}
        </span>
        {item.isProvisional && (
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 font-mono text-amber-600 border-amber-500/30 bg-amber-500/10"
          >
            Tạm tính
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 text-xs pt-1">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: chartConfig.netRevenue.color }}
            />
            <span>{chartConfig.netRevenue.label}</span>
          </div>
          <span className="font-mono font-medium text-foreground">
            $
            {rev.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: chartConfig.cogs.color }}
            />
            <span>{chartConfig.cogs.label}</span>
          </div>
          <span className="font-mono font-medium text-foreground">
            $
            {cogs.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: chartConfig.adSpend.color }}
            />
            <span>{chartConfig.adSpend.label}</span>
          </div>
          <span className="font-mono font-medium text-foreground">
            $
            {ads.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 pt-2 border-t border-dashed border-border/70">
          <span className="text-muted-foreground font-medium">
            Lãi gộp sau COGS
          </span>
          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
            $
            {grossProfit.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-[11px] font-normal text-muted-foreground">
              ({grossMargin}%)
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

export function RevenueOverviewChart({
  trendSeries = [],
}: RevenueOverviewChartProps) {
  const avgNetRevenue = React.useMemo(() => {
    if (!trendSeries.length) return 0;
    const sum = trendSeries.reduce((acc, item) => acc + item.netRevenue, 0);
    return Math.round(sum / trendSeries.length);
  }, [trendSeries]);

  if (trendSeries.length === 0) {
    return (
      <Card className="col-span-1 lg:col-span-2 border-border/60 shadow-xs bg-card/60 backdrop-blur-xs flex flex-col justify-center items-center p-8 text-center text-muted-foreground text-xs min-h-[340px]">
        Chưa có dữ liệu từ Google Sheet. Vui lòng bấm "Đồng bộ từ Google Sheet"
        để tải dữ liệu.
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-2 border-border/60 shadow-xs relative overflow-hidden bg-card/60 backdrop-blur-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <CardTitle className="text-base font-semibold tracking-tight">
              Xu Hướng Tài Chính Theo Tháng
            </CardTitle>
            {avgNetRevenue > 0 && (
              <Badge
                variant="secondary"
                className="font-mono text-[10px] font-medium text-muted-foreground bg-muted/80 border border-border/40"
              >
                TB: ${(avgNetRevenue / 1000).toFixed(1)}k/tháng
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Đối chiếu Doanh thu thuần, COGS và Chi phí Ads từ Google Sheet
          </CardDescription>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3.5 text-xs">
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: chartConfig.netRevenue.color }}
            />
            <span className="text-muted-foreground font-medium text-[11px]">
              Doanh thu
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: chartConfig.cogs.color }}
            />
            <span className="text-muted-foreground font-medium text-[11px]">
              COGS
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: chartConfig.adSpend.color }}
            />
            <span className="text-muted-foreground font-medium text-[11px]">
              Ads
            </span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-1 pb-3">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[290px] w-full"
        >
          <BarChart
            accessibilityLayer
            data={trendSeries}
            margin={{ top: 16, right: 16, left: -10, bottom: 4 }}
            barGap={6}
          >
            <CartesianGrid vertical={false} strokeDasharray="3 3" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              className="font-mono text-muted-foreground text-[11px]"
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              className="font-mono text-muted-foreground text-[11px]"
              tickFormatter={(value: number) =>
                `$${(value / 1000).toFixed(0)}k`
              }
            />
            <ChartTooltip
              cursor={{ fill: "hsl(var(--muted) / 0.3)" }}
              content={<CustomChartTooltip />}
              animationDuration={150}
              animationEasing="ease-out"
            />
            <Bar
              dataKey="netRevenue"
              name={chartConfig.netRevenue.label}
              fill={chartConfig.netRevenue.color}
              radius={[5, 5, 0, 0]}
              barSize={20}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
              animationBegin={0}
            />
            <Bar
              dataKey="cogs"
              name={chartConfig.cogs.label}
              fill={chartConfig.cogs.color}
              radius={[5, 5, 0, 0]}
              barSize={20}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
              animationBegin={100}
            />
            <Bar
              dataKey="adSpend"
              name={chartConfig.adSpend.label}
              fill={chartConfig.adSpend.color}
              radius={[5, 5, 0, 0]}
              barSize={20}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
              animationBegin={200}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
