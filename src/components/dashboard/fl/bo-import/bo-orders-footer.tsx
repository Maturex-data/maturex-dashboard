"use client";

import { Loader2Icon, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import type { BoGroup, BoShopOption } from "@/lib/fl/bo-import-config";
import type { GenericValidationSummary } from "./bo-orders-summary";

interface BoOrdersFooterProps {
  group: BoGroup;
  selectedShop?: BoShopOption;
  reportType?: "ORDERS" | "ITEMS" | "STATEMENTS" | "COGS";
  summary: GenericValidationSummary | null;
  importing: boolean;
  onImportToSheet: () => void;
}

export function BoOrdersFooter({
  group,
  selectedShop,
  reportType = "ORDERS",
  summary,
  importing,
  onImportToSheet,
}: BoOrdersFooterProps) {
  const isItems = reportType === "ITEMS";
  const isStatement = reportType === "STATEMENTS";
  const isCogs = reportType === "COGS";

  const dataTypeLabel = isCogs
    ? "COGS Equarus"
    : isStatement
      ? "Etsy Payment Statement"
      : isItems
        ? "Etsy Sold Order Items"
        : "Etsy Sold Orders";

  // Only enable COGS writes for a signed preview without blocking errors.
  const isCogsLocked =
    isCogs && (!summary?.previewToken || summary.blocked === true);

  const isImportDisabled =
    isCogsLocked ||
    !summary ||
    (summary.validRowsCount ?? summary.mapped97DecorCount ?? 0) === 0 ||
    (summary.errorRowsCount ?? 0) > 0 ||
    importing;

  const rowUnit = isCogs
    ? "đơn"
    : isStatement
      ? "giao dịch"
      : isItems
        ? "item"
        : "đơn";

  let buttonText = "Import vào Google Sheet";
  if (isCogs) {
    buttonText = importing
      ? "Đang ghi..."
      : isCogsLocked
        ? "Cần xử lý lỗi preview"
        : "Ghi dòng mới và tự cập nhật thay đổi";
  } else if (importing) {
    buttonText = "Đang ghi vào Google Sheet...";
  } else if (summary) {
    buttonText = `Import ${(summary.validRowsCount ?? summary.mapped97DecorCount ?? 0).toLocaleString("vi-VN")} ${rowUnit} vào Google Sheet`;
  }

  const validDisplayCount = isCogs
    ? summary
      ? `${summary.mapped97DecorCount ?? 0} đơn thuộc Ms. Linh`
      : "Chưa kiểm tra"
    : summary
      ? (summary.validRowsCount ?? 0).toLocaleString("vi-VN")
      : "Chưa kiểm tra";

  return (
    <CardFooter className="flex flex-col gap-4 border-t bg-muted/30 p-5 lg:flex-row lg:items-center lg:justify-between">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:flex lg:gap-8">
        <div>
          <dt className="text-xs text-muted-foreground">Nhóm BO</dt>
          <dd className="font-medium">{group.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Shop</dt>
          <dd className="font-medium">
            {isCogs
              ? group.shops.map((shop) => shop.name).join(" · ")
              : (selectedShop?.name ?? "97Decor")}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Dữ liệu</dt>
          <dd className="font-medium">{dataTypeLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Dòng hợp lệ</dt>
          <dd className="font-medium tabular-nums">{validDisplayCount}</dd>
        </div>
      </dl>

      <div className="flex flex-col items-end gap-1.5 sm:flex-row sm:items-center">
        {isCogs && (
          <span className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
            Tự cập nhật các cột nguồn thay đổi; giữ các cột nguồn không cung cấp
          </span>
        )}
        <Button
          type="button"
          disabled={isImportDisabled}
          onClick={onImportToSheet}
          className={`h-10 gap-2 px-5 font-semibold text-white disabled:cursor-not-allowed ${
            isCogs
              ? "bg-muted-foreground/50 hover:bg-muted-foreground/50 text-white"
              : "bg-purple-600 hover:bg-purple-700"
          }`}
        >
          {importing ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <UploadCloudIcon className="size-4" />
          )}
          <span>{buttonText}</span>
        </Button>
      </div>
    </CardFooter>
  );
}
