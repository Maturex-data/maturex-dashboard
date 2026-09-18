"use client";

import {
  AlertCircleIcon,
  CheckCircle2Icon,
  FileSpreadsheetIcon,
  Loader2Icon,
  RotateCcwIcon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

interface ShopOption {
  code: string;
  name: string;
}

interface ImportHistoryRow {
  id: string;
  shopName: string;
  reportType: string;
  sourceFileName: string;
  sourceMonth: string;
  status: string;
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  importedAt: string;
}

interface ImportResult {
  fileName: string;
  reportType: string;
  sourceMonth: string | null;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  message: string;
}

interface ImportResponse {
  results: ImportResult[];
  summary: {
    files: number;
    completed: number;
    skipped: number;
    failed: number;
    insertedRows: number;
  };
  error?: string;
}

const reportLabels: Record<string, string> = {
  ORDERS: "Orders",
  ORDER_ITEMS: "Order items",
  STATEMENTS: "Statement",
  UNKNOWN: "Chưa nhận diện",
};

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function fileSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function guessedReport(fileName: string): string {
  const normalized = fileName.toLowerCase();
  if (normalized.includes("soldorderitems")) return "Order items";
  if (normalized.includes("soldorders")) return "Orders";
  if (normalized.includes("statement")) return "Statement";
  return "Kiểm tra khi import";
}

function acceptedFiles(files: File[]): File[] {
  return files.filter((file) => /\.(csv|xlsx)$/i.test(file.name));
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

export function EtsyImportCenter({
  shops,
  history,
}: {
  shops: ShopOption[];
  history: ImportHistoryRow[];
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [shopCode, setShopCode] = useState(shops[0]?.code ?? "");
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [results, setResults] = useState<ImportResult[]>([]);

  function addFiles(nextFiles: File[]) {
    const merged = new Map(files.map((file) => [fileKey(file), file]));
    for (const file of acceptedFiles(nextFiles))
      merged.set(fileKey(file), file);
    setFiles([...merged.values()].slice(0, 12));
    setResults([]);
    setMessage("");
  }

  function removeFile(target: File) {
    setFiles((current) =>
      current.filter((file) => fileKey(file) !== fileKey(target)),
    );
  }

  async function importFiles() {
    if (!shopCode || files.length === 0) return;
    setLoading(true);
    setMessage("");
    setResults([]);

    try {
      const formData = new FormData();
      formData.set("shopCode", shopCode);
      for (const file of files) formData.append("files", file);
      const response = await fetch("/api/etsy/import", {
        method: "POST",
        body: formData,
      });
      const payload = (await response.json()) as ImportResponse;
      if (!response.ok)
        throw new Error(payload.error ?? "Không thể import dữ liệu.");
      setResults(payload.results);
      setMessage(
        payload.summary.failed > 0
          ? `${payload.summary.failed} file cần kiểm tra lại.`
          : payload.summary.insertedRows === 0 && payload.summary.skipped > 0
            ? `${payload.summary.skipped} file đã tồn tại, không ghi trùng.`
            : `Đã thêm ${payload.summary.insertedRows.toLocaleString("vi-VN")} dòng mới.`,
      );
      if (payload.summary.failed === 0) setFiles([]);
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
            <h2 className="font-semibold">Import dữ liệu Etsy</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Orders, Order Items và Payment Statement
            </p>
          </div>
          <Badge variant="outline">CSV / XLSX</Badge>
        </div>

        <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
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
                {shops.map((shop) => (
                  <option key={shop.code} value={shop.code}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </label>

            <div className="border-t pt-4 text-sm">
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">File đã chọn</span>
                <span className="font-medium tabular-nums">
                  {files.length}/12
                </span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-muted-foreground">Dung lượng</span>
                <span className="font-medium tabular-nums">
                  {fileSize(files.reduce((sum, file) => sum + file.size, 0))}
                </span>
              </div>
            </div>

            <Button
              className="h-10 w-full"
              disabled={loading || files.length === 0 || !shopCode}
              onClick={importFiles}
            >
              {loading ? (
                <Loader2Icon className="animate-spin" />
              ) : (
                <UploadCloudIcon />
              )}
              {loading ? "Đang nhập..." : `Import ${files.length || ""} file`}
            </Button>
          </div>

          <div className="min-w-0 p-5">
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.xlsx"
              multiple
              className="hidden"
              onChange={(event) =>
                addFiles(Array.from(event.target.files ?? []))
              }
            />
            <button
              type="button"
              className={cn(
                "flex min-h-40 w-full flex-col items-center justify-center rounded-lg border border-dashed px-6 py-7 text-center transition-colors",
                dragging
                  ? "border-purple-500 bg-purple-50"
                  : "border-zinc-300 bg-zinc-50/60 hover:border-zinc-400 hover:bg-zinc-50",
              )}
              onClick={() => inputRef.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragOver={(event) => event.preventDefault()}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                addFiles(Array.from(event.dataTransfer.files));
              }}
              disabled={loading}
            >
              <span className="mb-3 flex size-10 items-center justify-center rounded-lg border bg-white text-purple-600 shadow-xs">
                <UploadCloudIcon className="size-5" />
              </span>
              <span className="font-medium text-sm">Thả file Etsy tại đây</span>
              <span className="mt-1 text-xs text-muted-foreground">
                hoặc bấm để chọn file
              </span>
            </button>

            {files.length > 0 ? (
              <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border">
                {files.map((file) => (
                  <div
                    key={fileKey(file)}
                    className="grid grid-cols-[minmax(0,1fr)_110px_64px_32px] items-center gap-3 border-b px-3 py-2.5 last:border-b-0"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <FileSpreadsheetIcon className="size-4 shrink-0 text-emerald-600" />
                      <span className="truncate text-sm" title={file.name}>
                        {file.name}
                      </span>
                    </div>
                    <span className="truncate text-xs text-muted-foreground">
                      {guessedReport(file.name)}
                    </span>
                    <span className="text-right text-xs tabular-nums text-muted-foreground">
                      {fileSize(file.size)}
                    </span>
                    <Button
                      size="icon-xs"
                      variant="ghost"
                      aria-label={`Xóa ${file.name}`}
                      onClick={() => removeFile(file)}
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
            {results.map((result) => (
              <div
                key={`${result.fileName}-${result.reportType}`}
                className="grid gap-2 px-5 py-3 text-sm md:grid-cols-[minmax(0,1fr)_120px_100px_100px] md:items-center"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{result.fileName}</p>
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

      <section
        id="import-history"
        className="overflow-hidden rounded-lg border bg-background"
      >
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h2 className="font-semibold">Lịch sử import</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              20 batch gần nhất
            </p>
          </div>
          <Badge variant="secondary">{history.length} batch</Badge>
        </div>
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-zinc-50">
              <TableRow>
                <TableHead>Shop</TableHead>
                <TableHead>Loại</TableHead>
                <TableHead>Tháng</TableHead>
                <TableHead>File</TableHead>
                <TableHead className="text-right">Dòng mới</TableHead>
                <TableHead>Trạng thái</TableHead>
                <TableHead>Thời gian</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-28 text-center text-muted-foreground"
                  >
                    Chưa có lịch sử import.
                  </TableCell>
                </TableRow>
              ) : (
                history.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">
                      {row.shopName}
                    </TableCell>
                    <TableCell>
                      {reportLabels[row.reportType] ?? row.reportType}
                    </TableCell>
                    <TableCell className="tabular-nums">
                      {row.sourceMonth}
                    </TableCell>
                    <TableCell
                      className="max-w-64 truncate"
                      title={row.sourceFileName}
                    >
                      {row.sourceFileName}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.insertedRows.toLocaleString("vi-VN")}
                    </TableCell>
                    <TableCell>{statusBadge(row.status)}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {row.importedAt}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
