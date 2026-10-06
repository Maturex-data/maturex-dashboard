"use client";

import { AlertCircleIcon, UploadCloudIcon } from "lucide-react";
import { useState } from "react";
import {
  ACCEPT_ATTR,
  MAX_FILE_LABEL,
} from "@/components/dashboard/fl/bo-import/types";
import { BO_IMPORT_MAX_FILES } from "@/lib/fl/bo-import-config";
import { cn } from "@/lib/utils";

interface BoFileDropzoneProps {
  id: string;
  errors: string[];
  onAddFiles: (files: File[]) => void;
}

export function BoFileDropzone({
  id,
  errors,
  onAddFiles,
}: BoFileDropzoneProps) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="space-y-3">
      <label
        htmlFor={id}
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
          onAddFiles(Array.from(e.dataTransfer.files));
        }}
      >
        <input
          id={id}
          type="file"
          accept={ACCEPT_ATTR}
          multiple
          className="sr-only"
          onChange={(e) => {
            onAddFiles(Array.from(e.target.files ?? []));
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
    </div>
  );
}
