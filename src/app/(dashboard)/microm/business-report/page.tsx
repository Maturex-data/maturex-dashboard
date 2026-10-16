import { MicromBusinessReport } from "@/components/dashboard/microm/business-report";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { getMicromReportTables } from "@/lib/microm/business-report-sheet";
import { MICROM_SPREADSHEET_ID } from "@/lib/microm/constants";

export const dynamic = "force-dynamic";
export const metadata = { title: "Báo cáo kinh doanh | Microm" };
export default async function MicromBusinessReportPage() {
  let tables: Awaited<ReturnType<typeof getMicromReportTables>> = [];
  let error: string | undefined;
  try {
    tables = await getMicromReportTables();
  } catch (cause) {
    error =
      cause instanceof Error
        ? cause.message
        : "Không tải được báo cáo. Vui lòng thử lại.";
  }
  return (
    <>
      <header className="flex h-14 items-center gap-3 border-b px-6">
        <SidebarTrigger />
        <span className="text-sm">Microm / Báo cáo kinh doanh</span>
      </header>
      <main className="min-w-0 flex-1 bg-[#f5f7fb] px-4 py-8 sm:px-8 lg:px-10">
        <div className="mx-auto max-w-[1400px] space-y-8">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-3 text-xs font-medium tracking-[0.16em] text-[#365d9d] uppercase">
                Microm · Báo cáo tài chính
              </p>
              <h1 className="text-3xl font-medium tracking-tight text-slate-900">
                Tổng quan kinh doanh
              </h1>
              <p className="mt-3 text-sm text-slate-500">
                Kết quả kinh doanh, kế hoạch Q4 và chi phí Việt Nam.
              </p>
            </div>
            <span className="text-sm text-slate-400">Năm tài chính 2026</span>
          </div>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : (
            <MicromBusinessReport
              tables={tables}
              spreadsheetId={MICROM_SPREADSHEET_ID}
              updatedAt={new Date().toISOString()}
            />
          )}
        </div>
      </main>
    </>
  );
}
