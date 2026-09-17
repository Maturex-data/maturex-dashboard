"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { name: "Jan", revenue: 4000, adSpend: 2400 },
  { name: "Feb", revenue: 3000, adSpend: 1398 },
  { name: "Mar", revenue: 2000, adSpend: 9800 },
  { name: "Apr", revenue: 2780, adSpend: 3908 },
  { name: "May", revenue: 1890, adSpend: 4800 },
  { name: "Jun", revenue: 2390, adSpend: 3800 },
  { name: "Jul", revenue: 3490, adSpend: 4300 },
  { name: "Aug", revenue: 4000, adSpend: 2400 },
  { name: "Sep", revenue: 3000, adSpend: 1398 },
  { name: "Oct", revenue: 2000, adSpend: 9800 },
  { name: "Nov", revenue: 2780, adSpend: 3908 },
  { name: "Dec", revenue: 1890, adSpend: 4800 },
];

function CustomChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const rev = payload.find((p) => p.name === "Revenue")?.value ?? 0;
  const ads = payload.find((p) => p.name === "Ad Spend")?.value ?? 0;
  const net = rev - ads;

  return (
    <div className="rounded-xl border border-border/80 bg-background/95 p-3 shadow-xl backdrop-blur-md min-w-[170px] space-y-2">
      <div className="flex items-center justify-between border-b border-border/50 pb-1.5">
        <span className="font-semibold text-xs text-foreground uppercase tracking-wider">
          {label} 2026
        </span>
        <span
          className={`text-[10px] font-mono font-medium px-1.5 py-0.5 rounded ${
            net >= 0
              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
          }`}
        >
          {net >= 0 ? "Margin +" : "Margin -"}
          {rev > 0 ? Math.round((net / rev) * 100) : 0}%
        </span>
      </div>

      <div className="space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500" />
            <span>Revenue</span>
          </div>
          <span className="font-mono font-medium text-foreground">
            ${rev.toLocaleString("en-US")}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <span className="size-2 rounded-full bg-violet-500" />
            <span>Ad Spend</span>
          </div>
          <span className="font-mono font-medium text-foreground">
            ${ads.toLocaleString("en-US")}
          </span>
        </div>

        <div className="flex items-center justify-between gap-4 pt-1 border-t border-dashed border-border/60">
          <span className="text-muted-foreground">Net Op.</span>
          <span
            className={`font-mono font-semibold ${
              net >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}
          >
            ${net.toLocaleString("en-US")}
          </span>
        </div>
      </div>
    </div>
  );
}

export function RevenueOverviewChart() {
  return (
    <Card className="col-span-1 lg:col-span-2 border-border/60 shadow-xs relative overflow-hidden bg-card/60 backdrop-blur-xs">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold tracking-tight">
            Revenue & Ad Spend Overview
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            Tương quan doanh số và chi phí ads 12 tháng qua
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-emerald-500" />
            <span className="text-muted-foreground font-medium">Doanh thu</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-violet-500" />
            <span className="text-muted-foreground font-medium">Ad Spend</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 8, right: 8, left: -20, bottom: 0 }}
              barGap={4}
            >
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                  <stop offset="100%" stopColor="#059669" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="adSpendGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.85} />
                  <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.65} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="currentColor"
                className="text-border/40"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground font-mono"
                dy={8}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "currentColor" }}
                className="text-muted-foreground font-mono"
                tickFormatter={(value: number) => `$${value / 1000}k`}
              />
              <Tooltip content={<CustomChartTooltip />} />
              <Bar
                dataKey="revenue"
                name="Revenue"
                fill="url(#revenueGrad)"
                radius={[4, 4, 0, 0]}
                barSize={14}
              />
              <Bar
                dataKey="adSpend"
                name="Ad Spend"
                fill="url(#adSpendGrad)"
                radius={[4, 4, 0, 0]}
                barSize={14}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
