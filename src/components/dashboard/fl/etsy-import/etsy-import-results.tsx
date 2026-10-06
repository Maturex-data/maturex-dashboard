"use client";

import { RotateCcwIcon } from "lucide-react";
import {
  type ImportResult,
  reportLabels,
} from "@/components/dashboard/fl/etsy-import/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface EtsyImportResultsProps {
  results: ImportResult[];
  onClearResults: () => void;
}

function statusBadge(status: string) {
  if (status === "COMPLETED") {
    return <Badge className="bg-emerald-50 text-emerald-700">Hoàn tất</Badge>;
  }
  if (status === "SKIPPED") {
    return <Badge variant="secondary">Đã có</Badge>;
  }
  if (status === "FAILED") {
    return <Badge variant="destructive">Lỗi</Badge>;
  }
  if (status === "PROCESSING") {
    return <Badge className="bg-blue-50 text-blue-700">Đang xử lý</Badge>;
  }
  return <Badge variant="outline">{status}</Badge>;
}

export function EtsyImportResults({
  results,
  onClearResults,
}: EtsyImportResultsProps) {
  if (results.length === 0) return null;

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between border-b px-5 py-3">
        <CardTitle className="text-sm font-medium">
          Kết quả lần import này
        </CardTitle>
        <Button size="sm" variant="ghost" onClick={onClearResults}>
          <RotateCcwIcon className="size-3.5" />
          Đóng
        </Button>
      </CardHeader>
      <CardContent className="divide-y p-0">
        {results.map((result, index) => (
          <div
            key={`${result.relativePath || result.fileName}-${result.shopCode || ""}-${result.reportType}-${index}`}
            className="grid gap-2 px-5 py-3 text-sm md:grid-cols-[minmax(0,1fr)_120px_100px_100px] md:items-center"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate font-medium">{result.fileName}</p>
                {result.shopCode && (
                  <Badge
                    variant="outline"
                    className="text-[10px] text-purple-600 border-purple-500/30"
                  >
                    {result.shopCode}
                  </Badge>
                )}
              </div>
              {result.relativePath &&
                result.relativePath !== result.fileName && (
                  <p className="truncate text-[11px] text-muted-foreground/70">
                    📁 {result.relativePath}
                  </p>
                )}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {result.message}
              </p>
            </div>
            <span className="text-muted-foreground">
              {reportLabels[result.reportType] ?? result.reportType}
            </span>
            <span className="tabular-nums">
              {result.insertedRows.toLocaleString("vi-VN")} dòng
            </span>
            <div>{statusBadge(result.status)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
