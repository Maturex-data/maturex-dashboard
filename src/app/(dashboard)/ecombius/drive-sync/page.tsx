import { SparklesIcon } from "lucide-react";
import Link from "next/link";
import { FlowaDriveSync } from "@/components/dashboard/fl/fl-drive-sync";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getGoogleDriveConnection } from "@/lib/ec-drive";
import { ETSY_SHOPS } from "@/lib/etsy-import";
import { getFlowaDriveFileName } from "@/lib/fl-drive";
import { prisma } from "@/lib/prisma";

export default async function FlowaDriveSyncPage() {
  const [connection, runs, targetFileName, dbShops] = await Promise.all([
    getGoogleDriveConnection(),
    prisma.ecDriveSyncRun.findMany({
      where: {
        OR: [
          { shop: { startsWith: "Flowa" } },
          { source: { startsWith: "FLOWA_" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 30,
      select: {
        id: true,
        shop: true,
        source: true,
        status: true,
        rangeFrom: true,
        rangeTo: true,
        rowCount: true,
        driveFileUrl: true,
        errorMessage: true,
        createdAt: true,
      },
    }),
    getFlowaDriveFileName(),
    prisma.etsyShop.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { code: true, name: true },
    }),
  ]);

  const shops = (dbShops.length > 0 ? dbShops : ETSY_SHOPS).map((s) => ({
    code: s.code,
    name: s.name,
  }));

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
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
              Đồng bộ dữ liệu Drive
            </span>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <FlowaDriveSync
          connection={connection}
          runs={runs}
          shops={shops}
          targetFileName={targetFileName}
        />
      </main>
    </>
  );
}
