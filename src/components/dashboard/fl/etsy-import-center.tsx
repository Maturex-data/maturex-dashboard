"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  FolderIcon,
  Loader2Icon,
  RotateCcwIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { importEtsyAction } from "@/actions/etsy";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { detectShopFromPath } from "@/lib/etsy-constants";
import { cn } from "@/lib/utils";

interface ShopOption {
  code: string;
  name: string;
}

interface ImportResult {
  fileName: string;
  relativePath?: string;
  shopCode?: string;
  reportType: string;
  sourceMonth: string | null;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  message: string;
}

const reportLabels: Record<string, string> = {
  ORDERS: "Orders",
  ORDER_ITEMS: "Order items",
  STATEMENTS: "Statement",
  COGS: "COGS / Giá vốn",
  COGS_CLAIM: "Claim / Bồi thường",
  UNKNOWN: "Chưa nhận diện",
};

function fileKey(item: StoredImportFile): string {
  return `${item.relativePath || item.file.name}-${item.file.size}-${item.file.lastModified}`;
}

function fileSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessedReport(fileName: string): string {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("order_management") || normalized.includes("cogs"))
    return "COGS / Giá vốn";
  if (normalized.includes("issue") || normalized.includes("claim"))
    return "Claim / Bồi thường";
  if (normalized.includes("soldorderitems")) return "Order items";
  if (normalized.includes("soldorders")) return "Orders";
  if (normalized.includes("statement")) return "Statement";
  return "Kiểm tra khi import";
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

interface StoredImportFile {
  file: File;
  relativePath: string;
}

