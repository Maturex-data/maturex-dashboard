import { ArrowLeftIcon, SparklesIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { BoStatementImport } from "@/components/dashboard/fl/bo-statement-import";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  BO_QUERY_PARAM,
  getBoGroups,
  resolveBoId,
} from "@/lib/fl/bo-import-config";

export const metadata = {
  title: "ECOMBIUS - Import theo BO",
  description:
    "Import Orders, Items, Statement và COGS theo nhóm BO cho ECOMBIUS.",
};

export default async function EcombiusBoImportPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const query = await searchParams;
  const activeBoId = resolveBoId(query[BO_QUERY_PARAM]);
  const groups = getBoGroups();

  return (
    <>
      <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/80 px-4 backdrop-blur-md sm:px-6">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <SidebarTrigger className="-ml-1 shrink-0 text-muted-foreground hover:text-foreground" />
          <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-zinc-950 text-emerald-400 shadow-2xs">
            <SparklesIcon className="size-3.5" />
          </div>
          <Breadcrumb className="text-xs">
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink render={<Link href="/ecombius" />}>
                  ECOMBIUS
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>Import theo BO</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-6 overflow-x-hidden bg-muted/20 p-4 sm:p-6 lg:p-8">
        <section className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-semibold text-2xl tracking-tight sm:text-3xl">
                Import theo BO
              </h1>
            </div>
            <p className="mt-1 text-muted-foreground text-sm">
              Tập trung dữ liệu từng shop và chi phí nhà cung cấp vào Google
              Sheets.
            </p>
          </div>
          <Link href="/ecombius" className="shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
              tabIndex={-1}
            >
              <ArrowLeftIcon className="size-3.5" />
              Về ECOMBIUS
            </Button>
          </Link>
        </section>

        <Suspense fallback={null}>
          <BoStatementImport groups={groups} activeBoId={activeBoId} />
        </Suspense>
      </main>
    </>
  );
}
