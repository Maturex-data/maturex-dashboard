"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { BoOrdersForm } from "@/components/dashboard/fl/bo-import/bo-orders-form";
import { FastwaySyncCard } from "@/components/dashboard/fl/bo-import/fastway-sync-card";
import { FolderImport } from "@/components/dashboard/fl/bo-import/folder-import";
import { PrintifySyncCard } from "@/components/dashboard/fl/bo-import/printify-sync-card";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BO_QUERY_PARAM,
  type BoGroup,
  getBoSheetDestination,
} from "@/lib/fl/bo-import-config";
import { cn } from "@/lib/utils";

interface BoStatementImportProps {
  groups: BoGroup[];
  activeBoId: string;
}

export function BoStatementImport({
  groups,
  activeBoId,
}: BoStatementImportProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [optimisticBoId, setOptimisticBoId] = useOptimistic(activeBoId);

  function handleBoChange(nextBoId: string) {
    if (nextBoId === optimisticBoId) return;
    const params = new URLSearchParams(searchParams.toString());
    params.set(BO_QUERY_PARAM, nextBoId);
    startTransition(() => {
      setOptimisticBoId(nextBoId);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    });
  }

  return (
    <Tabs
      value={optimisticBoId}
      onValueChange={(value) => handleBoChange(String(value))}
      className="gap-4"
    >
      <Card size="sm" className="rounded-xl shadow-none ring-border/70">
        <CardHeader className="flex flex-col gap-4 px-5 py-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Nhóm BO</CardTitle>
            <CardDescription className="text-xs">
              Mỗi nhóm BO chỉ hiển thị các shop thuộc nhóm đó.
            </CardDescription>
          </div>
          <TabsList
            aria-label="Chọn nhóm BO"
            className="overflow-hidden rounded-lg p-1 group-data-horizontal/tabs:h-10"
          >
            {groups.map((group) => (
              <TabsTrigger
                key={group.id}
                value={group.id}
                className="rounded-md px-5 data-active:text-emerald-700 dark:data-active:text-emerald-400"
              >
                {group.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </CardHeader>
      </Card>

      {groups.map((group) => (
        <TabsContent
          key={group.id}
          value={group.id}
          className={cn(isPending && "opacity-70 transition-opacity")}
        >
          <div className="space-y-5">
            {group.id === "mr-phuc" && <PrintifySyncCard />}
            {group.id === "ms-linh" && <FastwaySyncCard />}
            {
              <div className="space-y-5">
                <a
                  href={`https://docs.google.com/spreadsheets/d/${getBoSheetDestination(group.id).spreadsheetId}/edit`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex text-sm text-emerald-700 underline underline-offset-4 dark:text-emerald-400"
                >
                  Mở Google Sheet đích · {group.name}
                </a>
                <FolderImport key={`folder-${group.id}`} group={group} />
                <BoOrdersForm key={`file-${group.id}`} group={group} />
              </div>
            }
          </div>
        </TabsContent>
      ))}
    </Tabs>
  );
}
