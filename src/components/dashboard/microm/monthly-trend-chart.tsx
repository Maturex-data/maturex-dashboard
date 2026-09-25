"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { MicromMonthlyTrend } from "@/lib/microm/dashboard-queries";
import {
  formatCurrency,
  formatPercent,
  safeNumber,
} from "@/lib/microm/formatters";

interface MonthlyTrendChartProps {
  trends: MicromMonthlyTrend[];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    color: string;
  }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || payload.length === 0) return null;

  const revItem = payload.find((p) => p.name === "Doanh thu");
  const contribItem = payload.find((p) => p.name === "Đóng góp");
  const rev = safeNumber(revItem?.value);
  const contrib = safeNumber(contribItem?.value);
  const margin = rev > 0 ? (contrib / rev) * 100 : 0;

  return (
    <div className="rounded-lg border border-border/70 bg-popover/95 p-3 shadow-xl backdrop-blur-md text-xs font-mono min-w-[200px]">
      <div className="flex items-center justify-between border-b border-border/50 pb-2 mb-2 font-sans font-semibold">
        <span className="text-foreground">Kỳ: {label}</span>
        <Badge
          variant="outline"
          className={`text-[10px] px-1 py-0 ${
            contrib >= 0
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20"
          }`}
        >
          {formatPercent(margin)} Margin
        </Badge>
      </div>

      <div className="space-y-1.5">
        {payload.map((entry) => (
          <div
            key={entry.name}
            className="flex items-center justify-between gap-4"
          >
            <div className="flex items-center gap-1.5">
              <span
                className="size-2 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-muted-foreground font-sans">
                {entry.name}:
              </span>
            </div>
            <span className="font-semibold text-foreground">
              {formatCurrency(entry.value, "$")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MonthlyTrendChart({ trends }: MonthlyTrendChartProps) {
  if (!trends || trends.length === 0) {
    return (
      <Card className="border border-border/60">
        <CardHeader className="py-3 px-4">
          <CardTitle className="text-sm font-semibold">
            Xu hướng Doanh thu & Chi phí theo tháng
          </CardTitle>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center text-muted-foreground text-xs">
          Chưa có dữ liệu lịch sử theo tháng
        </CardContent>
      </Card>
    );
  }

  const chartData = trends.map((t) => ({
    name: t.month,
    "Doanh thu": t.revenueUsd,
    "Giá vốn COGS": t.cogsUsd,
    "Chi phí Ads": t.adsUsd,
    "Đóng góp": t.contributionUsd,
  }));

  const totalRev = trends.reduce((acc, t) => acc + safeNumber(t.revenueUsd), 0);
  const totalContrib = trends.reduce(
    (acc, t) => acc + safeNumber(t.contributionUsd),
    0,
  );

  return (
    <Card className="border border-border/60">
      <CardHeader className="py-3.5 px-4 sm:px-6 border-b border-border/40">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <CardTitle className="text-sm font-semibold tracking-tight text-foreground">
              Xu hướng P&L theo tháng (2026)
            </CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              So sánh Doanh thu HL, Giá vốn POD, Chi phí Ads và Mức đóng góp ước
              tính
            </p>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-muted-foreground">Tổng Doanh thu:</span>
              <span className="font-semibold text-emerald-400">
                {formatCurrency(totalRev, "$")}
              </span>
            </div>
            <div className="hidden md:flex items-center gap-1.5">
              <span className="text-muted-foreground">Tổng Đóng góp:</span>
              <span className="font-semibold text-purple-400">
                {formatCurrency(totalContrib, "$")}
              </span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-4 sm:p-6 pt-6">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={chartData}
              margin={{ top: 10, right: 10, left: -15, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="currentColor"
                className="text-border/30"
              />
              <XAxis
                dataKey="name"
                stroke="currentColor"
                className="text-muted-foreground"
                fontSize={11}
                tickLine={false}
              />
              <YAxis
                stroke="currentColor"
                className="text-muted-foreground"
                fontSize={11}
                tickLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "11px", paddingTop: "14px" }}
                iconType="circle"
                iconSize={8}
              />
              <Bar
                dataKey="Doanh thu"
                fill="#10b981"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="Giá vốn COGS"
                fill="#fbbf24"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="Chi phí Ads"
                fill="#38bdf8"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
              <Bar
                dataKey="Đóng góp"
                fill="#a855f7"
                radius={[4, 4, 0, 0]}
                maxBarSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
