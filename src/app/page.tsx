import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BellIcon,
  DollarSignIcon,
  LayersIcon,
  PackageIcon,
  SearchIcon,
  TrendingUpIcon,
  WalletIcon,
} from "lucide-react";
import { EcDashboardTabs } from "@/components/dashboard/ec/ec-dashboard-tabs";
import { RevenueOverviewChart } from "@/components/dashboard/ec/revenue-overview-chart";
import { RevenueSourcesChart } from "@/components/dashboard/ec/revenue-sources-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  mockAdSpendRecords,
  mockAppCostRecords,
  mockShopifyOrders,
} from "@/lib/mock-data";

export default function Page() {
  const totalGross = mockShopifyOrders.reduce(
    (acc, order) => acc + order.orderValue,
    0,
  );
  const totalAdSpend = mockAdSpendRecords.reduce(
    (acc, ad) => acc + ad.spend,
    0,
  );
  const totalProductCost = 0;
  const totalAppCost = mockAppCostRecords.reduce(
    (acc, app) => acc + app.cost,
    0,
  );
  const netProfit = totalGross - totalAdSpend - totalProductCost - totalAppCost;
  const netMargin =
    totalGross > 0 ? Math.round((netProfit / totalGross) * 100) : 0;

  return (
    <>
      {/* Sleek Command-style Header - Fully Responsive */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-3 sm:px-6 backdrop-blur-md sticky top-0 z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground shrink-0" />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate hidden xs:inline">
              MatureX Financial
            </span>
            <span className="text-muted-foreground/40 hidden xs:inline">/</span>
            <span className="text-xs font-medium text-foreground truncate">
              EC Team
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative hidden md:block w-48 lg:w-64">
            <SearchIcon className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <input
              type="text"
              readOnly
              placeholder="Search orders, transactions..."
              className="w-full bg-muted/50 pl-8 pr-12 rounded-lg border border-border/50 h-8 text-xs placeholder:text-muted-foreground focus:outline-hidden cursor-pointer hover:bg-muted/80 transition-colors"
            />
            <kbd className="absolute right-2 top-1.5 rounded border border-border/60 bg-background px-1.5 text-[10px] font-mono text-muted-foreground">
              ⌘K
            </kbd>
          </div>

          <div className="h-4 w-px bg-border/60 hidden md:block" />

          <Button
            variant="ghost"
            size="icon"
            className="size-8 text-muted-foreground rounded-lg hover:text-foreground"
          >
            <BellIcon className="size-4" />
          </Button>

          <Avatar className="size-7 ring-1 ring-border/80">
            <AvatarImage src="https://github.com/shadcn.png" alt="Admin" />
            <AvatarFallback className="text-[11px] font-semibold bg-muted">
              MX
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 sm:gap-6 p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
        {/* Page Title & Status Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
              EC Financial Analytics
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Báo cáo hiệu quả kinh doanh, chu kỳ payout và kiểm soát chi phí
              thực tế.
            </p>
          </div>
        </div>

        {/* Precision KPI Bento Grid */}
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Orders */}
          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card/60 backdrop-blur-xs group hover:border-foreground/20 transition-all">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng Đơn Hàng
                </span>
                <span className="size-7 rounded-lg bg-muted/60 border border-border/40 flex items-center justify-center text-muted-foreground group-hover:text-foreground group-hover:border-foreground/20 transition-colors">
                  <PackageIcon className="size-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    {mockShopifyOrders.length.toLocaleString()}
                  </span>
                  <span className="inline-flex items-center text-[11px] font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                    <ArrowUpRightIcon className="size-3 mr-0.5" />
                    +12.4%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between border-t border-border/40 pt-1.5">
                  <span>Tỷ lệ hoàn (Refund):</span>
                  <span className="font-mono font-medium text-foreground">
                    1.8%
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Gross Revenue */}
          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card/60 backdrop-blur-xs group hover:border-foreground/20 transition-all">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Doanh Thu (Gross)
                </span>
                <span className="size-7 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                  <DollarSignIcon className="size-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    $
                    {totalGross.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="inline-flex items-center text-[11px] font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                    <TrendingUpIcon className="size-3 mr-0.5" />
                    +18.2%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between border-t border-border/40 pt-1.5">
                  <span>AOV (Trung bình đơn):</span>
                  <span className="font-mono font-medium text-foreground">
                    $
                    {(
                      totalGross / Math.max(1, mockShopifyOrders.length)
                    ).toFixed(1)}
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Ad Spend */}
          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card/60 backdrop-blur-xs group hover:border-foreground/20 transition-all">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Tổng Ad Spend
                </span>
                <span className="size-7 rounded-lg bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-600 dark:text-violet-400">
                  <WalletIcon className="size-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    $
                    {totalAdSpend.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="inline-flex items-center text-[11px] font-semibold font-mono text-rose-500">
                    <ArrowDownRightIcon className="size-3 mr-0.5" />
                    -4.8%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between border-t border-border/40 pt-1.5">
                  <span>Blended ROAS:</span>
                  <span className="font-mono font-medium text-foreground">
                    {totalAdSpend > 0
                      ? (totalGross / totalAdSpend).toFixed(2)
                      : "0"}
                    x
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Net Profit */}
          <Card className="border-border/60 shadow-xs relative overflow-hidden bg-card/60 backdrop-blur-xs group hover:border-foreground/20 transition-all">
            <CardContent className="p-4 flex flex-col justify-between h-full">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">
                  Lợi Nhuận Gộp
                </span>
                <span className="size-7 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-600 dark:text-sky-400">
                  <LayersIcon className="size-3.5" />
                </span>
              </div>
              <div className="mt-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                    $
                    {netProfit.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                  <span className="inline-flex items-center text-[11px] font-semibold font-mono text-emerald-600 dark:text-emerald-400">
                    <TrendingUpIcon className="size-3 mr-0.5" />+{netMargin}%
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 flex items-center justify-between border-t border-border/40 pt-1.5">
                  <span>Biên lợi nhuận ròng:</span>
                  <span className="font-mono font-medium text-foreground">
                    {netMargin}%
                  </span>
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Visual Charts Row */}
        <div className="grid gap-4 lg:grid-cols-3">
          <RevenueOverviewChart />
          <RevenueSourcesChart />
        </div>

        {/* Core Financial Data Tables */}
        <EcDashboardTabs />
      </main>
    </>
  );
}
