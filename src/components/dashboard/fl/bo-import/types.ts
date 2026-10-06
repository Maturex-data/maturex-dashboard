import {
  BO_IMPORT_ACCEPTED_EXTENSIONS,
  BO_IMPORT_MAX_FILE_BYTES,
} from "@/lib/fl/bo-import-config";

export interface SelectedFile {
  key: string;
  file: File;
}

export const IMPORT_DISABLED_REASON = "Chờ cấu hình mẫu Excel để bật import.";

export function fileKey(file: File): string {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export function formatSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function hasAcceptedExtension(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return BO_IMPORT_ACCEPTED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export const MAX_FILE_LABEL = formatSize(BO_IMPORT_MAX_FILE_BYTES);
export const ACCEPT_ATTR = BO_IMPORT_ACCEPTED_EXTENSIONS.join(",");
