import * as XLSX from "xlsx";
import { type FlowaSheetValue, upsertFlowaImportedRows } from "@/lib/fl/drive";
import { detectShopFromPath, isCogsFileName } from "@/lib/fl/etsy-constants";

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 100;

type ReportType =
  | "ORDERS"
  | "ORDER_ITEMS"
  | "STATEMENTS"
  | "COGS"
  | "COGS_CLAIM";

type SourceRow = Record<string, unknown>;

interface ParsedSource {
  fileName: string;
  reportType: ReportType;
  rows: SourceRow[];
}

interface PendingSource {
  fileName: string;
  relativePath: string;
  shopCode: string;
  source: ParsedSource;
}

export interface FlowaSheetImportResult {
  fileName: string;
  relativePath: string;
  shopCode: string;
  reportType: ReportType | "UNKNOWN";
  sourceMonth: string | null;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  message: string;
}

function cleanText(value: unknown): string {
  return value === null || value === undefined ? "" : String(value).trim();
}

function money(value: unknown): number {
  const valueText = cleanText(value);
  if (!valueText) return 0;
  const enclosed = valueText.startsWith("(") && valueText.endsWith(")");
  const parsed = Number(valueText.replaceAll(",", "").replace(/[^0-9.-]/g, ""));
  if (!Number.isFinite(parsed)) return 0;
  return enclosed ? -Math.abs(parsed) : parsed;
}

function parseDate(value: unknown): Date | null {
  const valueText = cleanText(value);
  const iso = valueText.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
  }
  const us = valueText.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!us) return null;
  const year = us[3].length === 2 ? Number(us[3]) + 2000 : Number(us[3]);
  return new Date(Date.UTC(year, Number(us[1]) - 1, Number(us[2])));
}

