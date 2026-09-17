"use client";

import {
  MegaphoneIcon,
  PackageCheckIcon,
  ShoppingBagIcon,
  WalletCardsIcon,
} from "lucide-react";
import * as React from "react";
import { AirwallexAccountActivityTable } from "@/components/dashboard/ec/airwallex-account-activity-table";
import { DataExportControls } from "@/components/dashboard/ec/data-export-controls";
import { ShopifyRawTables } from "@/components/dashboard/ec/shopify-raw-tables";
import { ShopifySyncButton } from "@/components/dashboard/ec/shopify-sync-button";
import { MiAdSpendTable } from "@/components/dashboard/mi/mi-ad-spend-table";
import { PoProductCostTable } from "@/components/dashboard/po/po-product-cost-table";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function EcDashboardTabs() {
  const [activeTab, setActiveTab] = React.useState("shopify");

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="space-y-4 min-w-0"
    >
      <div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between min-w-0">
        <div className="overflow-x-auto no-scrollbar -mx-3 px-3 sm:mx-0 sm:px-0">
          <TabsList className="bg-muted/70 p-1 rounded-xl h-auto border border-border/50 flex w-max sm:w-auto">
            <TabsTrigger
              value="shopify"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <ShoppingBagIcon className="size-3.5 text-emerald-500 shrink-0" />
              <span>1. Đơn Hàng Shopify</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                Neon
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="ads"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <MegaphoneIcon className="size-3.5 text-sky-500 shrink-0" />
              <span>2. Tài Khoản Ads</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-sky-500/10 text-sky-600 dark:text-sky-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                Meta
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="cogs"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <PackageCheckIcon className="size-3.5 text-amber-500 shrink-0" />
              <span>3. Product Cost</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                COGS
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="airwallex"
              className="gap-1.5 sm:gap-2 text-xs md:text-sm py-1.5 px-2.5 sm:px-3 rounded-lg data-active:bg-background data-active:text-foreground data-active:shadow-xs transition-all whitespace-nowrap shrink-0"
            >
              <WalletCardsIcon className="size-3.5 text-violet-500 shrink-0" />
              <span>4. Airwallex</span>
              <span className="ml-0.5 sm:ml-1 rounded-md bg-violet-500/10 text-violet-600 dark:text-violet-400 px-1.5 py-0.2 text-[10px] font-mono font-medium">
                Bank
              </span>
            </TabsTrigger>
          </TabsList>
        </div>
        <div className="self-end sm:self-auto shrink-0">
          <DataExportControls />
        </div>
      </div>

      {/* Tab 1: Shopify SQL Orders & Details */}
      <TabsContent value="shopify" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-xs overflow-hidden bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-4 bg-muted/20 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <ShoppingBagIcon className="w-4 h-4 text-emerald-500" />
                  Dữ Liệu Đơn Hàng & Chu Trình Payout (Shopify)
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Đối soát chi tiết đơn hàng, thời điểm payout về tài khoản ngân
                  hàng và net transaction fee.
                </CardDescription>
              </div>
              <ShopifySyncButton />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <ShopifyRawTables />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Ad Spend */}
      <TabsContent value="ads" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-xs overflow-hidden bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-4 bg-muted/20 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <MegaphoneIcon className="w-4 h-4 text-sky-500" />
                  Chi Phí Quảng Cáo (Ad Spend)
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Bóc tách chi phí quảng cáo, ROAS, cost per purchase từ tài
                  khoản Meta Ads và các kênh traffic.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-500/10 shrink-0 px-2.5 py-0.5 text-xs font-mono font-medium"
              >
                Meta Marketing API
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <MiAdSpendTable />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 3: Product Cost */}
      <TabsContent value="cogs" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-xs overflow-hidden bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-4 bg-muted/20 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <PackageCheckIcon className="w-4 h-4 text-amber-500" />
                  Chi Phí Sản Phẩm & Fulfillment (Product Cost)
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  Tổng hợp chi phí in ấn, phôi và vận chuyển thực tế từ
                  Printify, PG Print 1 và Sheet LPro.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-border/60 bg-background text-muted-foreground">
                  Printify
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-border/60 bg-background text-muted-foreground">
                  PG Print 1
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  Sheet LPro
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <PoProductCostTable />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 4: Airwallex */}
      <TabsContent value="airwallex" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-xs overflow-hidden bg-card/60 backdrop-blur-xs">
          <CardHeader className="pb-4 bg-muted/20 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <WalletCardsIcon className="w-4 h-4 text-violet-500" />
              Airwallex Account Activity
            </CardTitle>
            <CardDescription className="mt-1 text-xs">
              Sao kê thu chi dòng tiền, giao dịch thẻ doanh nghiệp và số dư tài
              khoản thực tế.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <AirwallexAccountActivityTable />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
