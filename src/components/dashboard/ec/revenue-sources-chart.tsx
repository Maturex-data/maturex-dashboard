"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const data = [
  { name: "Product Cost", value: 400, color: "#8b5cf6" },
  { name: "Ad Spend", value: 300, color: "#d8b4fe" },
  { name: "App Cost", value: 300, color: "#f3e8ff" },
];

export function RevenueSourcesChart() {
  return (
    <Card className="col-span-1 border-border/50 shadow-sm flex flex-col">
      <CardHeader>
        <CardTitle className="text-base font-semibold">
          Revenue Sources
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col items-center justify-center pb-8">
        <div className="h-[220px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  borderRadius: "8px",
                  border: "none",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="w-full flex justify-center gap-6 mt-4">
          {data.map((entry) => (
            <div key={entry.name} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: entry.color }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.name}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
