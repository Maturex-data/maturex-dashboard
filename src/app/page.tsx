import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  BellIcon,
  GlobeIcon,
  MoonIcon,
  PieChartIcon,
  SearchIcon,
  ShoppingCartIcon,
  TrendingUpIcon,
  UsersIcon,
  WalletIcon,
} from "lucide-react";
import { EcDashboardTabs } from "@/components/dashboard/ec/ec-dashboard-tabs";
import { RevenueOverviewChart } from "@/components/dashboard/ec/revenue-overview-chart";
import { RevenueSourcesChart } from "@/components/dashboard/ec/revenue-sources-chart";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  mockAdSpendRecords,
  mockAppCostRecords,
  mockProductCostRecords,
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
  const totalProductCost = mockProductCostRecords.reduce(
    (acc, prod) => acc + prod.totalCost,
    0,
  );
  const totalAppCost = mockAppCostRecords.reduce(
    (acc, app) => acc + app.cost,
    0,
  );

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/50 bg-white px-6 transition-[width,height] ease-linear sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <SidebarTrigger className="-ml-1" />
          <div className="relative w-64 hidden sm:block">
            <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search..."
              className="w-full appearance-none bg-zinc-50 pl-8 rounded-full border-border/50 shadow-none h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground rounded-full hidden sm:inline-flex"
          >
            <MoonIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground rounded-full hidden sm:inline-flex"
          >
            <GlobeIcon className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground rounded-full hidden sm:inline-flex"
          >
            <ShoppingCartIcon className="h-4 w-4" />
          </Button>
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground rounded-full"
            >
              <BellIcon className="h-4 w-4" />
            </Button>
            <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-red-500 border-2 border-white" />
          </div>
          <div className="h-6 w-px bg-border/50 mx-1 hidden sm:block" />
          <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border/50 hover:ring-border transition-all">
            <AvatarImage src="https://github.com/shadcn.png" alt="@shadcn" />
            <AvatarFallback>MX</AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
        {/* Top Quick Overview Cards - Server Rendered */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-border/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng Đơn Hàng
              </CardDescription>
              <div className="flex items-center gap-3 mt-2">
                <CardTitle className="text-3xl font-bold font-mono text-foreground">
                  {mockShopifyOrders.length}
                </CardTitle>
                <div className="flex items-center bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <ArrowUpRightIcon className="w-3 h-3 mr-0.5" />
                  +12%
                </div>
              </div>
            </CardHeader>
            <div className="absolute top-4 right-4 p-2.5 bg-zinc-50 rounded-full border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300">
              <UsersIcon className="w-4 h-4" />
            </div>
          </Card>

          <Card className="border-border/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Doanh Thu (Gross)
              </CardDescription>
              <div className="flex items-center gap-3 mt-2">
                <CardTitle className="text-3xl font-bold font-mono text-foreground">
                  $
                  {totalGross.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </CardTitle>
                <div className="flex items-center bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <ArrowUpRightIcon className="w-3 h-3 mr-0.5" />
                  +18%
                </div>
              </div>
            </CardHeader>
            <div className="absolute top-4 right-4 p-2.5 bg-zinc-50 rounded-full border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300">
              <TrendingUpIcon className="w-4 h-4" />
            </div>
          </Card>

          <Card className="border-border/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tổng Ad Spend
              </CardDescription>
              <div className="flex items-center gap-3 mt-2">
                <CardTitle className="text-3xl font-bold font-mono text-foreground">
                  $
                  {totalAdSpend.toLocaleString("en-US", {
                    maximumFractionDigits: 0,
                  })}
                </CardTitle>
                <div className="flex items-center bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <ArrowDownRightIcon className="w-3 h-3 mr-0.5" />
                  -5%
                </div>
              </div>
            </CardHeader>
            <div className="absolute top-4 right-4 p-2.5 bg-zinc-50 rounded-full border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300">
              <WalletIcon className="w-4 h-4" />
            </div>
          </Card>

          <Card className="border-border/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <CardDescription className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lợi Nhuận Gộp
              </CardDescription>
              <div className="flex items-center gap-3 mt-2">
                <CardTitle className="text-3xl font-bold font-mono text-foreground">
                  $
                  {(
                    totalGross -
                    totalAdSpend -
                    totalProductCost -
                    totalAppCost
                  ).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </CardTitle>
                <div className="flex items-center bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  <ArrowUpRightIcon className="w-3 h-3 mr-0.5" />
                  +9%
                </div>
              </div>
            </CardHeader>
            <div className="absolute top-4 right-4 p-2.5 bg-zinc-50 rounded-full border border-border/50 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-all duration-300">
              <PieChartIcon className="w-4 h-4" />
            </div>
          </Card>
        </div>

        {/* Charts Section */}
        <div className="grid gap-4 lg:grid-cols-3">
          <RevenueOverviewChart />
          <RevenueSourcesChart />
        </div>

        {/* Client Tabs for Data Tables */}
        <EcDashboardTabs
          adSpendRecords={mockAdSpendRecords}
          productCostRecords={mockProductCostRecords}
          appCostRecords={mockAppCostRecords}
        />
      </main>
    </>
  );
}
