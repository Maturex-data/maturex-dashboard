import { EcDashboardView } from "@/components/dashboard/ec/dashboard/ec-dashboard-view";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getEcDashboardSummary } from "@/lib/ec/dashboard";

export const dynamic = "force-dynamic";

export default async function Page() {
  const summary = await getEcDashboardSummary();

  return (
    <>
      {/* Sleek Command-style Header - Compact & Clean */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border/60 bg-background/80 px-3 sm:px-6 backdrop-blur-md sticky top-0 z-20 gap-2">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground shrink-0" />
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate hidden xs:inline">
              MatureX Financial
            </span>
            <span className="text-muted-foreground/40 hidden xs:inline">/</span>
            <span className="text-xs font-medium text-foreground truncate">
              EC Dashboard
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] font-mono">
              Google Sheet Projection
            </span>
          </div>

          <Avatar className="size-7 ring-1 ring-border/80">
            <AvatarImage src="https://github.com/shadcn.png" alt="Admin" />
            <AvatarFallback className="text-[11px] font-semibold bg-muted">
              MX
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 sm:gap-6 p-3 sm:p-6 max-w-7xl mx-auto w-full min-w-0">
        {/* Page Title & Status Strip */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground font-heading">
              EC Financial Analytics
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Báo cáo hiệu quả kinh doanh, chu kỳ payout và kiểm soát chi phí từ
              Google Sheet chuẩn hóa.
            </p>
          </div>
        </div>

        {/* Interactive Dashboard View */}
        <EcDashboardView initialSummary={summary} />
      </main>
    </>
  );
}
