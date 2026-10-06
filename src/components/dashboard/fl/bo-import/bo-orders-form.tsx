"use client";

import {
  AlertCircleIcon,
  FileSpreadsheetIcon,
  InfoIcon,
  Loader2Icon,
  XIcon,
} from "lucide-react";
import { useId, useState } from "react";
import { BoFileDropzone } from "@/components/dashboard/fl/bo-import/bo-file-dropzone";
import { BoOrdersFooter } from "@/components/dashboard/fl/bo-import/bo-orders-footer";
import {
  BoOrdersSummary,
  type GenericValidationSummary,
  type ImportedSheetResult,
} from "@/components/dashboard/fl/bo-import/bo-orders-summary";
import { formatSize } from "@/components/dashboard/fl/bo-import/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BoGroup } from "@/lib/fl/bo-import-config";
import { CogsReview } from "./cogs-review";

interface BoOrdersFormProps {
  group: BoGroup;
}

export type BoReportType = "ORDERS" | "ITEMS" | "STATEMENTS" | "COGS";

export function BoOrdersForm({ group }: BoOrdersFormProps) {
  const baseId = useId();
  const shopSelectId = `${baseId}-shop`;
  const reportTypeSelectId = `${baseId}-report-type`;
  const fileInputId = `${baseId}-file`;

  const [shopCode, setShopCode] = useState<string>(
    group.shops[0]?.code ?? "97DECOR",
  );
  const [reportType, setReportType] = useState<BoReportType>("ORDERS");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [validating, setValidating] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [summary, setSummary] = useState<GenericValidationSummary | null>(null);
  const [importedResult, setImportedResult] =
    useState<ImportedSheetResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const selectedShop = group.shops.find((s) => s.code === shopCode);
  const isItems = reportType === "ITEMS";
  const isStatement = reportType === "STATEMENTS";
  const isCogs = reportType === "COGS";

  let reportTitle = `Etsy Sold Orders · ${group.name}`;
  let reportBadge = "37 cột RAW.Orders";
  let validatingText = "Đang kiểm tra 36 header và ánh xạ sang RAW.Orders...";

  if (isCogs) {
    reportTitle = `COGS Equarus · ${group.name}`;
    reportBadge = "14 cột RAW.COGS";
    validatingText =
      "Đang đọc Order Management, kiểm tra Orders và Store, đối chiếu RAW.COGS...";
  } else if (isStatement) {
    reportTitle = `Etsy Payment Statement · ${group.name}`;
    reportBadge = "10 cột RAW.Statement";
    validatingText = "Đang kiểm tra 9 header và ánh xạ sang RAW.Statement...";
  } else if (isItems) {
    reportTitle = `Etsy Sold Order Items · ${group.name}`;
    reportBadge = "34 cột RAW.Items";
    validatingText = "Đang kiểm tra 33 header và ánh xạ sang RAW.Items...";
  }

  function getApiEndpoint() {
    if (isCogs) return "/api/fl/bo-cogs/preview";
    if (isStatement) return "/api/fl/bo-statement/preview";
    if (isItems) return "/api/fl/bo-items/preview";
    return "/api/fl/bo-orders/preview";
  }

  function handleReportTypeChange(val: string | null) {
    const nextType: BoReportType =
      val === "COGS"
        ? "COGS"
        : val === "STATEMENTS"
          ? "STATEMENTS"
          : val === "ITEMS"
            ? "ITEMS"
            : "ORDERS";
    setReportType(nextType);
    setSelectedFile(null);
    setSummary(null);
    setImportedResult(null);
    setErrorMessage("");
  }

  async function handleFileSelected(files: File[]) {
    if (files.length === 0) return;
    const file = files[0];
    setSelectedFile(file);
    setSummary(null);
    setImportedResult(null);
    setErrorMessage("");
    setValidating(true);

    try {
      const endpoint = getApiEndpoint();
      const formData = new FormData();
      formData.set("file", file);
      formData.set("shopCode", isCogs ? "ALL" : shopCode);
      formData.set("boId", group.id);
      formData.set("action", "validate");

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Không thể phân tích file.");
      }

      setSummary(data.summary);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Đã xảy ra lỗi khi kiểm tra file.",
      );
    } finally {
      setValidating(false);
    }
  }

  function handleClearFile() {
    setSelectedFile(null);
    setSummary(null);
    setImportedResult(null);
    setErrorMessage("");
  }

  async function handleImportToSheet() {
    if (!selectedFile || !summary) return;
    setImporting(true);
    setErrorMessage("");

    try {
      const endpoint = getApiEndpoint();
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("shopCode", isCogs ? "ALL" : shopCode);
      formData.set("boId", group.id);
      formData.set("action", "import");
      if (isCogs) {
        formData.set("previewToken", summary.previewToken || "");
        formData.set("approvedKeys", "[]");
      }

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(
          data.error || "Không thể ghi dữ liệu vào Google Sheet.",
        );
      }

      setImportedResult(data.importResult);
      if (isCogs) {
        setSummary((prev) =>
          prev ? { ...prev, previewToken: undefined } : null,
        );
      }
    } catch (err) {
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "Đã xảy ra lỗi khi ghi dữ liệu vào Google Sheet.",
      );
    } finally {
      setImporting(false);
    }
  }

  async function handleDownloadXlsx() {
    if (!selectedFile) return;
    setDownloading(true);

    try {
      const endpoint = getApiEndpoint();
      const formData = new FormData();
      formData.set("file", selectedFile);
      formData.set("shopCode", isCogs ? "ALL" : shopCode);
      formData.set("boId", group.id);
      formData.set("action", "download");

      const res = await fetch(endpoint, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Không thể tạo file XLSX.");
      }

      const dateStr = new Date().toISOString().slice(0, 10);
      let downloadFilename = `linh-97decor-orders-preview-${dateStr}.xlsx`;
      if (isCogs) {
        downloadFilename = `linh-97decor-cogs-preview-${dateStr}.xlsx`;
      } else if (isStatement) {
        downloadFilename = `linh-97decor-statement-preview-${dateStr}.xlsx`;
      } else if (isItems) {
        downloadFilename = `linh-97decor-items-preview-${dateStr}.xlsx`;
      }

      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : "Lỗi khi tải file XLSX.",
      );
    } finally {
      setDownloading(false);
    }
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b py-4">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <span>{reportTitle}</span>
            <Badge
              variant="outline"
              className="text-purple-600 border-purple-500/30 bg-purple-500/10 text-[10px]"
            >
              {reportBadge}
            </Badge>
          </CardTitle>
          <CardDescription className="text-xs">
            {group.shops.map((shop) => shop.name).join(" · ")}
          </CardDescription>
        </div>
        <Badge variant="outline">
          {isCogs ? "Excel (XLSX)" : "CSV (RFC 4180)"}
        </Badge>
      </CardHeader>

      <CardContent className="grid gap-6 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300 lg:col-span-2">
          <p className="font-semibold text-red-800 dark:text-red-200">
            Thứ tự khuyến nghị: Orders → Items → Statement → COGS
          </p>
          <p className="mt-1">
            Items và COGS cần có Orders tương ứng, đúng Store. Statement import
            độc lập; không cần đủ Items hoặc Statement để import COGS.
          </p>
        </div>
        {/* Cột trái: Shop & Loại dữ liệu */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={isCogs ? undefined : shopSelectId}>
              {isCogs ? "Phạm vi COGS" : "Shop"}
            </Label>
            {isCogs ? (
              <div className="rounded-md border bg-muted/30 p-3 text-xs">
                <p className="font-medium">
                  File chung ·{" "}
                  {group.shops.map((shop) => shop.name).join(" · ")}
                </p>
                <p className="mt-1 text-muted-foreground">
                  Store đối chiếu theo từng đơn với Orders. Cần import Orders
                  trước COGS.
                </p>
              </div>
            ) : (
              <Select
                value={shopCode}
                onValueChange={(val) => {
                  setShopCode(val ? String(val) : "");
                  setSummary(null);

                  setImportedResult(null);
                  setErrorMessage("");
                }}
              >
                <SelectTrigger
                  id={shopSelectId}
                  className="w-full h-10 text-xs"
                >
                  <SelectValue placeholder="Chọn shop" />
                </SelectTrigger>
                <SelectContent>
                  {group.shops.map((shop) => (
                    <SelectItem
                      key={shop.code}
                      value={shop.code}
                      className="text-xs"
                    >
                      {shop.name} ({shop.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <p className="text-[11px] text-muted-foreground">
              Phụ trách shop {group.shops.map((shop) => shop.name).join(" · ")}.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor={reportTypeSelectId}>Loại dữ liệu</Label>
            <Select value={reportType} onValueChange={handleReportTypeChange}>
              <SelectTrigger
                id={reportTypeSelectId}
                className="w-full h-10 text-xs"
              >
                <SelectValue placeholder="Chọn loại dữ liệu" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ORDERS" className="text-xs font-medium">
                  Etsy Sold Orders (37 cột RAW.Orders)
                </SelectItem>
                <SelectItem value="ITEMS" className="text-xs font-medium">
                  Etsy Sold Order Items (34 cột RAW.Items)
                </SelectItem>
                <SelectItem value="STATEMENTS" className="text-xs font-medium">
                  Etsy Payment Statement (10 cột RAW.Statement)
                </SelectItem>
                <SelectItem value="COGS" className="text-xs font-medium">
                  COGS Equarus (14 cột RAW.COGS)
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCogs ? (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <div>
                <strong className="block font-semibold">
                  Cần import Orders trước để xác định shop.
                </strong>
                Tự động ánh xạ 14 cột RAW.COGS, đối chiếu các đơn hiện có và
                kiểm tra chênh lệch thanh toán.
              </div>
            </div>
          ) : isStatement ? (
            <div className="flex gap-2 rounded-lg border border-purple-500/30 bg-purple-50/70 p-3 text-xs leading-relaxed text-purple-900 dark:bg-purple-500/10 dark:text-purple-200">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Đã mở khóa import: Tự động ánh xạ 10 cột và cập nhật vào tab
                RAW.Statement trên Google Sheet (Thay thế an toàn theo tháng xác
                minh).
              </p>
            </div>
          ) : isItems ? (
            <div className="flex gap-2 rounded-lg border border-purple-500/30 bg-purple-50/70 p-3 text-xs leading-relaxed text-purple-900 dark:bg-purple-500/10 dark:text-purple-200">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Đã mở khóa import: Tự động ánh xạ 34 cột và cập nhật vào tab
                RAW.Items trên Google Sheet (Upsert theo Transaction ID).
              </p>
            </div>
          ) : (
            <div className="flex gap-2 rounded-lg border border-purple-500/30 bg-purple-50/70 p-3 text-xs leading-relaxed text-purple-900 dark:bg-purple-500/10 dark:text-purple-200">
              <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
              <p>
                Đã mở khóa import: Tự động ánh xạ 37 cột và cập nhật vào tab
                RAW.Orders trên Google Sheet (Upsert theo Order ID).
              </p>
            </div>
          )}
        </div>

        {/* Cột phải: Chọn file & Kết quả kiểm tra */}
        <div className="min-w-0 space-y-4">
          {!selectedFile ? (
            <BoFileDropzone
              id={fileInputId}
              errors={errorMessage ? [errorMessage] : []}
              onAddFiles={handleFileSelected}
            />
          ) : (
            <div className="space-y-3">
              {/* Box file đã chọn */}
              <div className="flex items-center justify-between rounded-lg border bg-card p-3 text-xs">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileSpreadsheetIcon className="size-4 shrink-0 text-emerald-600" />
                  <div className="flex flex-col min-w-0">
                    <span
                      className="truncate font-medium"
                      title={selectedFile.name}
                    >
                      {selectedFile.name}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {formatSize(selectedFile.size)}
                    </span>
                  </div>
                </div>
                <Button
                  size="icon-xs"
                  variant="ghost"
                  aria-label="Xóa file đã chọn"
                  onClick={handleClearFile}
                >
                  <XIcon className="size-3.5" />
                </Button>
              </div>

              {/* Trạng thái đang kiểm tra */}
              {validating && (
                <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-4 text-xs text-muted-foreground">
                  <Loader2Icon className="size-4 animate-spin text-purple-600" />
                  <span>{validatingText}</span>
                </div>
              )}

              {/* Thông báo lỗi */}
              {errorMessage && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
                  <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                  <p>{errorMessage}</p>
                </div>
              )}

              {isCogs && summary && !importedResult && (
                <CogsReview summary={summary} />
              )}
              {/* Tóm tắt kết quả kiểm tra thành công */}
              {summary && (
                <BoOrdersSummary
                  summary={summary}
                  downloading={downloading}
                  onDownloadXlsx={handleDownloadXlsx}
                  importedResult={importedResult}
                  reportType={reportType}
                />
              )}
            </div>
          )}
        </div>
      </CardContent>

      <BoOrdersFooter
        group={group}
        selectedShop={selectedShop}
        reportType={reportType}
        summary={summary}
        importing={importing}
        onImportToSheet={handleImportToSheet}
      />
    </Card>
  );
}
