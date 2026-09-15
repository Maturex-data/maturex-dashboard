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

export function RevenueOverviewChart() {
  return (
    <Card className="col-span-1 lg:col-span-2 border-border/50 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Revenue Overview
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                vertical={false}
                stroke="#e5e7eb"
              />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
                dy={10}
              />
              <YAxis
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 12, fill: "#6b7280" }}
              />
              <Tooltip
                cursor={{ fill: "#f3f4f6" }}
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
              <Legend
                iconType="circle"
                wrapperStyle={{ fontSize: "12px", paddingTop: "20px" }}
              />
              <Bar
                dataKey="revenue"
                name="Revenue"
                stackId="a"
                fill="#8b5cf6"
                radius={[0, 0, 4, 4]}
                barSize={12}
              />
              <Bar
                dataKey="adSpend"
                name="Ad Spend"
                stackId="a"
                fill="#d8b4fe"
                radius={[4, 4, 0, 0]}
                barSize={12}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
