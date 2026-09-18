import { ShoppingBagIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { EtsyImportCenter } from "@/components/dashboard/fl/etsy-import-center";
import { Button } from "@/components/ui/button";
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
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-border/60 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-lg bg-zinc-950 text-purple-400">
            <SparklesIcon className="size-4" />
          </div>
          <div>
            <p className="font-semibold leading-none">Flowa</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Etsy Import & Batch History
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/flowa">
            <Button variant="outline" size="sm" className="text-xs">
              <ShoppingBagIcon className="size-3.5 mr-1" />
              Xem bảng dữ liệu
            </Button>
          </Link>
          <span className="text-xs text-muted-foreground font-mono">
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
