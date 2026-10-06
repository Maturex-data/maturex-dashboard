"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  Loader2Icon,
  UploadCloudIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { importEtsyAction } from "@/actions/etsy";
import { EtsyImportDropzone } from "@/components/dashboard/fl/etsy-import/etsy-import-dropzone";
import { EtsyImportFileList } from "@/components/dashboard/fl/etsy-import/etsy-import-file-list";
import { EtsyImportResults } from "@/components/dashboard/fl/etsy-import/etsy-import-results";
import {
  fileKey,
  fileSize,
  type ImportResult,
  type ShopOption,
  type StoredImportFile,
} from "@/components/dashboard/fl/etsy-import/types";
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

export type { ShopOption };

export function EtsyImportCenter({ shops }: { shops: ShopOption[] }) {
  const router = useRouter();
  const [shopCode, setShopCode] = useState("AUTO");
  const [files, setFiles] = useState<StoredImportFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);

  function addStoredFiles(nextItems: StoredImportFile[]) {
    const merged = new Map(files.map((item) => [fileKey(item), item]));
    for (const item of nextItems) {
      if (/\.(csv|xlsx)$/i.test(item.file.name)) {
        merged.set(fileKey(item), item);
      }
    }
    setFiles([...merged.values()].slice(0, 100));
    setResults([]);
    setMessage("");
  }

  function removeFile(target: StoredImportFile) {
    setFiles((current) =>
      current.filter((item) => fileKey(item) !== fileKey(target)),
    );
  }

  async function importFiles() {
    if (files.length === 0) return;
    setLoading(true);
    setMessage("");
    setResults([]);

    try {
      const formData = new FormData();
      formData.set("shopCode", shopCode);
      const relativePaths: string[] = [];

      for (const item of files) {
        formData.append("files", item.file);
        relativePaths.push(item.relativePath);
      }
      formData.set("relativePaths", JSON.stringify(relativePaths));

      const res = await importEtsyAction(formData);
      if (!res.success || !res.data) {
        throw new Error(res.error ?? "Không thể import dữ liệu.");
      }

      const payload = res.data;
      setResults(payload.results);
      setMessage(
        payload.summary.failed > 0
          ? `${payload.summary.failed} file cần kiểm tra lại.`
          : payload.summary.insertedRows === 0 && payload.summary.skipped > 0
            ? `${payload.summary.skipped} file chưa có tab đích trong Google Sheet ECOMBIUS.`
            : `Đã nạp ${payload.summary.insertedRows.toLocaleString("vi-VN")} dòng vào Google Sheet ECOMBIUS.`,
      );
      if (payload.summary.failed === 0) setFiles([]);
      window.dispatchEvent(new CustomEvent("etsy-cache-invalidated"));
      router.refresh();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không thể import dữ liệu.",
      );
    } finally {
      setLoading(false);
    }
  }

  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);

  return (
    <div className="space-y-5">
      <Card className="gap-0 py-0">
        <CardHeader className="flex-row items-center justify-between border-b px-5 py-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <span>Import dữ liệu Etsy</span>
              <Badge
                variant="outline"
                className="text-purple-600 border-purple-500/30 bg-purple-500/10"
              >
                Tự động nhận diện thư mục
              </Badge>
            </CardTitle>
            <CardDescription className="mt-0.5 text-sm">
              File được nạp trực tiếp vào Google Sheet ECOMBIUS; các công thức
              báo cáo trên Sheet sẽ tự tính lại.
            </CardDescription>
          </div>
          <Badge variant="outline">CSV / XLSX / Folder</Badge>
        </CardHeader>

        <CardContent className="grid lg:grid-cols-[270px_minmax(0,1fr)] p-0">
          {/* Cột trái: Chọn Shop & Thao tác */}
          <div className="space-y-4 border-b p-5 lg:border-r lg:border-b-0">
            <div className="space-y-2">
              <Label htmlFor="etsy-shop">Shop</Label>
              <Select
                value={shopCode}
                onValueChange={(val) => {
                  if (val) setShopCode(String(val));
                }}
                disabled={loading}
              >
                <SelectTrigger id="etsy-shop" className="h-10 w-full text-sm">
                  <SelectValue placeholder="Chọn shop" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO" className="text-sm">
                    ✨ Tự động nhận diện shop theo thư mục / tên file
                  </SelectItem>
                  {shops.map((shop) => (
                    <SelectItem
                      key={shop.code}
                      value={shop.code}
                      className="text-sm"
                    >
                      {shop.name} ({shop.code})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="border-t pt-4 text-sm">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">File đã chọn</span>
                <span className="font-medium tabular-nums">
                  {files.length}/100
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Dung lượng</span>
                <span className="font-medium tabular-nums">
                  {fileSize(totalBytes)}
                </span>
              </div>
            </div>

            <Button
              className="h-10 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              disabled={loading || files.length === 0}
              onClick={importFiles}
            >
              {loading ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <UploadCloudIcon />
              )}
              {loading
                ? "Đang nạp Google Sheet..."
                : `Nạp ${files.length || ""} file vào Google Sheet`}
            </Button>
          </div>

          {/* Cột phải: Dropzone & File List */}
          <div className="min-w-0 p-5">
            <EtsyImportDropzone loading={loading} onAddFiles={addStoredFiles} />
            <EtsyImportFileList
              files={files}
              shops={shops}
              onRemoveFile={removeFile}
            />
          </div>
        </CardContent>

        {message && (
          <div className="border-t px-5 py-3 text-sm">
            <div className="flex items-center gap-2">
              {results.some((result) => result.status === "FAILED") ? (
                <AlertCircleIcon className="size-4 text-red-600" />
              ) : (
                <CheckCircle2Icon className="size-4 text-emerald-600" />
              )}
              <span>{message}</span>
            </div>
          </div>
        )}
      </Card>

      <EtsyImportResults
        results={results}
        onClearResults={() => setResults([])}
      />
    </div>
  );
}
