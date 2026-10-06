import { parseCsv } from "@/lib/fl/orders-parser/csv-parser";
import { validateShopFilename } from "@/lib/fl/orders-parser/orders-mapper";
import {
  ETSY_STATEMENT_SOURCE_HEADERS,
  type MappedStatementRow,
  RAW_STATEMENT_HEADERS,
  type StatementParseResult,
  type StatementValidationError,
  type StatementValidationSummary,
} from "./types";

export interface StatementMapperOptions {
  shopCode: string;
  storeValue?: string;
}

const MONTH_NAMES_TO_NUM: Record<string, string> = {
  jan: "01",
  feb: "02",
  mar: "03",
  apr: "04",
  may: "05",
  jun: "06",
  jul: "07",
  aug: "08",
  sep: "09",
  oct: "10",
  nov: "11",
  dec: "12",
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

/**
 * Trích xuất tháng dạng YYYY-MM từ chuỗi ngày (hỗ trợ "30-Sep-26", "September 30, 2026", "2026-09-30", "09/30/2026")
 */
export function extractMonthFromDateString(dateStr: string): string | null {
  if (!dateStr || !dateStr.trim()) return null;
  const s = dateStr.trim();

  // Dạng 1: "30-Sep-26" hoặc "30-Sep-2026"
  const mDmy = s.match(/^\d{1,2}-([A-Za-z]{3,})-(\d{2,4})$/);
  if (mDmy) {
    const monStr = mDmy[1].toLowerCase();
    const monNum = MONTH_NAMES_TO_NUM[monStr];
    let year = mDmy[2];
    if (year.length === 2) year = `20${year}`;
    if (monNum) return `${year}-${monNum}`;
  }

  // Dạng 2: "September 30, 2026" hoặc "Sep 30, 2026"
  const mFull = s.match(/^([A-Za-z]+)\s+\d{1,2},\s+(\d{4})$/);
  if (mFull) {
    const monStr = mFull[1].toLowerCase();
    const monNum = MONTH_NAMES_TO_NUM[monStr];
    const year = mFull[2];
    if (monNum) return `${year}-${monNum}`;
  }

  // Dạng 3: "2026-09-30"
  const mIso = s.match(/^(\d{4})-(\d{1,2})-\d{1,2}$/);
  if (mIso) {
    const year = mIso[1];
    const mon = mIso[2].padStart(2, "0");
    return `${year}-${mon}`;
  }

  // Dạng 4: "09/30/2026" hoặc "9/30/26"
  const mUs = s.match(/^(\d{1,2})\/\d{1,2}\/(\d{2,4})$/);
  if (mUs) {
    const mon = mUs[1].padStart(2, "0");
    let year = mUs[2];
    if (year.length === 2) year = `20${year}`;
    return `${year}-${mon}`;
  }

  return null;
}

/**
 * Trích xuất tháng từ tên file (vd: "97decor_etsy_statement_2026_9 (1).csv" -> "2026-09")
 */
export function extractMonthFromFileName(fileName: string): string | null {
  // Tìm năm 4 số và tháng: 2026_9, 2026-09, 2026_09, 2026-9
  const m = fileName.match(/(\d{4})[_-](\d{1,2})/);
  if (m) {
    const year = m[1];
    const month = m[2].padStart(2, "0");
    const monNum = Number(month);
    if (monNum >= 1 && monNum <= 12) {
      return `${year}-${month}`;
    }
  }

  // Tìm dạng tháng chữ: "sep_2026" hoặc "september-2026"
  const mText = fileName.toLowerCase().match(/([a-z]{3,})[_-](\d{4})/);
  if (mText) {
    const monNum = MONTH_NAMES_TO_NUM[mText[1]];
    if (monNum) {
      return `${mText[2]}-${monNum}`;
    }
  }

  return null;
}

/**
 * Phân tích và ánh xạ file Etsy Statement CSV sang 10 cột chuẩn của RAW.Statement
 */
export function parseAndMapEtsyStatement(
  csvContent: string,
  fileName: string,
  fileSizeBytes: number,
  options: StatementMapperOptions = {
    shopCode: "97DECOR",
    storeValue: "97Decor",
  },
): StatementParseResult {
  const storeValue = options.storeValue ?? "97Decor";

  // 1. Phân tích CSV qua RFC 4180
  const matrix = parseCsv(csvContent);
  if (matrix.length === 0) {
    throw new Error("File CSV rỗng, không tìm thấy dữ liệu.");
  }

  const rawHeaders = matrix[0].map((h) => h.trim());
  const dataRows = matrix.slice(1);

  // 2. Kiểm tra loại file & chặn nhầm file Orders / Items / COGS
  const headersLower = rawHeaders.map((h) => h.toLowerCase());

  // Nhầm file Orders
  if (
    headersLower.includes("adjusted card processing fees") ||
    headersLower.includes("first name") ||
    headersLower.includes("last name")
  ) {
    throw new Error(
      "File đã tải lên là Etsy Sold Orders (Đơn hàng), không phải Etsy Payment Statement. Vui lòng chọn đúng file Statement.",
    );
  }

  // Nhầm file Items
  if (
    headersLower.includes("transaction id") ||
    headersLower.includes("item name") ||
    headersLower.includes("listing id") ||
    headersLower.includes("variations")
  ) {
    throw new Error(
      "File đã tải lên là Etsy Sold Order Items (Chi tiết sản phẩm), không phải Etsy Payment Statement. Vui lòng chọn đúng file Statement.",
    );
  }

  // Nhầm file COGS
  if (headersLower.includes("sku cost") || headersLower.includes("cogs")) {
    throw new Error(
      "File đã tải lên là bảng COGS, không phải Etsy Payment Statement.",
    );
  }

  // 3. Kiểm tra các header bắt buộc của Etsy Statement
  const missingHeaders: string[] = [];
  for (const expected of ETSY_STATEMENT_SOURCE_HEADERS) {
    if (!rawHeaders.includes(expected)) {
      missingHeaders.push(expected);
    }
  }

  if (missingHeaders.length > 0) {
    throw new Error(
      `File CSV thiếu ${missingHeaders.length} header chuẩn của Etsy Statement: ${missingHeaders.join(", ")}`,
    );
  }

  const filenameCheck = validateShopFilename(fileName, options.shopCode);
  if (!filenameCheck.valid) throw new Error(filenameCheck.error);

  // Tạo map header -> index cột
  const headerIndexMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerIndexMap.set(h, idx);
  });

  // 5. Kiểm tra cột thứ 10 phụ (header rỗng cuối CSV)
  let trailingExtraCount = 0;
  if (rawHeaders.length > 9) {
    for (const row of dataRows) {
      for (let c = 9; c < row.length; c++) {
        if (row[c] && row[c].trim() !== "") {
          trailingExtraCount++;
          break;
        }
      }
    }
  }

  const mappedRows: MappedStatementRow[] = [];
  const errors: StatementValidationError[] = [];
  const warnings: string[] = [];
  const detectedTypes: Record<string, number> = {};
  const detectedMonthsSet = new Set<string>();

  const dateIdx = headerIndexMap.get("Date") ?? 0;
  const typeIdx = headerIndexMap.get("Type") ?? 1;

  // 6. Duyệt và map từng dòng dữ liệu
  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const rawRow = dataRows[rIdx];
    const rowNumber = rIdx + 2; // Dòng 1 là header

    // Bỏ qua dòng trống hoàn toàn
    if (rawRow.length === 0 || rawRow.every((c) => !c || c.trim() === "")) {
      continue;
    }

    const dateVal =
      dateIdx < rawRow.length ? (rawRow[dateIdx] ?? "").trim() : "";
    const typeVal =
      typeIdx < rawRow.length ? (rawRow[typeIdx] ?? "").trim() : "";

    if (!dateVal) {
      errors.push({
        rowNumber,
        column: "Date",
        message: "Cột Date bị trống.",
      });
    } else {
      const parsedMonth = extractMonthFromDateString(dateVal);
      if (parsedMonth) {
        detectedMonthsSet.add(parsedMonth);
      } else {
        warnings.push(
          `Dòng ${rowNumber}: Không xác định được định dạng ngày "${dateVal}".`,
        );
      }
    }

    if (typeVal) {
      detectedTypes[typeVal] = (detectedTypes[typeVal] || 0) + 1;
    }

    // Xây dựng dòng mapped sang 10 cột chuẩn của RAW.Statement
    const mappedRow: MappedStatementRow = {
      Date: "",
      Type: "",
      Title: "",
      Info: "",
      Currency: "",
      Amount: "",
      "Fees & Taxes": "",
      Net: "",
      "Tax Details": "",
      Store: storeValue,
    };

    for (const h of RAW_STATEMENT_HEADERS) {
      if (h === "Store") {
        mappedRow.Store = storeValue;
        continue;
      }

      const colIdx = headerIndexMap.get(h);
      const rawCell =
        colIdx !== undefined && colIdx < rawRow.length ? rawRow[colIdx] : "";
      // Bảo toàn 100% chuỗi nguyên gốc (giữ dấu âm, dấu ngoặc, ký hiệu tiền, --, chuỗi rỗng)
      // Chỉ trim khoảng trắng biên ngoài cùng thừa (như "$62.48 ")
      mappedRow[h] = (rawCell ?? "").trim();
    }

    mappedRows.push(mappedRow);
  }

  // 7. Xác minh tháng từ dữ liệu và đối chiếu tên file
  const detectedMonths = Array.from(detectedMonthsSet);
  if (detectedMonths.length === 0) {
    throw new Error(
      "Không thể xác định tháng giao dịch từ bất kỳ dòng nào trong file CSV.",
    );
  }

  if (detectedMonths.length > 1) {
    throw new Error(
      `File CSV chứa giao dịch từ nhiều tháng khác nhau: ${detectedMonths.join(", ")}. File Statement phải thuộc cùng một tháng xác minh.`,
    );
  }

  const verifiedMonth = detectedMonths[0]; // vd: "2026-09"
  const fileNameMonth = extractMonthFromFileName(fileName);

  if (fileNameMonth && fileNameMonth !== verifiedMonth) {
    throw new Error(
      `Tháng trong dữ liệu file (${verifiedMonth}) không khớp với tháng trong tên file (${fileNameMonth}). Vui lòng kiểm tra lại file.`,
    );
  }

  const [y, m] = verifiedMonth.split("-");
  const verifiedMonthLabel = `Tháng ${m}/${y}`;

  const summary: StatementValidationSummary = {
    fileName,
    fileSizeBytes,
    totalSourceRows: mappedRows.length,
    validRowsCount: mappedRows.length - errors.length,
    errorRowsCount: errors.length,
    verifiedMonth,
    verifiedMonthLabel,
    detectedTypes,
    trailingExtraColumnUsed: trailingExtraCount > 0,
    errors,
    warnings,
  };

  return {
    headers: [...RAW_STATEMENT_HEADERS],
    rows: mappedRows,
    summary,
  };
}
