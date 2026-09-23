"use client";

import { Label, Pie, PieChart } from "recharts";
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
  ChartTooltipContent,
} from "@/components/ui/chart";

export interface CostMixData {
  month: string;
  cogs: number;
  cogsPercent: number;
  adSpend: number;
  adSpendPercent: number;
  payoutFee: number;
  payoutFeePercent: number;
  totalCost: number;
  hasData: boolean;
}

interface RevenueSourcesChartProps {
  costMix?: CostMixData;
}

const chartConfig = {
  cogs: {
    label: "COGS ghi nhận",
    color: "#f59e0b",
  },
  adSpend: {
    label: "Chi phí Ads",
    color: "#8b5cf6",
  },
  payoutFee: {
    label: "Phí thanh toán",
    color: "#0ea5e9",
  },
} satisfies ChartConfig;

export function RevenueSourcesChart({ costMix }: RevenueSourcesChartProps) {
  if (!costMix || !costMix.hasData || costMix.totalCost === 0) {
    return (
      <Card className="col-span-1 border-border/60 shadow-xs flex flex-col justify-center items-center bg-card/60 backdrop-blur-xs p-6 text-center text-muted-foreground text-xs min-h-[320px]">
        Chưa có dữ liệu cơ cấu chi phí cho tháng này.
      </Card>
    );
  }

  const chartData = [
    {
      type: "cogs",
      name: "COGS ghi nhận",
      value: costMix.cogs,
      percent: costMix.cogsPercent,
      fill: "var(--color-cogs)",
    },
    {
      type: "adSpend",
      name: "Chi phí Ads",
      value: costMix.adSpend,
      percent: costMix.adSpendPercent,
      fill: "var(--color-adSpend)",
    },
    {
      type: "payoutFee",
      name: "Phí thanh toán",
      value: costMix.payoutFee,
      percent: costMix.payoutFeePercent,
      fill: "var(--color-payoutFee)",
    },
  ].filter((item) => item.value > 0);

  return (
    <Card className="col-span-1 border-border/60 shadow-xs flex flex-col bg-card/60 backdrop-blur-xs relative overflow-hidden min-w-0">
      <CardHeader className="pb-0">
        <CardTitle className="text-base font-semibold tracking-tight">
          Cơ Cấu Chi Phí Biến Đổi
        </CardTitle>
        <CardDescription className="text-xs text-muted-foreground mt-0.5">
          Tỷ trọng COGS, Meta Ads & Phí thanh toán
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-between pb-4 min-w-0 w-full pt-2">
        <ChartContainer
          config={chartConfig}
          className="mx-auto aspect-square max-h-[220px] min-h-[200px] w-full"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(value, name) => (
                    <div className="flex flex-1 items-center justify-between gap-3 text-xs leading-none">
                      <span className="text-muted-foreground">{name}</span>
                      <span className="font-mono font-medium text-foreground">
                        $
                        {Number(value).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}
                      </span>
                    </div>
                  )}
                />
              }
            />
            <Pie
              data={chartData}
              dataKey="value"
              nameKey="name"
              innerRadius={60}
              outerRadius={82}
              strokeWidth={3}
              stroke="var(--background, #fff)"
              isAnimationActive={true}
              animationDuration={900}
              animationEasing="ease-out"
            >
              <Label
                content={({ viewBox }) => {
                  if (viewBox && "cx" in viewBox && "cy" in viewBox) {
                    return (
                      <text
                        x={viewBox.cx}
                        y={viewBox.cy}
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        <tspan
                          x={viewBox.cx}
                          y={viewBox.cy}
                          className="fill-foreground text-xl font-bold font-mono"
                        >
                          ${(costMix.totalCost / 1000).toFixed(1)}k
                        </tspan>
                        <tspan
                          x={viewBox.cx}
                          y={(viewBox.cy || 0) + 18}
                          className="fill-muted-foreground text-[11px] font-medium"
                        >
                          Tổng chi phí
                        </tspan>
                      </text>
                    );
                  }
                }}
              />
            </Pie>
          </PieChart>
        </ChartContainer>

        <div className="w-full space-y-2 pt-2 border-t border-border/50 text-xs mt-1">
          {chartData.map((item) => (
            <div
              key={item.name}
              className="flex items-center justify-between text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <span
                  className="size-2 rounded-[2px] shrink-0"
                  style={{
                    backgroundColor:
                      chartConfig[item.type as keyof typeof chartConfig]
                        ?.color ?? item.fill,
                  }}
                />
                <span className="truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-2 font-mono font-medium text-foreground shrink-0">
                <span>
                  $
                  {item.value.toLocaleString("en-US", {
                    minimumFractionDigits: 0,
                    maximumFractionDigits: 0,
                  })}
                </span>
                <span className="text-muted-foreground text-[11px] w-10 text-right">
                  {item.percent}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
