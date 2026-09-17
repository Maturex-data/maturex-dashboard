"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { name: "Product Cost", value: 420, color: "#10b981", percent: "42%" },
  { name: "Ad Spend", value: 380, color: "#8b5cf6", percent: "38%" },
  { name: "App & Ops Fee", value: 200, color: "#0ea5e9", percent: "20%" },
];

const totalCost = data.reduce((acc, item) => acc + item.value, 0);

function CustomDonutTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    name: string;
    value: number;
    payload: { color: string; percent: string };
  }>;
}) {
  if (!active || !payload?.length) return null;
  const item = payload[0];

  return (
    <div className="rounded-lg border border-border/80 bg-background/95 p-2.5 shadow-lg backdrop-blur-md text-xs min-w-[140px]">
      <div className="flex items-center gap-2 mb-1.5">
        <span
          className="size-2 rounded-full"
          style={{ backgroundColor: item.payload.color }}
        />
        <span className="font-semibold text-foreground">{item.name}</span>
      </div>
      <div className="flex items-center justify-between text-muted-foreground font-mono">
        <span>${item.value.toLocaleString("en-US")}k</span>
        <span className="font-medium text-foreground">
          {item.payload.percent}
        </span>
      </div>
    </div>
  );
}

export function RevenueSourcesChart() {
  return (
    <Card className="col-span-1 border-border/60 shadow-xs flex flex-col bg-card/60 backdrop-blur-xs relative overflow-hidden min-w-0">
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-semibold tracking-tight">
          Cơ Cấu Chi Phí (Cost Distribution)
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-0.5">
          Tỷ trọng COGS, Ad Spend & Phí dịch vụ
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-between pb-4 min-w-0 w-full">
        <div className="relative h-[190px] sm:h-[210px] w-full flex items-center justify-center min-w-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={56}
                outerRadius={76}
                paddingAngle={4}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell
                    key={entry.name}
                    fill={entry.color}
                    className="hover:opacity-85 transition-opacity cursor-pointer"
                  />
                ))}
              </Pie>
              <Tooltip content={<CustomDonutTooltip />} />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Display Metric */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
            <span className="text-[9px] sm:text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              Total Cost
            </span>
            <span className="text-xl sm:text-2xl font-bold font-mono text-foreground tracking-tight">
              ${totalCost}k
            </span>
            <span className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
              Optimized
            </span>
          </div>
        </div>

        <div className="w-full space-y-2 mt-2 pt-3 border-t border-border/50">
          {data.map((entry) => (
            <div
              key={entry.name}
              className="flex items-center justify-between text-xs hover:bg-muted/40 p-1.5 rounded-md transition-colors"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="size-2 rounded-full shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="truncate text-muted-foreground font-medium">
                  {entry.name}
                </span>
              </div>
              <div className="flex items-center gap-3 font-mono shrink-0">
                <span className="text-foreground font-semibold">
                  ${entry.value}k
                </span>
                <span className="text-[11px] text-muted-foreground/80 bg-muted px-1.5 py-0.5 rounded text-right min-w-10">
                  {entry.percent}
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
