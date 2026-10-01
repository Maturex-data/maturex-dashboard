import {
  DatabaseIcon,
  FileClockIcon,
  FileSpreadsheetIcon,
  HomeIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "lucide-react";
import Link from "next/link";
import { FlowaDataTable } from "@/components/dashboard/fl/flowa-data-table";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ETSY_SHOPS } from "@/lib/etsy-import";
import { prisma } from "@/lib/prisma";

export default async function FlowaPage() {
  const [shops, orderCount, itemCount, statementCount] = await Promise.all([
    prisma.etsyShop.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
    prisma.etsyOrder.count(),
    prisma.etsyOrderItem.count(),
    prisma.etsyStatement.count(),
  ]);

  const shopOptions =
    shops.length > 0
      ? shops
      : ETSY_SHOPS.map((s) => ({ code: s.code, name: s.name }));

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 sm:px-6 backdrop-blur-md sticky top-0 z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground shrink-0" />
          <div className="flex size-7 items-center justify-center rounded-lg bg-zinc-950 text-purple-400 shrink-0 shadow-2xs">
            <SparklesIcon className="size-3.5" />
          </div>
          <div className="flex items-center gap-1.5 text-xs min-w-0">
            <Link
              href="/"
              className="text-muted-foreground hover:text-foreground transition-colors hidden sm:inline"
            >
              MatureX
            </Link>
            <span className="text-muted-foreground/40 hidden sm:inline">/</span>
            <span className="font-semibold text-foreground truncate">
              Flowa
            </span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-muted-foreground truncate">
              Bảng dữ liệu Etsy
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <HomeIcon className="size-3.5" />
              <span>Về Trang chủ</span>
            </Button>
          </Link>
          <Link href="/flowa/import">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
            >
              <UploadCloudIcon className="size-3.5" />
              <span>Import & Lịch sử</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 p-4 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
        {/* Page Title & Context Header */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/60 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
                Flowa Etsy Analytics
              </h1>
              <span className="rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 px-2 py-0.5 text-[11px] font-mono font-semibold border border-purple-500/20">
                Hub
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Báo cáo hiệu quả bán hàng, chi tiết đơn sản phẩm và sao kê dòng
              tiền thực tế từ đối tác Etsy.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/flowa/import">
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5 bg-zinc-950 text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-zinc-200 shadow-2xs font-medium cursor-pointer"
              >
                <UploadCloudIcon className="size-3.5 text-purple-400" />
                <span>Import File Mới</span>
              </Button>
            </Link>
          </div>
        </section>

        {/* Precision KPI Bento Grid */}
        <section className="grid gap-3.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Partner Shops */}
          <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 shadow-xs backdrop-blur-xs transition-all hover:border-foreground/20 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Shop Đối Tác
              </span>
              <span className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-colors group-hover:border-purple-500/30 group-hover:bg-purple-500/10 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                <ShoppingBagIcon className="size-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {shopOptions.length}
                </span>
                <span className="text-[11px] font-mono font-medium text-muted-foreground">
                  gian hàng
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <span>Trạng thái:</span>
                <span className="inline-flex items-center gap-1 font-mono font-medium text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500" />
                  Đang hoạt động
                </span>
              </div>
            </div>
          </div>

          {/* 2. Total Orders */}
          <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 shadow-xs backdrop-blur-xs transition-all hover:border-foreground/20 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Đơn Hàng (Orders)
              </span>
              <span className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-colors group-hover:border-emerald-500/30 group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                <FileSpreadsheetIcon className="size-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {orderCount.toLocaleString("vi-VN")}
                </span>
                <span className="text-[11px] font-mono font-medium text-muted-foreground">
                  giao dịch
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <span>Dữ liệu file:</span>
                <span className="font-mono font-medium text-foreground">
                  Etsy Orders CSV
                </span>
              </div>
            </div>
          </div>

          {/* 3. Order Items */}
          <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 shadow-xs backdrop-blur-xs transition-all hover:border-foreground/20 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Chi Tiết SP (Items)
              </span>
              <span className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-colors group-hover:border-sky-500/30 group-hover:bg-sky-500/10 group-hover:text-sky-600 dark:group-hover:text-sky-400">
                <DatabaseIcon className="size-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {itemCount.toLocaleString("vi-VN")}
                </span>
                <span className="text-[11px] font-mono font-medium text-muted-foreground">
                  SKU / dòng
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <span>Phân loại shop:</span>
                <span className="font-mono font-medium text-foreground">
                  Artisanhand
                </span>
              </div>
            </div>
          </div>

          {/* 4. Financial Statements */}
          <div className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/60 p-4 shadow-xs backdrop-blur-xs transition-all hover:border-foreground/20 hover:shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Sao Kê & Phí (Statements)
              </span>
              <span className="flex size-7 items-center justify-center rounded-lg border border-border/50 bg-muted/50 text-muted-foreground transition-colors group-hover:border-purple-500/30 group-hover:bg-purple-500/10 group-hover:text-purple-600 dark:group-hover:text-purple-400">
                <FileClockIcon className="size-3.5" />
              </span>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold font-mono tracking-tight text-foreground">
                  {statementCount.toLocaleString("vi-VN")}
                </span>
                <span className="text-[11px] font-mono font-medium text-muted-foreground">
                  bút toán
                </span>
              </div>
              <div className="mt-2.5 flex items-center justify-between border-t border-border/40 pt-2 text-[11px] text-muted-foreground">
                <span>Phí sàn & Payout:</span>
                <span className="font-mono font-medium text-foreground">
                  Auto sync
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Interactive Data Table Component */}
        <section className="min-w-0">
          <FlowaDataTable shops={shopOptions} />
        </section>
      </main>
    </>
  );
}
