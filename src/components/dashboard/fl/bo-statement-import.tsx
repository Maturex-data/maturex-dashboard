"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useOptimistic, useTransition } from "react";
import { BoStatementForm } from "@/components/dashboard/fl/bo-import/bo-statement-form";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BO_QUERY_PARAM, type BoGroup } from "@/lib/fl/bo-import-config";
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
      <Card size="sm">
        <CardHeader className="flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-sm">Nhóm BO</CardTitle>
            <CardDescription className="text-xs">
              Mỗi nhóm BO chỉ hiển thị các shop thuộc nhóm đó.
            </CardDescription>
          </div>
          <TabsList
            aria-label="Chọn nhóm BO"
            className="h-9 p-1 overflow-hidden"
          >
            {groups.map((group) => (
              <TabsTrigger
                key={group.id}
                value={group.id}
                className="px-3 data-active:text-purple-700"
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
          {/* key theo BO: đổi BO sẽ reset shop và danh sách file */}
          <BoStatementForm key={group.id} group={group} />
        </TabsContent>
      ))}
    </Tabs>
  );
}
