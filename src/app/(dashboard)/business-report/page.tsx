import { FileChartColumnIncreasingIcon } from "lucide-react";
import {
  EcBusinessReport,
  type EcPnlApiResponse,
} from "@/components/dashboard/ec/ec-business-report";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { vietnamMonthOptions } from "@/lib/date-time";
import { getEcPnlMonth } from "@/lib/ec-pnl";

function previousMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(Date.UTC(year, monthNumber - 2, 1)).toISOString().slice(0, 7);
}

export default async function BusinessReportPage() {
  const months = vietnamMonthOptions().reverse();
  const latestMonth = months.at(-1) ?? "2026-01";
  const firstMonth = previousMonth(latestMonth);
  const initialData: EcPnlApiResponse = {
    months,
    reports: await Promise.all([
      getEcPnlMonth(firstMonth),
      getEcPnlMonth(latestMonth),
    ]),
  };

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
      <main className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-5 p-3 sm:p-6">
        <div className="flex items-start gap-3 border-b border-border/60 pb-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-500/20 bg-emerald-500/10 text-emerald-600">
            <FileChartColumnIncreasingIcon className="size-4" />
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              Báo cáo kinh doanh EC
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Kết quả hoạt động kinh doanh TheDeerly, đối chiếu theo tháng.
            </p>
          </div>
        </div>
        <section className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-xs">
          <EcBusinessReport initialData={initialData} />
        </section>
      </main>
    </>
  );
}
