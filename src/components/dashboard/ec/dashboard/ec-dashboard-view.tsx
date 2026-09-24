"use client";

import * as React from "react";
import type { DashboardSummary } from "@/lib/ec/dashboard/types";
import { EcDashboardTabs } from "../ec-dashboard-tabs";
import { RevenueOverviewChart } from "../revenue-overview-chart";
import { RevenueSourcesChart } from "../revenue-sources-chart";
import { KpiCards } from "./kpi-cards";
import { MonthAndSyncControls } from "./month-and-sync-controls";

interface EcDashboardViewProps {
  initialSummary: DashboardSummary;
}

export function EcDashboardView({ initialSummary }: EcDashboardViewProps) {
  const summaryCache = React.useRef<Record<string, DashboardSummary>>({
    [initialSummary.period]: initialSummary,
  });
  const [summary, setSummary] =
    React.useState<DashboardSummary>(initialSummary);
  const [selectedMonth, setSelectedMonth] = React.useState(
    initialSummary.period,
  );
  const [activeTab, setActiveTab] = React.useState("orders");

  const fetchSummary = React.useCallback(async (month: string) => {
    // Instant switch if cached in memory
    if (summaryCache.current[month]) {
      setSummary(summaryCache.current[month]);
    }
    try {
      const res = await fetch(`/api/ec/dashboard?month=${month}`);
      const json = await res.json();
      if (res.ok && json.success) {
        summaryCache.current[month] = json.data;
        setSummary(json.data);
      }
    } catch {
      // Keep existing summary
    }
  }, []);

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    fetchSummary(newMonth);
  };

  const handleSyncComplete = () => {
    summaryCache.current = {};
    fetchSummary(selectedMonth);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Month & Sync Controls */}
      <MonthAndSyncControls
        selectedMonth={selectedMonth}
        onSelectMonth={handleMonthChange}
        availableMonths={summary.availableMonths}
        isProvisional={summary.isProvisional}
        lastSyncedAt={summary.lastSyncedAt}
        onSyncComplete={handleSyncComplete}
      />

      {/* 4 Truthful KPI Cards */}
      <KpiCards summary={summary} onSelectTab={setActiveTab} />

      {/* 2 Real Data Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <RevenueOverviewChart trendSeries={summary.trendSeries} />
        <RevenueSourcesChart costMix={summary.costMix} />
      </div>

      {/* 4 Detail Tabs (Orders, COGS, Ads, Payouts) */}
      <EcDashboardTabs
        selectedMonth={selectedMonth}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
