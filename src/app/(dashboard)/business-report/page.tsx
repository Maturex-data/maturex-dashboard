import { FileChartColumnIncreasingIcon } from "lucide-react";
import { GoogleBusinessReport } from "@/components/dashboard/ec/google-business-report";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getEcBusinessReportSheetTables } from "@/lib/ec-business-report-sheet";
import { REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";

export const dynamic = "force-dynamic";

export default async function BusinessReportPage() {
  const tables = await getEcBusinessReportSheetTables();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <div className="h-4 w-px bg-border/60" />
          <span className="truncate text-sm font-medium">EC Team</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-sm text-muted-foreground">
            Báo cáo kinh doanh
          </span>
        </div>
      </header>
      <main className="flex w-full min-w-0 flex-1 flex-col gap-5 p-3 sm:p-6">
        <div className="flex items-start gap-3 border-b border-border/60 pb-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-[#d9e2f2] bg-[#eaf2ff] text-[#10205e]">
            <FileChartColumnIncreasingIcon className="size-4" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              Báo cáo kinh doanh EC
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dữ liệu hiển thị trực tiếp từ Google Sheet kế toán TheDeerly.
            </p>
          </div>
        </div>
        <section className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-xs">
          <GoogleBusinessReport
            spreadsheetId={REPORT_SPREADSHEET_ID}
            tables={tables}
          />
        </section>
      </main>
    </>
  );
}
