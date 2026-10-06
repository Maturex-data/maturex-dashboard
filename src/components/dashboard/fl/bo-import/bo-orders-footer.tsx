"use client";

import { Loader2Icon, UploadCloudIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CardFooter } from "@/components/ui/card";
import type { BoGroup, BoShopOption } from "@/lib/fl/bo-import-config";
import type { GenericValidationSummary } from "./bo-orders-summary";

interface BoOrdersFooterProps {
  group: BoGroup;
  selectedShop?: BoShopOption;
  reportType?: "ORDERS" | "ITEMS" | "STATEMENTS";
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

  const dataTypeLabel = isStatement
    ? "Etsy Payment Statement"
    : isItems
      ? "Etsy Sold Order Items"
      : "Etsy Sold Orders";

  // Mở khóa import cho cả Orders, Items và Statement khi file hợp lệ
  const isImportDisabled =
    !summary ||
    summary.validRowsCount === 0 ||
    summary.errorRowsCount > 0 ||
    importing;

  const rowUnit = isStatement ? "giao dịch" : isItems ? "item" : "đơn";
  const buttonText = importing
    ? "Đang ghi vào Google Sheet..."
    : summary
      ? `Import ${summary.validRowsCount.toLocaleString("vi-VN")} ${rowUnit} vào Google Sheet`
      : "Import vào Google Sheet";

  return (
    <CardFooter className="flex flex-col gap-4 border-t bg-muted/30 p-5 lg:flex-row lg:items-center lg:justify-between">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:flex lg:gap-8">
        <div>
          <dt className="text-xs text-muted-foreground">Nhóm BO</dt>
          <dd className="font-medium">{group.name}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Shop</dt>
          <dd className="font-medium">{selectedShop?.name ?? "97Decor"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Dữ liệu</dt>
          <dd className="font-medium">{dataTypeLabel}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Dòng hợp lệ</dt>
          <dd className="font-medium tabular-nums">
            {summary ? summary.validRowsCount : "Chưa kiểm tra"}
          </dd>
        </div>
      </dl>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Button
          type="button"
          disabled={isImportDisabled}
          onClick={onImportToSheet}
          className="h-10 gap-2 bg-purple-600 px-5 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed"
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
