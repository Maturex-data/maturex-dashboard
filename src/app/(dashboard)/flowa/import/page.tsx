import { HomeIcon, ShoppingBagIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { EtsyImportCenter } from "@/components/dashboard/fl/etsy-import-center";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ETSY_SHOPS } from "@/lib/etsy-import";
import { prisma } from "@/lib/prisma";

function formatMonth(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function formatImportTime(value: Date): string {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Ho_Chi_Minh",
  }).format(value);
}

export default async function FlowaImportPage() {
  const [shops, batches, completedBatches] = await Promise.all([
    prisma.etsyShop.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),
    prisma.etsyImportBatch.findMany({
      include: { shop: { select: { name: true } } },
      orderBy: { startedAt: "desc" },
      take: 20,
    }),
    prisma.etsyImportBatch.count({ where: { status: "COMPLETED" } }),
  ]);

  const shopOptions = shops.length > 0 ? shops : ETSY_SHOPS;

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
              Import & Lịch sử
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
          <Link href="/flowa">
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <ShoppingBagIcon className="size-3.5 mr-1" />
              <span>Xem bảng dữ liệu</span>
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground font-mono ml-1">
            {completedBatches} batch hoàn tất
          </span>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-5 overflow-x-hidden bg-zinc-50/40 p-6">
        <section className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm text-muted-foreground">Trung tâm tải lên</p>
            <h1 className="mt-1 font-semibold text-2xl tracking-tight">
              Etsy Import Center
            </h1>
          </div>
        </section>

        <EtsyImportCenter
          shops={shopOptions.map((shop) => ({
            code: shop.code,
            name: shop.name,
          }))}
          history={batches.map((batch) => ({
            id: batch.id,
            shopName: batch.shop.name,
            reportType: batch.reportType,
            sourceFileName: batch.sourceFileName,
            sourceMonth: formatMonth(batch.sourceMonth),
            status: batch.status,
            totalRows: batch.totalRows,
            insertedRows: batch.insertedRows,
            skippedRows: batch.skippedRows,
            importedAt: formatImportTime(batch.completedAt ?? batch.startedAt),
          }))}
        />
      </main>
    </>
  );
}
