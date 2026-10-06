"use client";

import { FileSpreadsheetIcon, FolderIcon, UploadCloudIcon } from "lucide-react";
import { useRef, useState } from "react";
import type { StoredImportFile } from "@/components/dashboard/fl/etsy-import/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EtsyImportDropzoneProps {
  loading: boolean;
  onAddFiles: (files: StoredImportFile[]) => void;
}

export function EtsyImportDropzone({
  loading,
  onAddFiles,
}: EtsyImportDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

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

    onAddFiles(collected);
  }

  return (
    <>
      {/* File input */}
      <input
        ref={inputRef}
        type="file"
        accept=".csv,.xlsx"
        multiple
        className="hidden"
        onChange={(event) => {
          const selected = Array.from(event.target.files ?? []).map((file) => ({
            file,
            relativePath: file.webkitRelativePath || file.name,
          }));
          onAddFiles(selected);
          event.target.value = "";
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
          const selected = Array.from(event.target.files ?? []).map((file) => ({
            file,
            relativePath: file.webkitRelativePath || file.name,
          }));
          onAddFiles(selected);
          event.target.value = "";
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
          Hệ thống tự động quét đệ quy các thư mục con và phân tích đúng Shop
          (Evernest, Orivia, Timond, Artisan...)
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
    </>
  );
}
