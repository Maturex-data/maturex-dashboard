"use client";

import {
  AlertCircleIcon,
  FileSpreadsheetIcon,
  InfoIcon,
  LockIcon,
  Trash2Icon,
  UploadCloudIcon,
  XIcon,
} from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useId, useOptimistic, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BO_IMPORT_ACCEPTED_EXTENSIONS,
  BO_IMPORT_MAX_FILE_BYTES,
  BO_IMPORT_MAX_FILES,
  BO_QUERY_PARAM,
  type BoGroup,
} from "@/lib/fl/bo-import-config";
import { cn } from "@/lib/utils";

interface BoStatementImportProps {
  groups: BoGroup[];
  activeBoId: string;
}

interface SelectedFile {
  key: string;
  file: File;
}

const IMPORT_DISABLED_REASON = "Chờ cấu hình mẫu Excel để bật import.";
const MAX_FILE_LABEL = formatSize(BO_IMPORT_MAX_FILE_BYTES);
const ACCEPT_ATTR = BO_IMPORT_ACCEPTED_EXTENSIONS.join(",");

function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function formatSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return BO_IMPORT_ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
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

function BoStatementForm({ group }: { group: BoGroup }) {
  const baseId = useId();
  const shopSelectId = `${baseId}-shop`;
  const fileInputId = `${baseId}-files`;
  const reasonId = `${baseId}-reason`;

  const [shopCode, setShopCode] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);

  const selectedShop = group.shops.find((shop) => shop.code === shopCode);
  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);

  function addFiles(incoming: File[]) {
    if (incoming.length === 0) return;
    const nextErrors: string[] = [];
    const existing = new Set(files.map((item) => item.key));
    const accepted: SelectedFile[] = [];
    let duplicates = 0;
    let overLimit = 0;

    for (const file of incoming) {
      if (!hasAcceptedExtension(file.name)) {
        nextErrors.push(
          `${file.name}: định dạng không hỗ trợ. Chỉ nhận file .csv hoặc .xlsx.`,
        );
        continue;
      }
      if (file.size > BO_IMPORT_MAX_FILE_BYTES) {
        nextErrors.push(
          `${file.name}: dung lượng ${formatSize(file.size)} vượt giới hạn ${MAX_FILE_LABEL}/file.`,
        );
        continue;
      }
      if (file.size === 0) {
        nextErrors.push(`${file.name}: file rỗng.`);
        continue;
      }
      const key = fileKey(file);
      if (existing.has(key)) {
        duplicates += 1;
        continue;
      }
      if (files.length + accepted.length >= BO_IMPORT_MAX_FILES) {
        overLimit += 1;
        continue;
      }
      existing.add(key);
      accepted.push({ key, file });
    }

    if (duplicates > 0) {
      nextErrors.push(`Đã bỏ qua ${duplicates} file trùng trong danh sách.`);
    }
    if (overLimit > 0) {
      nextErrors.push(
        `Tối đa ${BO_IMPORT_MAX_FILES} file mỗi lần. ${overLimit} file không được thêm.`,
      );
    }

    setErrors(nextErrors);
    if (accepted.length > 0) {
      setFiles((current) => [...current, ...accepted]);
    }
  }

  function removeFile(key: string) {
    setFiles((current) => current.filter((item) => item.key !== key));
    setErrors([]);
  }

  function clearFiles() {
    setFiles([]);
    setErrors([]);
  }

  return (
    <Card className="gap-0 py-0">
      <CardHeader className="flex-row items-center justify-between gap-3 border-b py-4">
        <div>
          <CardTitle className="text-base">
            Statement Etsy · {group.name}
          </CardTitle>
          <CardDescription className="text-xs">
            {group.shops.map((shop) => shop.name).join(" · ")}
          </CardDescription>
        </div>
        <Badge variant="outline">CSV / XLSX</Badge>
      </CardHeader>

      <CardContent className="grid gap-6 p-5 lg:grid-cols-[280px_minmax(0,1fr)]">
        {/* Cột trái: Chọn shop & Ghi chú */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={shopSelectId}>Shop</Label>
            <Select
              value={shopCode || null}
              onValueChange={(val) => setShopCode(val ? String(val) : "")}
            >
              <SelectTrigger id={shopSelectId} className="w-full h-10">
                <SelectValue placeholder="Chọn shop" />
              </SelectTrigger>
              <SelectContent>
                {group.shops.map((shop) => (
                  <SelectItem key={shop.code} value={shop.code}>
                    {shop.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Chỉ gồm shop thuộc nhóm {group.name}.
            </p>
          </div>

          <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-50/70 p-3 text-xs leading-relaxed text-amber-900 dark:bg-amber-500/10 dark:text-amber-200">
            <InfoIcon className="mt-0.5 size-3.5 shrink-0" />
            <p>
              Chỉ nhận Statement Etsy. Kiểm tra nội dung sẽ được bổ sung khi cấu
              hình mẫu Excel hoàn tất.
            </p>
          </div>
        </div>

        {/* Cột phải: Dropzone, thông báo lỗi & Danh sách file */}
        <div className="min-w-0 space-y-4">
          <label
            htmlFor={fileInputId}
            className={cn(
              "flex min-h-36 w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed p-6 text-center transition-colors",
              "hover:border-primary/50 hover:bg-muted/50",
              dragging && "border-primary bg-primary/5 ring-2 ring-primary/20",
            )}
            onDragEnter={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                setDragging(false);
              }
            }}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              addFiles(Array.from(e.dataTransfer.files));
            }}
          >
            <input
              id={fileInputId}
              type="file"
              accept={ACCEPT_ATTR}
              multiple
              className="sr-only"
              onChange={(e) => {
                addFiles(Array.from(e.target.files ?? []));
                e.target.value = "";
              }}
            />
            <span className="mb-3 flex size-10 items-center justify-center rounded-lg border bg-background text-purple-600 shadow-2xs">
              <UploadCloudIcon className="size-5" />
            </span>
            <span className="font-medium text-sm">
              Kéo thả file Statement Etsy vào đây hoặc bấm để chọn
            </span>
            <span className="mt-1 text-xs text-muted-foreground">
              .csv, .xlsx · tối đa {BO_IMPORT_MAX_FILES} file · {MAX_FILE_LABEL}
              /file
            </span>
          </label>

          {errors.length > 0 && (
            <div
              role="alert"
              className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive"
            >
              <div className="flex items-start gap-2">
                <AlertCircleIcon className="mt-0.5 size-3.5 shrink-0" />
                <ul className="space-y-1">
                  {errors.map((error) => (
                    <li key={error} className="break-words">
                      {error}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {files.length > 0 ? (
            <div className="rounded-lg border bg-card">
              <div className="flex items-center justify-between border-b px-3 py-2 text-xs">
                <span className="font-medium">
                  Đã chọn {files.length}/{BO_IMPORT_MAX_FILES} file
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 text-xs text-muted-foreground hover:text-destructive"
                  onClick={clearFiles}
                >
                  <Trash2Icon className="size-3.5" />
                  Xóa tất cả
                </Button>
              </div>
              <ul className="max-h-60 divide-y overflow-y-auto">
                {files.map((item) => (
                  <li
                    key={item.key}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <FileSpreadsheetIcon className="size-4 shrink-0 text-emerald-600" />
                      <span
                        className="truncate text-xs font-medium"
                        title={item.file.name}
                      >
                        {item.file.name}
                      </span>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {formatSize(item.file.size)}
                      </span>
                      <Button
                        type="button"
                        size="icon-xs"
                        variant="ghost"
                        aria-label={`Bỏ file ${item.file.name}`}
                        onClick={() => removeFile(item.key)}
                      >
                        <XIcon className="size-3.5" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-center text-xs text-muted-foreground">
              Chưa chọn file nào.
            </p>
          )}
        </div>
      </CardContent>

      <CardFooter className="flex flex-col gap-4 border-t bg-muted/30 p-5 lg:flex-row lg:items-center lg:justify-between">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4 lg:flex lg:gap-8">
          <div>
            <dt className="text-xs text-muted-foreground">Nhóm BO</dt>
            <dd className="font-medium">{group.name}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Shop</dt>
            <dd
              className={cn(
                "font-medium",
                !selectedShop && "text-muted-foreground",
              )}
            >
              {selectedShop?.name ?? "Chưa chọn"}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Số file</dt>
            <dd className="font-medium tabular-nums">{files.length}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Dung lượng</dt>
            <dd className="font-medium tabular-nums">
              {formatSize(totalBytes)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <p
            id={reasonId}
            className="flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <LockIcon className="size-3.5 shrink-0" />
            {IMPORT_DISABLED_REASON}
          </p>
          <Button
            type="button"
            disabled
            aria-describedby={reasonId}
            className="h-10 gap-2 bg-purple-600 px-5 font-semibold text-white hover:bg-purple-700 disabled:cursor-not-allowed"
          >
            <UploadCloudIcon className="size-4" />
            Import Statement
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
