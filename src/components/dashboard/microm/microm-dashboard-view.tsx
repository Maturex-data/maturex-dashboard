"use client";

import * as React from "react";
import type { MicromDashboardSummary } from "@/lib/microm/dashboard-queries";
import { MicromKpiCards } from "./kpi-cards";
import { MicromTabs } from "./microm-tabs";
import { MonthlyTrendChart } from "./monthly-trend-chart";
import { SyncControlBar } from "./sync-control-bar";

interface MicromDashboardViewProps {
  initialSummary: MicromDashboardSummary;
}

export function MicromDashboardView({
  initialSummary,
}: MicromDashboardViewProps) {
  const [summary, setSummary] =
    React.useState<MicromDashboardSummary>(initialSummary);
  const [selectedMonth, setSelectedMonth] = React.useState<string>(
    initialSummary.selectedMonth,
  );
  const [activeTab, setActiveTab] = React.useState<string>("Orders");

  const refreshSummary = React.useCallback(async (month: string) => {
    try {
      const res = await fetch(`/api/microm/dashboard?month=${month}`);
      const json = await res.json();
      if (res.ok && json.success) {
        setSummary(json.data);
      }
    } catch (e) {
      console.error("Failed to refresh summary:", e);
    }
  }, []);

  const handleMonthChange = (newMonth: string) => {
    setSelectedMonth(newMonth);
    refreshSummary(newMonth);
  };

  const handleActionComplete = () => {
    refreshSummary(selectedMonth);
  };

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* 1. Control Bar: Month Picker & Sync Actions */}
      <SyncControlBar
        selectedMonth={selectedMonth}
        onSelectMonth={handleMonthChange}
        availableMonths={summary.availableMonths}
        isProviderReconciled={summary.isProviderReconciled}
        lastCheckedAt={summary.lastCheckedAt}
        activeRunId={summary.activeRunId}
        onActionComplete={handleActionComplete}
      />

      {/* 2. 5 Truthful KPI Cards */}
      <MicromKpiCards
        kpi={summary.kpi}
        selectedTab={activeTab}
        onSelectTab={setActiveTab}
      />

      {/* 3. Monthly Trend Chart */}
      <MonthlyTrendChart trends={summary.monthlyTrends} />

      {/* 4. 4 Detail Tabs (Orders, COGS, Ads, Shopify_Items) */}
      <MicromTabs
        selectedMonth={selectedMonth}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
