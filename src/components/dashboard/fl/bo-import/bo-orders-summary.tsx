"use client";

import {
  CheckCircle2Icon,
  DownloadIcon,
  ExternalLinkIcon,
  Loader2Icon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { getBoSheetDestination } from "@/lib/fl/bo-import-config";

export interface ImportedSheetResult {
  insertedCount?: number;
  updatedCount?: number;
  replacedCount?: number;
  preservedCount?: number;
  skippedCount?: number;
  conflictCount?: number;
  newCount?: number;
  totalSheetRows: number;
  verifiedMonth?: string;
}

export interface GenericValidationSummary {
  fileName: string;
  fileSizeBytes: number;
  totalSourceRows?: number;
  validRowsCount?: number;
  errorRowsCount?: number;
  duplicateOrderIds?: string[];
  duplicateTransactionIds?: string[];
  multiItemOrdersCount?: number;
  verifiedMonth?: string;
  verifiedMonthLabel?: string;
  detectedTypes?: Record<string, number>;
  totalOrdersCount?: number;
  mapped97DecorCount?: number;
  outOfScopeCount?: number;
  unmappedCount?: number;
  conflictCount?: number;
  alreadyInCogsCount?: number;
  identicalCostCount?: number;
  diffCostCount?: number;
  mathDiscrepanciesCount?: number;
  newCount?: number;
  unchangedCount?: number;
  changedCount?: number;
  duplicateCount?: number;
  blocked?: boolean;
  previewToken?: string;
  validationDetails?: import("@/lib/fl/cogs-parser/types").CogsValidationDetail[];
  decisions?: import("@/lib/fl/cogs-parser/import-plan").CogsDecision[];
  warnings: string[];
}

interface BoOrdersSummaryProps {
  boId?: string;
  summary: GenericValidationSummary;
  downloading: boolean;
  onDownloadXlsx: () => void;
  importedResult: ImportedSheetResult | null;
  reportType?: "ORDERS" | "ITEMS" | "STATEMENTS" | "COGS";
}

export function BoOrdersSummary({
  summary,
  downloading,
  onDownloadXlsx,
  importedResult,
  reportType = "ORDERS",
  boId = "ms-linh",
}: BoOrdersSummaryProps) {
  const isItems = reportType === "ITEMS";
  const isStatement = reportType === "STATEMENTS";
  const isCogs = reportType === "COGS";

  const destination = getBoSheetDestination(boId);
  const targetSheetId = isCogs
    ? 58221536
    : isStatement
      ? destination.statementSheetId
      : isItems
        ? destination.itemsSheetId
        : destination.ordersSheetId;
  const targetSpreadsheetUrl = `https://docs.google.com/spreadsheets/d/${destination.spreadsheetId}/edit#gid=${targetSheetId}`;

  const tabName = isCogs
    ? "RAW.COGS"
    : isStatement
      ? "RAW.Statement"
      : isItems
        ? "RAW.Items"
        : "RAW.Orders";

  const targetColCount = isCogs
    ? "14 cột"
    : isStatement
      ? "10 cột"
      : isItems
        ? "34 cột"
        : "37 cột";

  const duplicateCount = isItems
    ? (summary.duplicateTransactionIds?.length ?? 0)
    : (summary.duplicateOrderIds?.length ?? 0);
  const duplicateLabel = isItems ? "Tx ID trùng" : "Order ID trùng";

  return (
    <div className="space-y-3">
      {/* Tóm tắt kết quả kiểm tra */}
      <div className="rounded-lg border bg-emerald-500/5 p-4 border-emerald-500/20 space-y-3">
        <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium text-xs">
          <CheckCircle2Icon className="size-4 shrink-0" />
          <span>
            {isCogs
              ? `Đã phân tích ${summary.totalOrdersCount ?? 0} đơn Equarus và đối chiếu sang ${targetColCount} ${tabName}.`
              : `Cấu trúc file hợp lệ! Đã ánh xạ thành công sang ${targetColCount} ${tabName}.`}
          </span>
        </div>

        {isCogs ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded bg-background p-2 border border-border/50">
              <span className="text-muted-foreground text-[11px] block">
                Khớp shop Ms. Linh
              </span>
              <strong className="text-foreground text-sm font-semibold tabular-nums text-emerald-600">
                {summary.mapped97DecorCount ?? 0} đơn
              </strong>
            </div>
            <div className="rounded bg-background p-2 border border-border/50">
              <span className="text-muted-foreground text-[11px] block">
                Ngoài phạm vi (Timond)
              </span>
              <strong className="text-foreground text-sm font-semibold tabular-nums text-amber-600">
                {summary.outOfScopeCount ?? 0} đơn
              </strong>
            </div>
            <div className="rounded bg-background p-2 border border-border/50">
              <span className="text-muted-foreground text-[11px] block">
                Chưa map Store
              </span>
              <strong className="text-foreground text-sm font-semibold tabular-nums text-rose-600">
                {summary.unmappedCount ?? 0} đơn
              </strong>
            </div>
            <div className="rounded bg-background p-2 border border-border/50">
              <span className="text-muted-foreground text-[11px] block">
                Đã có trên Sheet COGS
              </span>
              <strong className="text-foreground text-sm font-semibold tabular-nums text-blue-600">
                {summary.alreadyInCogsCount ?? 0} /{" "}
                {summary.totalOrdersCount ?? 0}
              </strong>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div className="rounded bg-background p-2 border border-border/50">
              <span className="text-muted-foreground text-[11px] block">
                Dòng hợp lệ
              </span>
              <strong className="text-foreground text-sm font-semibold tabular-nums">
                {(summary.validRowsCount ?? 0).toLocaleString("vi-VN")}
              </strong>
            </div>
            <div className="rounded bg-background p-2 border border-border/50">
              <span className="text-muted-foreground text-[11px] block">
                Dòng lỗi
              </span>
              <strong className="text-foreground text-sm font-semibold tabular-nums">
                {summary.errorRowsCount ?? 0}
              </strong>
            </div>

            {isStatement ? (
              <>
                <div className="rounded bg-background p-2 border border-border/50">
                  <span className="text-muted-foreground text-[11px] block">
                    Tháng xác minh
                  </span>
                  <strong className="text-foreground text-sm font-semibold tabular-nums">
                    {summary.verifiedMonthLabel ||
                      summary.verifiedMonth ||
                      "N/A"}
                  </strong>
                </div>
                <div className="rounded bg-background p-2 border border-border/50">
                  <span className="text-muted-foreground text-[11px] block">
                    Tổng dòng nguồn
                  </span>
                  <strong className="text-foreground text-sm font-semibold tabular-nums">
                    {(summary.totalSourceRows ?? 0).toLocaleString("vi-VN")}
                  </strong>
                </div>
              </>
            ) : (
              <>
                <div className="rounded bg-background p-2 border border-border/50">
                  <span className="text-muted-foreground text-[11px] block">
                    {duplicateLabel}
                  </span>
                  <strong className="text-foreground text-sm font-semibold tabular-nums">
                    {duplicateCount}
                  </strong>
                </div>
                {isItems ? (
                  <div className="rounded bg-background p-2 border border-border/50">
                    <span className="text-muted-foreground text-[11px] block">
                      Đơn nhiều item
                    </span>
                    <strong className="text-foreground text-sm font-semibold tabular-nums">
                      {summary.multiItemOrdersCount ?? 0}
                    </strong>
                  </div>
                ) : (
                  <div className="rounded bg-background p-2 border border-border/50">
                    <span className="text-muted-foreground text-[11px] block">
                      Tổng dòng nguồn
                    </span>
                    <strong className="text-foreground text-sm font-semibold tabular-nums">
                      {summary.totalSourceRows}
                    </strong>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {summary.detectedTypes &&
          Object.keys(summary.detectedTypes).length > 0 && (
            <div className="rounded bg-background/50 p-2 border border-border/50 text-[11px] flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-muted-foreground font-medium">
                Phân bổ loại:
              </span>
              {Object.entries(summary.detectedTypes).map(([type, count]) => (
                <span key={type} className="inline-flex items-center gap-1">
                  <span className="font-semibold text-foreground">{type}:</span>
                  <span className="text-muted-foreground tabular-nums">
                    {count.toLocaleString("vi-VN")}
                  </span>
                </span>
              ))}
            </div>
          )}

        {summary.warnings.length > 0 && (
          <div className="space-y-1 text-[11px] text-amber-700 dark:text-amber-300">
            {summary.warnings.map((w) => (
              <p key={w}>⚠️ {w}</p>
            ))}
          </div>
        )}

        <div className="pt-1 flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={onDownloadXlsx}
            disabled={downloading}
            className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
          >
            {downloading ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <DownloadIcon className="size-3.5" />
            )}
            <span>
              {isCogs
                ? "Tải xuống XLSX preview (5 tabs: Mapped, Validation, Existing, Payment checks, Import review)"
                : `Tải xuống XLSX chuẩn hóa (${tabName})`}
            </span>
          </Button>
        </div>
      </div>

      {/* Thông báo kết quả nạp Google Sheet */}
      {importedResult && (
        <div className="rounded-lg border bg-purple-500/10 p-4 border-purple-500/30 text-purple-900 dark:text-purple-200 text-xs space-y-1.5">
          <div className="flex items-center gap-2 font-semibold text-purple-700 dark:text-purple-300">
            <CheckCircle2Icon className="size-4 shrink-0" />
            <span>
              {isCogs &&
              !(importedResult.insertedCount || importedResult.updatedCount)
                ? "Không ghi dữ liệu: không có dòng mới hoặc cập nhật được duyệt."
                : `Đã nạp thành công vào tab ${tabName} trên Google Sheet!`}
            </span>
          </div>
          {isStatement ? (
            <p className="text-[11px] text-muted-foreground pl-6">
              Ghi mới:{" "}
              <strong className="text-foreground">
                {(
                  importedResult.newCount ??
                  importedResult.insertedCount ??
                  0
                ).toLocaleString("vi-VN")}
              </strong>{" "}
              dòng · Thay thế tháng cũ:{" "}
              <strong className="text-foreground">
                {(
                  importedResult.replacedCount ??
                  importedResult.updatedCount ??
                  0
                ).toLocaleString("vi-VN")}
              </strong>{" "}
              dòng · Bảo toàn shop khác:{" "}
              <strong className="text-foreground">
                {(importedResult.preservedCount ?? 0).toLocaleString("vi-VN")}
              </strong>{" "}
              dòng · Tổng số dòng trong tab:{" "}
              <strong className="text-foreground">
                {(importedResult.totalSheetRows ?? 0).toLocaleString("vi-VN")}
              </strong>
              .
            </p>
          ) : isCogs ? (
            <p className="text-[11px] text-muted-foreground pl-6">
              Thêm mới:{" "}
              <strong className="text-foreground">
                {(importedResult.insertedCount ?? 0).toLocaleString("vi-VN")}
              </strong>{" "}
              đơn · Bỏ qua (Đã tồn tại & khớp chi phí):{" "}
              <strong className="text-foreground">
                {(importedResult.skippedCount ?? 0).toLocaleString("vi-VN")}
              </strong>{" "}
              đơn · Cập nhật thay đổi:{" "}
              <strong className="text-foreground">
                {(importedResult.updatedCount ?? 0).toLocaleString("vi-VN")}
              </strong>{" "}
              đơn.
            </p>
          ) : (
            <p className="text-[11px] text-muted-foreground pl-6">
              Thêm mới:{" "}
              <strong className="text-foreground">
                {(importedResult.insertedCount ?? 0).toLocaleString("vi-VN")}
              </strong>{" "}
              dòng · Cập nhật:{" "}
              <strong className="text-foreground">
                {(importedResult.updatedCount ?? 0).toLocaleString("vi-VN")}
              </strong>{" "}
              dòng · Tổng số dòng trong tab:{" "}
              <strong className="text-foreground">
                {(importedResult.totalSheetRows ?? 0).toLocaleString("vi-VN")}
              </strong>
              .
            </p>
          )}
          <div className="pl-6 pt-1">
            <a
              href={targetSpreadsheetUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 font-medium text-purple-700 underline underline-offset-4 hover:text-purple-800 dark:text-purple-300 text-[11px]"
            >
              <span>Mở tab {tabName} trên Google Sheet</span>
              <ExternalLinkIcon className="size-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
