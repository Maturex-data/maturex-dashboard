import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { EcProgressReport } from "@/components/dashboard/ec/ec-progress-report";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";
import type { EcProgressSheetData } from "@/lib/ec-progress-report-types";
import {
  EcProgressSheetError,
  getEcProgressSheetTables,
} from "@/lib/ec-progress-sheet";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export const metadata: Metadata = {
  title: "Tiến độ & KPI | EC Team",
  description: "Theo dõi tiến độ kinh doanh và KPI ngày của EC Team.",
};

export default async function EcProgressPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;

  if (!user) redirect("/auth/login");

  let data: EcProgressSheetData = {
    tables: [],
    lastUpdatedAt: "",
  };
  let error: string | null = null;

  try {
    data = await getEcProgressSheetTables();
  } catch (cause) {
    error =
      cause instanceof EcProgressSheetError
        ? cause.message
        : "Không tải được dữ liệu tiến độ. Vui lòng thử lại.";
  }

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center border-b border-border/60 bg-background/80 px-3 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <Separator
            orientation="vertical"
            className="data-vertical:h-4 data-vertical:self-auto bg-border/60"
          />
          <span className="truncate text-sm font-medium">EC Team</span>
          <span className="text-muted-foreground/50">/</span>
          <span className="truncate text-sm text-muted-foreground">
            Tiến độ & KPI
          </span>
        </div>
      </header>
      <main className="flex w-full min-w-0 flex-1 flex-col gap-5 p-3 sm:p-6">
        <div className="flex items-start gap-3 border-b border-border/60 pb-5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300">
            <span aria-hidden="true" className="text-sm font-bold">
              EC
            </span>
          </span>
          <div>
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              Tiến độ kinh doanh & KPI
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Dữ liệu đọc trực tiếp từ Google Sheet EC, không chỉnh sửa nguồn.
            </p>
          </div>
        </div>
        <section className="overflow-hidden rounded-lg border border-border/60 bg-card shadow-xs">
          <EcProgressReport
            initialData={data}
            initialError={error}
            spreadsheetId={REPORT_SPREADSHEET_ID}
          />
        </section>
      </main>
    </>
  );
}
