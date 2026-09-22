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

      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
        <div className="flex flex-col gap-1 border-b border-border/60 pb-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3.5">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-xs">
              <CloudIcon className="size-5 stroke-[2.2]" />
            </span>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                Đồng bộ dữ liệu vào Google Sheets
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Đẩy dữ liệu raw vào workbook báo cáo tài chính, bảo toàn định
                dạng và công thức.
              </p>
            </div>
          </div>
        </div>

        <EcDriveSync
          connection={connection}
          notice={notice}
          runs={runs}
          targetFileName={targetFileName}
        />
      </main>
    </>
  );
}