export function EtsyImportCenter({ shops }: { shops: ShopOption[] }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [shopCode, setShopCode] = useState("AUTO");
  const [files, setFiles] = useState<StoredImportFile[]>([]);
  const [dragging, setDragging] = useState(false);
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

  async function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);

    const items = event.dataTransfer.items;
    const collected: StoredImportFile[] = [];

    // Check if DataTransferItem with webkitGetAsEntry is supported
    if (items && items.length > 0 && "webkitGetAsEntry" in items[0]) {
      const queue: { entry: FileSystemEntry; path: string }[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) queue.push({ entry, path: "" });
      }

      while (queue.length > 0) {
        const next = queue.shift();
        if (!next) break;
        const { entry, path } = next;

        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          await new Promise<void>((resolve) => {
            fileEntry.file((file: File) => {
              collected.push({
                file,
                relativePath: path ? `${path}/${file.name}` : file.name,
              });
              resolve();
            });
          });
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry;
          const reader = dirEntry.createReader();
          await new Promise<void>((resolve) => {
            reader.readEntries((entries: FileSystemEntry[]) => {
              for (const child of entries) {
                queue.push({
                  entry: child,
                  path: path ? `${path}/${entry.name}` : entry.name,
                });
              }
              resolve();
            });
          });
        }
      }
    } else {
      for (const file of Array.from(event.dataTransfer.files)) {
        collected.push({
          file,
          relativePath: file.webkitRelativePath || file.name,
        });
      }
    }

    addStoredFiles(collected);
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
            ? `${payload.summary.skipped} file chưa có tab đích trong Google Sheet Flowa.`
            : `Đã nạp ${payload.summary.insertedRows.toLocaleString("vi-VN")} dòng vào Google Sheet Flowa.`,
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

  return (
    <div className="space-y-5">
      <section className="overflow-hidden rounded-lg border bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
          <div>
            <h2 className="font-semibold flex items-center gap-2">
              <span>Import dữ liệu Etsy</span>
              <Badge
                variant="outline"
                className="text-purple-600 border-purple-500/30 bg-purple-500/10"
              >
                Tự động nhận diện thư mục
              </Badge>
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              File được nạp trực tiếp vào Google Sheet Flowa; các công thức báo
              cáo trên Sheet sẽ tự tính lại.
            </p>
          </div>
          <Badge variant="outline">CSV / XLSX / Folder</Badge>
        </div>

        <div className="grid lg:grid-cols-[270px_minmax(0,1fr)]">
          <div className="space-y-4 border-b p-5 lg:border-r lg:border-b-0">
            <label
              className="block space-y-2 font-medium text-sm"
              htmlFor="etsy-shop"
            >
              Shop
              <select
                id="etsy-shop"
                className="h-10 w-full rounded-lg border border-input bg-background px-3 font-normal text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/30"
                value={shopCode}
                onChange={(event) => setShopCode(event.target.value)}
                disabled={loading}
              >
                <option value="AUTO">
                  ✨ Tự động nhận diện shop theo thư mục / tên file
                </option>
                {shops.map((shop) => (
                  <option key={shop.code} value={shop.code}>
                    {shop.name} ({shop.code})
                  </option>
                ))}
              </select>
            </label>

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
                  {fileSize(
                    files.reduce((sum, item) => sum + item.file.size, 0),
                  )}
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

          <div className="min-w-0 p-5">
            {/* File input */}
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              multiple
              className="hidden"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []).map(
                  (file) => ({
                    file,
                    relativePath: file.webkitRelativePath || file.name,
                  }),
                );
                addStoredFiles(selected);
              }}
            />

            {/* Folder input */}
            <input
              ref={folderInputRef}
              type="file"
              // @ts-expect-error webkitdirectory is standard for folder inputs
              webkitdirectory=""
              directory=""
              multiple
              className="hidden"
              onChange={(event) => {
                const selected = Array.from(event.target.files ?? []).map(
                  (file) => ({
                    file,
                    relativePath: file.webkitRelativePath || file.name,
                  }),
                );
                addStoredFiles(selected);
              }}
            />

            <section
              aria-label="Khu vực tải lên tệp tin"
              className={cn(
                "flex min-h-40 w-full flex-col items-center justify-center rounded-xl border border-dashed px-6 py-7 text-center transition-all",
                dragging
                  ? "border-purple-500 bg-purple-50/80 ring-2 ring-purple-500/20"
                  : "border-zinc-300 bg-zinc-50/60 hover:border-zinc-400 hover:bg-zinc-50",
              )}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <span className="mb-3 flex size-12 items-center justify-center rounded-xl border bg-white text-purple-600 shadow-xs">
                <UploadCloudIcon className="size-6" />
              </span>
              <span className="font-semibold text-sm text-foreground">
                Kéo thả cả thư mục (Folder) hoặc các file Etsy vào đây
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                Hệ thống tự động quét đệ quy các thư mục con và phân tích đúng
                Shop (97Decor, Artisanhand, Timond...)
              </span>

              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5 border-purple-500/30 text-purple-700 dark:text-purple-300 hover:bg-purple-50"
                  onClick={() => folderInputRef.current?.click()}
                  disabled={loading}
                >
                  <FolderIcon className="size-3.5 text-purple-600" />
                  <span>Chọn cả thư mục</span>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 text-xs gap-1.5"
                  onClick={() => inputRef.current?.click()}
                  disabled={loading}
                >
                  <FileSpreadsheetIcon className="size-3.5" />
                  <span>Chọn từng file lẻ</span>
                </Button>
              </div>
            </section>

            {files.length > 0 ? (
              <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border">
                {files.map((item) => (
                  <div
                    key={fileKey(item)}
                    className="grid grid-cols-[minmax(0,1fr)_120px_64px_32px] items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileSpreadsheetIcon className="size-4 shrink-0 text-emerald-600" />
                      <div className="flex flex-col min-w-0">
                        <span
                          className="truncate text-sm font-medium"
                          title={item.file.name}
                        >
                          {item.file.name}
                        </span>
                        {item.relativePath &&
                          item.relativePath !== item.file.name && (
                            <span
                              className="truncate text-[11px] text-muted-foreground/70"
                              title={item.relativePath}
                            >
                              📁 {item.relativePath}
                            </span>
                          )}
                      </div>
                    </div>
                    <div className="flex flex-col items-end sm:items-start truncate text-xs text-muted-foreground">
                      <span>{guessedReport(item.file.name)}</span>
                      {detectShopFromPath(
                        item.relativePath || item.file.name,
                      ) && (
                        <span className="text-[10px] text-purple-600 font-semibold">
                          Shop:{" "}
                          {detectShopFromPath(
                            item.relativePath || item.file.name,
                          )}
                        </span>
                      )}
                    </div>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      {fileSize(item.file.size)}
                    </span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Xóa ${item.file.name}`}
                      onClick={() => removeFile(item)}
                    >
                      <XIcon />
                    </Button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {message ? (
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
        ) : null}
      </section>

      {results.length > 0 ? (
        <section className="rounded-lg border bg-background">
          <div className="flex items-center justify-between border-b px-5 py-3">
            <h2 className="font-medium text-sm">Kết quả lần import này</h2>
            <Button size="sm" variant="ghost" onClick={() => setResults([])}>
              <RotateCcwIcon />
              Đóng
            </Button>
          </div>
          <div className="divide-y">
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
          </div>
        </section>
      ) : null}
    </div>
  );
}