function month(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sheetShop(code: string, reportMonth: string): string {
  return code === "ARTISANHAND" &&
    (reportMonth === "2026-06" || reportMonth === "2026-07")
    ? "ARTISANSHAND"
    : code;
}

function detectReport(headers: string[]): ReportType {
  const values = new Set(headers);
  if (values.has("Transaction ID") && values.has("Item Name"))
    return "ORDER_ITEMS";
  if (values.has("Sale Date") && values.has("Order ID")) return "ORDERS";
  if (values.has("Date") && values.has("Type") && values.has("Net"))
    return "STATEMENTS";
  if (values.has("Ticket ID") || values.has("Issues Order ID"))
    return "COGS_CLAIM";
  if (
    values.has("Order ID") &&
    (values.has("Order Amount") || values.has("Create Day"))
  ) {
    return "COGS";
  }
  throw new Error("Cấu trúc cột chưa được hỗ trợ.");
}

async function parseFile(file: File): Promise<ParsedSource> {
  if (!/\.(csv|xlsx)$/i.test(file.name))
    throw new Error("Chỉ hỗ trợ CSV hoặc XLSX.");
  if (file.size > MAX_FILE_BYTES)
    throw new Error("File vượt quá giới hạn 20 MB.");

  const workbook = XLSX.read(await file.arrayBuffer(), {
    type: "array",
    cellDates: true,
  });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error("File không có worksheet.");
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const reportType = detectReport((matrix[0] ?? []).map(cleanText));

  if (reportType === "COGS" || reportType === "COGS_CLAIM") {
    const rows: SourceRow[] = [];
    for (let index = 2; index < matrix.length; index++) {
      const row = matrix[index] ?? [];
      if (reportType === "COGS") {
        if (!cleanText(row[7])) continue;
        rows.push({
          orderId: cleanText(row[7]),
          createDay: row[6],
          store: cleanText(row[9]),
          amount: row[35],
          status: cleanText(row[43]) || cleanText(row[42]),
        });
      } else {
        if (!cleanText(row[1]) && !cleanText(row[3])) continue;
        rows.push({
          ticketId: cleanText(row[1]),
          date: row[2],
          orderId: cleanText(row[3]),
          amount: row[28] ?? row[22],
          solution: cleanText(row[25]),
        });
      }
    }
    return { fileName: file.name, reportType, rows };
  }

  return {
    fileName: file.name,
    reportType,
    rows: XLSX.utils
      .sheet_to_json<SourceRow>(worksheet, { defval: null, raw: false })
      .filter((row) => Object.values(row).some((value) => cleanText(value))),
  };
}

function statementValues(source: PendingSource): FlowaSheetValue[][] {
  return source.source.rows.flatMap((row, index) => {
    const date = parseDate(row.Date);
    const type = cleanText(row.Type);
    if (!date || !type) return [];
    const reportMonth = month(date);
    const title = cleanText(row.Title);
    const info = cleanText(row.Info);
    const orderId = `${title} ${info}`.match(/Order\s*#?\s*(\d+)/i)?.[1] ?? "";
    return [
      [
        reportMonth,
        sheetShop(source.shopCode, reportMonth),
        index + 2,
        new Intl.DateTimeFormat("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
          timeZone: "UTC",
        }).format(date),
        type,
        title,
        info,
        cleanText(row.Currency) || "USD",
        money(row.Amount),
        money(row["Fees & Taxes"]),
        money(row.Net),
        orderId,
        source.fileName,
      ],
    ];
  });
}

function cogsValues(sources: PendingSource[]): FlowaSheetValue[][] {
  const rows: FlowaSheetValue[][] = [];
  const baseByOrder = new Map<string, number>();

  for (const source of sources.filter(
    (item) => item.source.reportType === "COGS",
  )) {
    for (const row of source.source.rows) {
      const date = parseDate(row.createDay);
      const orderId = cleanText(row.orderId);
      if (!date || !orderId) continue;
      const reportMonth = month(date);
      const sheetRow: FlowaSheetValue[] = [
        reportMonth,
        sheetShop(
          cleanText(row.store).toUpperCase() || source.shopCode,
          reportMonth,
        ),
        orderId,
        "EQUARUS",
        money(row.amount),
        cleanText(row.status) || "OK",
      ];
      baseByOrder.set(orderId, rows.length);
      rows.push(sheetRow);
    }
  }

  for (const source of sources.filter(
    (item) => item.source.reportType === "COGS_CLAIM",
  )) {
    for (const row of source.source.rows) {
      const orderId = cleanText(row.orderId);
      const amount = money(row.amount);
      const baseIndex = baseByOrder.get(orderId);
      if (baseIndex !== undefined) {
        rows[baseIndex][3] = "EQUARUS+ISSUE";
        rows[baseIndex][4] = Number(rows[baseIndex][4]) + amount;
        continue;
      }
      const date = parseDate(row.date);
      if (!date || !orderId) continue;
      const reportMonth = month(date);
      rows.push([
        reportMonth,
        "97DECOR",
        orderId,
        cleanText(row.solution).toUpperCase() === "CANCEL"
          ? "EQUARUS ISSUE - CANCEL"
          : "EQUARUS+ISSUE",
        amount,
        "OK",
      ]);
    }
  }

  return rows;
}

export async function importFilesToFlowaSheet(
  shopCode: string,
  files: Array<File | { file: File; relativePath?: string }>,
) {
  if (!files.length) throw new Error("Chưa chọn file để import.");
  if (files.length > MAX_FILES)
    throw new Error(`Mỗi lần tối đa ${MAX_FILES} file.`);

  const results: FlowaSheetImportResult[] = [];
  const sources: PendingSource[] = [];

  for (const item of files) {
    const file = item instanceof File ? item : item.file;
    const relativePath =
      item instanceof File
        ? file.webkitRelativePath || file.name
        : item.relativePath || file.name;
    const detectedShop = isCogsFileName(relativePath)
      ? "97DECOR"
      : shopCode === "AUTO"
        ? detectShopFromPath(relativePath) || ""
        : shopCode;
    try {
      if (!detectedShop)
        throw new Error("Không xác định được shop từ thư mục/tên file.");
      const source = await parseFile(file);
      sources.push({
        fileName: file.name,
        relativePath,
        shopCode: detectedShop,
        source,
      });
    } catch (error) {
      results.push({
        fileName: file.name,
        relativePath,
        shopCode: detectedShop || shopCode,
        reportType: "UNKNOWN",
        sourceMonth: null,
        status: "FAILED",
        totalRows: 0,
        insertedRows: 0,
        skippedRows: 0,
        message: error instanceof Error ? error.message : "Không thể đọc file.",
      });
    }
  }

  const statements = sources.filter(
    (source) => source.source.reportType === "STATEMENTS",
  );
  const cogsSources = sources.filter(
    (source) =>
      source.source.reportType === "COGS" ||
      source.source.reportType === "COGS_CLAIM",
  );
  const statementRows = statements.flatMap(statementValues);
  const cogsRows = cogsValues(cogsSources);

  if (statementRows.length)
    await upsertFlowaImportedRows("Statement", statementRows);
  if (cogsRows.length) await upsertFlowaImportedRows("COGS", cogsRows);

  for (const source of sources) {
    const supported =
      source.source.reportType === "STATEMENTS" ||
      source.source.reportType === "COGS" ||
      source.source.reportType === "COGS_CLAIM";
    const count =
      source.source.reportType === "STATEMENTS"
        ? statementValues(source).length
        : source.source.reportType === "COGS" ||
            source.source.reportType === "COGS_CLAIM"
          ? source.source.rows.length
          : 0;
    results.push({
      fileName: source.fileName,
      relativePath: source.relativePath,
      shopCode: source.shopCode,
      reportType: source.source.reportType,
      sourceMonth: null,
      status: supported ? "COMPLETED" : "SKIPPED",
      totalRows: source.source.rows.length,
      insertedRows: count,
      skippedRows: supported ? 0 : source.source.rows.length,
      message: supported
        ? "Đã nạp vào Google Sheet Flowa."
        : "File Orders/Order items chưa có tab đích trong mẫu Sheet nên chưa nạp.",
    });
  }

  return {
    results,
    summary: {
      files: results.length,
      completed: results.filter((result) => result.status === "COMPLETED")
        .length,
      skipped: results.filter((result) => result.status === "SKIPPED").length,
      failed: results.filter((result) => result.status === "FAILED").length,
      insertedRows: results.reduce(
        (sum, result) => sum + result.insertedRows,
        0,
      ),
    },
  };
}
