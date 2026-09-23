"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts";
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
    <div className="grid min-w-48 items-start gap-1.5 rounded-lg border border-border/60 bg-background/95 px-3 py-2 text-xs shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5 gap-2">
        <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
          {label}
        </span>
        {item.isProvisional && (
          <Badge
            variant="outline"
            className="text-[9px] px-1 py-0 font-mono text-amber-600 border-amber-500/30 bg-amber-500/10"
          >
            Tạm tính
          </Badge>
        )}
      </div>

      <div className="space-y-1.5 text-xs pt-0.5">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span
              className="size-2 rounded-[2px]"
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
              className="size-2 rounded-[2px]"
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
              className="size-2 rounded-[2px]"
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

        <div className="flex items-center justify-between gap-4 pt-1.5 border-t border-dashed border-border/60">
          <span className="text-muted-foreground font-medium">
            Lãi gộp sau COGS
          </span>
          <span className="font-mono font-semibold text-foreground">
            $
            {grossProfit.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            ({grossMargin}%)
          </span>
        </div>
      </div>
    </div>
  );
}

export function RevenueOverviewChart({
  trendSeries = [],
}: RevenueOverviewChartProps) {
  const [chartType, setChartType] = React.useState<"line" | "bar" | "combo">(
    "line",
  );

  const avgNetRevenue = React.useMemo(() => {
    if (!trendSeries.length) return 0;
    const sum = trendSeries.reduce((acc, item) => acc + item.netRevenue, 0);
    return Math.round(sum / trendSeries.length);
  }, [trendSeries]);

  if (trendSeries.length === 0) {
    return (
      <Card className="col-span-1 lg:col-span-2 border-border/60 shadow-xs bg-card/60 backdrop-blur-xs flex flex-col justify-center items-center p-8 text-center text-muted-foreground text-xs">
        Chưa có dữ liệu từ Google Sheet. Vui lòng bấm "Đồng bộ từ Google Sheet"
        để tải dữ liệu.
      </Card>
    );
  }

  return (
    <Card className="col-span-1 lg:col-span-2 border-border/60 shadow-xs relative overflow-hidden bg-card/60 backdrop-blur-xs">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 gap-3">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">
            Xu Hướng Tài Chính Theo Tháng
          </CardTitle>
          <CardDescription className="text-xs text-muted-foreground mt-0.5">
            Đối chiếu Doanh thu thuần, COGS và Chi phí Ads từ Google Sheet
          </CardDescription>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Chart Type Toggle using shadcn style */}
          <div className="flex items-center gap-0.5 bg-muted/70 p-0.5 rounded-lg border border-border/50 text-[11px]">
            <button
              type="button"
              onClick={() => setChartType("line")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                chartType === "line"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Đường
            </button>
            <button
              type="button"
              onClick={() => setChartType("bar")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                chartType === "bar"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Cột
            </button>
            <button
              type="button"
              onClick={() => setChartType("combo")}
              className={`px-2.5 py-1 rounded-md font-medium transition-all ${
                chartType === "combo"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Kết hợp
            </button>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: chartConfig.netRevenue.color }}
              />
              <span className="text-muted-foreground font-medium text-[11px]">
                {chartConfig.netRevenue.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: chartConfig.cogs.color }}
              />
              <span className="text-muted-foreground font-medium text-[11px]">
                {chartConfig.cogs.label}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-[2px]"
                style={{ backgroundColor: chartConfig.adSpend.color }}
              />
              <span className="text-muted-foreground font-medium text-[11px]">
                {chartConfig.adSpend.label}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-2">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[290px] w-full"
        >
          {chartType === "line" ? (
            <AreaChart
              accessibilityLayer
              data={trendSeries}
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fillNetRev" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-netRevenue)"
                    stopOpacity={0.25}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-netRevenue)"
                    stopOpacity={0.01}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="font-mono text-muted-foreground text-[11px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="font-mono text-muted-foreground text-[11px]"
                tickFormatter={(value: number) =>
                  `$${(value / 1000).toFixed(0)}k`
                }
              />
              <ChartTooltip
                cursor={false}
                content={<CustomChartTooltip />}
                animationDuration={200}
                animationEasing="ease-out"
              />
              {avgNetRevenue > 0 && (
                <ReferenceLine
                  y={avgNetRevenue}
                  stroke="var(--color-netRevenue)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  label={{
                    value: `TB: $${(avgNetRevenue / 1000).toFixed(1)}k`,
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
              )}
              <Area
                type="monotone"
                dataKey="netRevenue"
                name={chartConfig.netRevenue.label}
                fill="url(#fillNetRev)"
                stroke="var(--color-netRevenue)"
                strokeWidth={2.5}
                dot={{
                  fill: "var(--color-netRevenue)",
                  r: 4.5,
                  strokeWidth: 2,
                  stroke: "var(--background, #fff)",
                }}
                activeDot={{ r: 6.5, fill: "var(--color-netRevenue)" }}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="cogs"
                name={chartConfig.cogs.label}
                stroke="var(--color-cogs)"
                strokeWidth={2}
                dot={{
                  fill: "var(--color-cogs)",
                  r: 4,
                  strokeWidth: 2,
                  stroke: "var(--background, #fff)",
                }}
                activeDot={{ r: 6, fill: "var(--color-cogs)" }}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <Line
                type="monotone"
                dataKey="adSpend"
                name={chartConfig.adSpend.label}
                stroke="var(--color-adSpend)"
                strokeWidth={2}
                dot={{
                  fill: "var(--color-adSpend)",
                  r: 4,
                  strokeWidth: 2,
                  stroke: "var(--background, #fff)",
                }}
                activeDot={{ r: 6, fill: "var(--color-adSpend)" }}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </AreaChart>
          ) : chartType === "combo" ? (
            <ComposedChart
              accessibilityLayer
              data={trendSeries}
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
              barGap={4}
            >
              <defs>
                <linearGradient id="cogsGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-cogs)"
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-cogs)"
                    stopOpacity={0.65}
                  />
                </linearGradient>
                <linearGradient id="adSpendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-adSpend)"
                    stopOpacity={0.85}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-adSpend)"
                    stopOpacity={0.6}
                  />
                </linearGradient>
                <linearGradient id="comboNetRev" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor="var(--color-netRevenue)"
                    stopOpacity={0.15}
                  />
                  <stop
                    offset="95%"
                    stopColor="var(--color-netRevenue)"
                    stopOpacity={0.0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="font-mono text-muted-foreground text-[11px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="font-mono text-muted-foreground text-[11px]"
                tickFormatter={(value: number) =>
                  `$${(value / 1000).toFixed(0)}k`
                }
              />
              <ChartTooltip
                cursor={false}
                content={<CustomChartTooltip />}
                animationDuration={200}
                animationEasing="ease-out"
              />
              {avgNetRevenue > 0 && (
                <ReferenceLine
                  y={avgNetRevenue}
                  stroke="var(--color-netRevenue)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  label={{
                    value: `TB: $${(avgNetRevenue / 1000).toFixed(1)}k`,
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
              )}
              <Bar
                dataKey="cogs"
                name={chartConfig.cogs.label}
                fill="url(#cogsGrad)"
                radius={[4, 4, 0, 0]}
                barSize={18}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="adSpend"
                name={chartConfig.adSpend.label}
                fill="url(#adSpendGrad)"
                radius={[4, 4, 0, 0]}
                barSize={18}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
              <Area
                type="monotone"
                dataKey="netRevenue"
                name={chartConfig.netRevenue.label}
                fill="url(#comboNetRev)"
                stroke="var(--color-netRevenue)"
                strokeWidth={2.5}
                dot={{
                  fill: "var(--color-netRevenue)",
                  r: 5,
                  strokeWidth: 2,
                  stroke: "var(--background, #fff)",
                }}
                activeDot={{ r: 7, fill: "var(--color-netRevenue)" }}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
              />
            </ComposedChart>
          ) : (
            <BarChart
              accessibilityLayer
              data={trendSeries}
              margin={{ top: 12, right: 12, left: -10, bottom: 0 }}
              barGap={4}
            >
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-netRevenue)"
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-netRevenue)"
                    stopOpacity={0.7}
                  />
                </linearGradient>
                <linearGradient id="cogsGradBar" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-cogs)"
                    stopOpacity={0.9}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-cogs)"
                    stopOpacity={0.7}
                  />
                </linearGradient>
                <linearGradient id="adSpendGradBar" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="0%"
                    stopColor="var(--color-adSpend)"
                    stopOpacity={0.85}
                  />
                  <stop
                    offset="100%"
                    stopColor="var(--color-adSpend)"
                    stopOpacity={0.65}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="font-mono text-muted-foreground text-[11px]"
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                className="font-mono text-muted-foreground text-[11px]"
                tickFormatter={(value: number) =>
                  `$${(value / 1000).toFixed(0)}k`
                }
              />
              <ChartTooltip
                cursor={false}
                content={<CustomChartTooltip />}
                animationDuration={200}
                animationEasing="ease-out"
              />
              {avgNetRevenue > 0 && (
                <ReferenceLine
                  y={avgNetRevenue}
                  stroke="var(--color-netRevenue)"
                  strokeDasharray="4 4"
                  strokeWidth={1.5}
                  strokeOpacity={0.5}
                  label={{
                    value: `TB: $${(avgNetRevenue / 1000).toFixed(1)}k`,
                    fill: "hsl(var(--muted-foreground))",
                    fontSize: 10,
                    position: "insideTopLeft",
                  }}
                />
              )}
              <Bar
                dataKey="netRevenue"
                name={chartConfig.netRevenue.label}
                fill="url(#revenueGrad)"
                radius={[4, 4, 0, 0]}
                barSize={16}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
                animationBegin={0}
              />
              <Bar
                dataKey="cogs"
                name={chartConfig.cogs.label}
                fill="url(#cogsGradBar)"
                radius={[4, 4, 0, 0]}
                barSize={16}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
                animationBegin={120}
              />
              <Bar
                dataKey="adSpend"
                name={chartConfig.adSpend.label}
                fill="url(#adSpendGradBar)"
                radius={[4, 4, 0, 0]}
                barSize={16}
                isAnimationActive={true}
                animationDuration={900}
                animationEasing="ease-out"
                animationBegin={240}
              />
            </BarChart>
          )}
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
