import { CloudIcon } from "lucide-react";
import { EcDriveSync } from "@/components/dashboard/ec/ec-drive-sync";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  getGoogleDriveConnection,
  getGoogleDriveFileName,
} from "@/lib/ec-drive";
import { prisma } from "@/lib/prisma";

export default async function EcDriveSyncPage({
  searchParams,
}: {
  searchParams: Promise<{ drive_connected?: string; drive_error?: string }>;
}) {
  const [
    { drive_connected: connected, drive_error: error },
    connection,
    runs,
    targetFileName,
  ] = await Promise.all([
    searchParams,
    getGoogleDriveConnection(),
    prisma.ecDriveSyncRun.findMany({
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
    getGoogleDriveFileName(),
  ]);
  const notice = connected
    ? {
        type: "success" as const,
        message: "Kết nối Google Drive thành công.",
      }
    : error
      ? { type: "error" as const, message: error }
      : undefined;

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <div className="h-4 w-px bg-border/60" />
          <span className="truncate text-sm font-medium">EC Team</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-sm text-muted-foreground">
            Đồng bộ dữ liệu Drive
          </span>
        </div>
      </header>
      <main className="flex w-full min-w-0 flex-1 flex-col gap-6 p-3 sm:p-6">
        <div className="flex items-start gap-3 border-b border-border/60 pb-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-500">
            <CloudIcon className="size-4" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              EC Google Drive Sync
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kết nối Google Drive kế toán và xuất các tệp raw orders, COGS, ads
              và payout sang thư mục chỉ định.
            </p>
          </div>
        </div>

        <EcDriveSync
          connection={connection}
          runs={runs}
          notice={notice}
          targetFileName={targetFileName}
        />
      </main>
    </>
  );
}
