export interface ShopOption {
  code: string;
  name: string;
}

export interface StoredImportFile {
  file: File;
  relativePath: string;
}

export interface ImportResult {
  fileName: string;
  relativePath?: string;
  shopCode?: string;
  reportType: string;
  sourceMonth: string | null;
  status: "COMPLETED" | "SKIPPED" | "FAILED" | "PROCESSING";
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  message: string;
}

export const reportLabels: Record<string, string> = {
  ORDERS: "Orders",
  ORDER_ITEMS: "Order items",
  STATEMENTS: "Statement",
  COGS: "COGS / Giá vốn",
  COGS_CLAIM: "Claim / Bồi thường",
  UNKNOWN: "Chưa nhận diện",
};

export function fileKey(item: StoredImportFile): string {
  return `${item.relativePath || item.file.name}-${item.file.size}-${item.file.lastModified}`;
}

export function fileSize(bytes: number): string {
  if (bytes === 0) return "0 KB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function guessedReport(fileName: string): string {
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
