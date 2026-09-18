import {
  DatabaseIcon,
  FileClockIcon,
  FileSpreadsheetIcon,
  ShoppingBagIcon,
  SparklesIcon,
  UploadCloudIcon,
} from "lucide-react";
import Link from "next/link";
import { FlowaDataTable } from "@/components/dashboard/fl/flowa-data-table";
import { Button } from "@/components/ui/button";
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

  const shopOptions = shops.length > 0 ? shops : ETSY_SHOPS;

  const metrics = [
    { label: "Shop đối tác", value: shopOptions.length, icon: ShoppingBagIcon },
    {
      label: "Đơn hàng (Orders)",
      value: orderCount,
      icon: FileSpreadsheetIcon,
    },
    { label: "Chi tiết SP (Items)", value: itemCount, icon: DatabaseIcon },
    {
      label: "Giao dịch (Statements)",
      value: statementCount,
      icon: FileClockIcon,
    },
  ];

  return (
    <>
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-purple-400">
            <SparklesIcon className="size-4" />
          </div>
          <div>
            <p className="font-semibold leading-none">Flowa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Etsy Partner Data Hub
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/flowa/import">
            <Button
              size="sm"
              className="h-8 text-xs gap-1.5 bg-purple-600 hover:bg-purple-700 text-white"
            >
              <UploadCloudIcon className="size-3.5" />
              <span>Import & Lịch sử</span>
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 overflow-x-hidden bg-zinc-50/40 p-6">
        {/* Title Header */}
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">
              Dữ liệu đối tác bán hàng
            </p>
            <h1 className="mt-0.5 font-semibold text-2xl tracking-tight font-heading">
              Báo Cáo Bán Hàng & Sao Kê Etsy
            </h1>
          </div>
        </section>

        {/* Metric KPI Strip */}
        <section className="grid overflow-hidden rounded-xl border border-border/60 bg-background sm:grid-cols-2 xl:grid-cols-4 shadow-xs">
          {metrics.map((metric, index) => (
            <div
              className={`flex min-h-24 items-center justify-between px-5 py-4 ${
                index < metrics.length - 1
                  ? "border-b sm:border-r xl:border-b-0 border-border/50"
                  : ""
              }`}
              key={metric.label}
            >
              <div>
                <p className="text-xs text-muted-foreground font-medium">
                  {metric.label}
                </p>
                <p className="mt-1.5 font-bold text-2xl tabular-nums tracking-tight font-mono text-foreground">
                  {metric.value.toLocaleString("vi-VN")}
                </p>
              </div>
              <div className="size-9 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-600 dark:text-purple-400">
                <metric.icon className="size-4" />
              </div>
            </div>
          ))}
        </section>

        {/* Interactive Data Table Component */}
        <FlowaDataTable shops={shopOptions} />
      </main>
    </>
  );
}
