"use client";

import { InfoIcon, LockIcon, UploadCloudIcon } from "lucide-react";
import { useId, useState } from "react";
import { BoFileDropzone } from "@/components/dashboard/fl/bo-import/bo-file-dropzone";
import { BoFileList } from "@/components/dashboard/fl/bo-import/bo-file-list";
import {
  fileKey,
  formatSize,
  hasAcceptedExtension,
  IMPORT_DISABLED_REASON,
  MAX_FILE_LABEL,
  type SelectedFile,
} from "@/components/dashboard/fl/bo-import/types";
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
import {
  BO_IMPORT_MAX_FILE_BYTES,
  BO_IMPORT_MAX_FILES,
  type BoGroup,
} from "@/lib/fl/bo-import-config";
import { cn } from "@/lib/utils";

interface BoStatementFormProps {
  group: BoGroup;
}

export function BoStatementForm({ group }: BoStatementFormProps) {
  const baseId = useId();
  const shopSelectId = `${baseId}-shop`;
  const fileInputId = `${baseId}-files`;
  const reasonId = `${baseId}-reason`;

  const [shopCode, setShopCode] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [errors, setErrors] = useState<string[]>([]);

  const selectedShop = group.shops.find((shop) => shop.code === shopCode);
  const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);

  function handleAddFiles(incoming: File[]) {
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

  function handleRemoveFile(key: string) {
    setFiles((current) => current.filter((item) => item.key !== key));
    setErrors([]);
  }

  function handleClearFiles() {
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
        {/* Cột trái: Dropdown chọn shop & Lưu ý */}
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

        {/* Cột phải: Dropzone & Danh sách file */}
        <div className="min-w-0 space-y-4">
          <BoFileDropzone
            id={fileInputId}
            errors={errors}
            onAddFiles={handleAddFiles}
          />
          <BoFileList
            files={files}
            onRemoveFile={handleRemoveFile}
            onClearFiles={handleClearFiles}
          />
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
