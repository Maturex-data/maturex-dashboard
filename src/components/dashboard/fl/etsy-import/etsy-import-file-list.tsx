"use client";

import { FileSpreadsheetIcon, XIcon } from "lucide-react";
import {
  fileKey,
  fileSize,
  guessedReport,
  type ShopOption,
  type StoredImportFile,
} from "@/components/dashboard/fl/etsy-import/types";
import { Button } from "@/components/ui/button";
import { detectShopFromPath, isPocdyPath } from "@/lib/etsy-constants";

interface EtsyImportFileListProps {
  files: StoredImportFile[];
  shops: ShopOption[];
  onRemoveFile: (file: StoredImportFile) => void;
}

export function EtsyImportFileList({
  files,
  shops,
  onRemoveFile,
}: EtsyImportFileListProps) {
  if (files.length === 0) return null;

  return (
    <div className="mt-4 max-h-56 overflow-y-auto rounded-lg border">
      {files.map((item) => {
        const relPath = item.relativePath || item.file.name;
        const isUnsupported =
          isPocdyPath(relPath) || isPocdyPath(item.file.name);
        const detected = !isUnsupported ? detectShopFromPath(relPath) : null;
        const shopObj = detected
          ? shops.find((s) => s.code === detected)
          : null;

        return (
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
                {item.relativePath && item.relativePath !== item.file.name && (
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
              {isUnsupported ? (
                <span className="text-[10px] text-destructive font-semibold">
                  Shop không được hỗ trợ
                </span>
              ) : detected ? (
                shopObj ? (
                  <span className="text-[10px] text-purple-600 font-semibold">
                    Shop: {shopObj.name}
                  </span>
                ) : (
                  <span className="text-[10px] text-destructive font-semibold">
                    Shop không được hỗ trợ
                  </span>
                )
              ) : null}
            </div>

            <span className="text-right text-xs tabular-nums text-muted-foreground">
              {fileSize(item.file.size)}
            </span>

            <Button
              size="icon-xs"
              variant="ghost"
              aria-label={`Xóa ${item.file.name}`}
              onClick={() => onRemoveFile(item)}
            >
              <XIcon />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
