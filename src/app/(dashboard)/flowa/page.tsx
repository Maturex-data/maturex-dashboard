import {
  DatabaseIcon,
  FileClockIcon,
  FileSpreadsheetIcon,
  ShoppingBagIcon,
  SparklesIcon,
} from "lucide-react";
import { EtsyImportCenter } from "@/components/dashboard/fl/etsy-import-center";
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

export default async function FlowaPage() {
  const [
    shops,
    batches,
    completedBatches,
    orderCount,
    itemCount,
    statementCount,
  ] = await Promise.all([
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
    prisma.etsyOrder.count(),
    prisma.etsyOrderItem.count(),
    prisma.etsyStatement.count(),
  ]);
  const shopOptions = shops.length > 0 ? shops : ETSY_SHOPS;
  const metrics = [
    { label: "Shop Etsy", value: shopOptions.length, icon: ShoppingBagIcon },
    { label: "Orders", value: orderCount, icon: FileSpreadsheetIcon },
    { label: "Order items", value: itemCount, icon: DatabaseIcon },
    { label: "Statements", value: statementCount, icon: FileClockIcon },
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
            <p className="mt-1 text-xs text-muted-foreground">Etsy Data Hub</p>
          </div>
        </div>
        <span className="text-xs text-muted-foreground">
          {completedBatches} batch hoàn tất
        </span>
      </header>

      <main className="flex flex-1 flex-col gap-5 overflow-x-hidden bg-zinc-50/40 p-6">
        <section>
          <p className="text-sm text-muted-foreground">Dữ liệu cửa hàng</p>
          <h1 className="mt-1 font-semibold text-2xl tracking-tight">
            Etsy Import Center
          </h1>
        </section>

        <section className="grid overflow-hidden rounded-lg border bg-background sm:grid-cols-2 xl:grid-cols-4">
          {metrics.map((metric, index) => (
            <div
              className={`flex min-h-24 items-center justify-between px-5 py-4 ${
                index < metrics.length - 1
                  ? "border-b sm:border-r xl:border-b-0"
                  : ""
              }`}
              key={metric.label}
            >
              <div>
                <p className="text-sm text-muted-foreground">{metric.label}</p>
                <p className="mt-2 font-semibold text-2xl tabular-nums">
                  {metric.value.toLocaleString("vi-VN")}
                </p>
              </div>
              <metric.icon className="size-5 text-purple-500" />
            </div>
          ))}
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
