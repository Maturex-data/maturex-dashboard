"use client";

import { FileSpreadsheetIcon, Trash2Icon, XIcon } from "lucide-react";
import {
  formatSize,
  type SelectedFile,
} from "@/components/dashboard/fl/bo-import/types";
import { Button } from "@/components/ui/button";
import { BO_IMPORT_MAX_FILES } from "@/lib/fl/bo-import-config";

interface BoFileListProps {
  files: SelectedFile[];
  onRemoveFile: (key: string) => void;
  onClearFiles: () => void;
}

export function BoFileList({
  files,
  onRemoveFile,
  onClearFiles,
}: BoFileListProps) {
  if (files.length === 0) {
    return (
      <p className="text-center text-xs text-muted-foreground">
        Chưa chọn file nào.
      </p>
    );
  }

  return (
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
          onClick={onClearFiles}
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
                onClick={() => onRemoveFile(item.key)}
              >
                <XIcon className="size-3.5" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
