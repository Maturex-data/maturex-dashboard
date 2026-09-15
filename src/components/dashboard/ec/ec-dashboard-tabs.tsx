"use client";

import {
  LayersIcon,
  MegaphoneIcon,
  PackageCheckIcon,
  ShoppingBagIcon,
} from "lucide-react";
import * as React from "react";
import { EcShopifyOrdersTable } from "@/components/dashboard/ec/ec-shopify-orders-table";
import { FlAppCostTable } from "@/components/dashboard/fl/fl-app-cost-table";
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
import type {
  AdSpendRecord,
  AppCostRecord,
  ProductCostRecord,
  ShopifyOrder,
} from "@/lib/mock-data";

interface EcDashboardTabsProps {
  shopifyOrders: ShopifyOrder[];
  adSpendRecords: AdSpendRecord[];
  productCostRecords: ProductCostRecord[];
  appCostRecords: AppCostRecord[];
}

export function EcDashboardTabs({
  shopifyOrders,
  adSpendRecords,
  productCostRecords,
  appCostRecords,
}: EcDashboardTabsProps) {
  const [activeTab, setActiveTab] = React.useState("shopify");

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
      <div className="flex flex-col gap-3 border-b border-border/60 pb-3 sm:flex-row sm:items-center sm:justify-between">
        <TabsList className="bg-muted/60 p-1">
          <TabsTrigger value="shopify" className="gap-2 text-xs md:text-sm">
            <ShoppingBagIcon className="size-3.5" />
            <span>1. Đơn Hàng Shopify</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {shopifyOrders.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="ads" className="gap-2 text-xs md:text-sm">
            <MegaphoneIcon className="size-3.5" />
            <span>2. Tài Khoản Ad & Spend</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {adSpendRecords.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="cogs" className="gap-2 text-xs md:text-sm">
            <PackageCheckIcon className="size-3.5" />
            <span>3. Product Cost (Printify / PG / LPro)</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {productCostRecords.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="apps" className="gap-2 text-xs md:text-sm">
            <LayersIcon className="size-3.5" />
            <span>4. Chi Phí App</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-[10px]">
              {appCostRecords.length}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </div>

      {/* Tab 1: Shopify SQL Orders & Details */}
      <TabsContent value="shopify" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-sm overflow-hidden bg-card/40">
          <CardHeader className="pb-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <ShoppingBagIcon className="w-5 h-5 text-emerald-500" />
                  Dữ Liệu Đơn Hàng & Chu Trình Payout (Shopify)
                </CardTitle>
                <CardDescription className="mt-1.5 text-sm">
                  Theo dõi chi tiết Order, mốc thời gian (Tạo / Gửi / Nhận),
                  Refund, Transaction Fee và tình trạng Payout về ngân hàng.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 shrink-0 px-3 py-1 font-medium"
              >
                Sync: Realtime
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <EcShopifyOrdersTable orders={shopifyOrders} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 2: Ad Spend */}
      <TabsContent value="ads" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-sm overflow-hidden bg-card/40">
          <CardHeader className="pb-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <MegaphoneIcon className="w-5 h-5 text-sky-500" />
                  Chi Phí Quảng Cáo Theo Tài Khoản (Ad Spend)
                </CardTitle>
                <CardDescription className="mt-1.5 text-sm">
                  Dữ liệu bóc tách chi phí quảng cáo từ các tài khoản Facebook
                  Ads, TikTok Ads và Google Ads.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-sky-500/30 text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 shrink-0 px-3 py-1 font-medium"
              >
                {adSpendRecords.length} Tài Khoản
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <MiAdSpendTable records={adSpendRecords} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 3: Product Cost */}
      <TabsContent value="cogs" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-sm overflow-hidden bg-card/40">
          <CardHeader className="pb-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <PackageCheckIcon className="w-5 h-5 text-amber-500" />
                  Chi Phí Sản Phẩm & Fulfillment (Product Cost)
                </CardTitle>
                <CardDescription className="mt-1.5 text-sm">
                  Tổng hợp chi phí in ấn, phôi và shipping từ Portal Printify,
                  PG Print 1 và Google Sheet LPro liên kết với đơn Shopify.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  variant="outline"
                  className="px-3 py-1 font-medium shadow-none bg-background"
                >
                  Printify
                </Badge>
                <Badge
                  variant="outline"
                  className="px-3 py-1 font-medium shadow-none bg-background"
                >
                  PG Print 1
                </Badge>
                <Badge
                  variant="outline"
                  className="px-3 py-1 font-medium border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 shadow-none"
                >
                  Sheet LPro
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <PoProductCostTable records={productCostRecords} />
          </CardContent>
        </Card>
      </TabsContent>

      {/* Tab 4: App Cost */}
      <TabsContent value="apps" className="mt-0 space-y-4">
        <Card className="border-border/60 shadow-sm overflow-hidden bg-card/40">
          <CardHeader className="pb-4 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-border/50">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <LayersIcon className="w-5 h-5 text-purple-500" />
                  Chi Phí App & Dịch Vụ (App Costs)
                </CardTitle>
                <CardDescription className="mt-1.5 text-sm">
                  Các khoản phí phần mềm định kỳ, công cụ đo lường quảng cáo,
                  app tích hợp Shopify và fulfillment portal.
                </CardDescription>
              </div>
              <Badge
                variant="outline"
                className="border-purple-500/30 text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-500/10 shrink-0 px-3 py-1 font-medium"
              >
                Định kỳ & Usage
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <FlAppCostTable records={appCostRecords} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
