"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface ReportChartPoint {
  name: string;
  revenue: number | null;
  profit: number | null;
}

export function ReportPeriodChart({
  data,
  unit,
}: {
  data: ReportChartPoint[];
  unit: string;
}) {
  if (!data.some((point) => point.revenue !== null || point.profit !== null)) {
    return (
      <div className="flex h-72 items-center justify-center text-sm text-muted-foreground">
        Nguồn chưa có số liệu để vẽ biểu đồ.
      </div>
    );
  }
  return (
    <figure
      className="mt-8 h-72 min-w-0"
      aria-label={`So sánh doanh thu và lợi nhuận theo tháng, đơn vị ${unit}`}
    >
      <ResponsiveContainer
        width="100%"
        height="100%"
        initialDimension={{ width: 600, height: 288 }}
      >
        <BarChart
          data={data}
          barGap={8}
          margin={{ left: 0, right: 8, top: 8, bottom: 0 }}
          accessibilityLayer
        >
          <CartesianGrid
            vertical={false}
            stroke="#e2e8f0"
            strokeDasharray="3 5"
          />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            width={58}
            tick={{ fill: "#64748b", fontSize: 11 }}
            tickFormatter={(value) =>
              new Intl.NumberFormat("en", { notation: "compact" }).format(value)
            }
          />
          <Tooltip
            cursor={{ fill: "#f1f5f9" }}
            formatter={(value, name) => [
              typeof value === "number"
                ? `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value)} ${unit}`
                : "Chưa có dữ liệu",
              name,
            ]}
            contentStyle={{
              borderRadius: 12,
              border: "1px solid #e2e8f0",
              fontSize: 12,
            }}
          />
          <ReferenceLine y={0} stroke="#a5b8d8" />
          <Bar
            dataKey="revenue"
            name="Doanh thu thuần"
            fill="#365d9d"
            radius={[5, 5, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
          <Bar
            dataKey="profit"
            name="Lợi nhuận sau thuế"
            fill="#a5b8d8"
            radius={[5, 5, 0, 0]}
            maxBarSize={48}
            isAnimationActive={false}
          />
        </BarChart>
      </ResponsiveContainer>
    </figure>
  );
}
