import { parseCsv } from "@/lib/fl/orders-parser/csv-parser";
import {
  ETSY_ITEMS_SOURCE_HEADERS,
  type ItemsParseResult,
  type ItemsValidationSummary,
  type MappedItemRow,
  NUMERIC_ITEM_COLUMNS,
  RAW_ITEMS_HEADERS,
  TEXT_ITEM_COLUMNS,
} from "./types";

export interface ItemsMapperOptions {
  shopCode: string;
  storeValue?: string;
}

/**
 * Kiểm tra xem chuỗi có phải là số hợp lệ không (hỗ trợ số âm, số thập phân)
 */
function isValidNumberString(val: string): boolean {
  if (!val || val.trim() === "") return true;
  const num = Number(val);
  return !Number.isNaN(num) && Number.isFinite(num);
}

/**
 * Phân tích và ánh xạ file Etsy Sold Order Items CSV sang 34 cột chuẩn RAW.Items
 */
export function parseAndMapEtsyItems(
  csvContent: string,
  fileName: string,
  fileSizeBytes: number,
  options: ItemsMapperOptions = { shopCode: "97DECOR", storeValue: "97Decor" },
): ItemsParseResult {
  const storeValue = options.storeValue ?? "97Decor";

  // 1. Phân tích CSV qua bộ parser RFC 4180
  const matrix = parseCsv(csvContent);

  if (matrix.length === 0) {
    throw new Error("File CSV rỗng, không tìm thấy dữ liệu.");
  }

  const rawHeaders = matrix[0].map((h) => h.trim());
  const dataRows = matrix.slice(1);

  // 2. Kiểm tra loại file & chặn nhầm file Orders / Statement / COGS
  const headersLower = rawHeaders.map((h) => h.toLowerCase());

  // Phát hiện nhầm file Orders
  if (
    headersLower.includes("adjusted card processing fees") ||
    headersLower.includes("first name") ||
    headersLower.includes("last name")
  ) {
    throw new Error(
      "File đã tải lên là Etsy Sold Orders (Đơn hàng), không phải Etsy Sold Order Items (Chi tiết sản phẩm). Vui lòng chọn đúng file Items.",
    );
  }

  // Phát hiện nhầm file Statement
  if (
    headersLower.includes("fee & tax") ||
    (headersLower.includes("title") && headersLower.includes("net"))
  ) {
    throw new Error(
      "File đã tải lên là Etsy Payment Statement, không phải Etsy Sold Order Items. Vui lòng chọn đúng file Items.",
    );
  }

  // Phát hiện nhầm file COGS
  if (headersLower.includes("cost") && headersLower.includes("sku cost")) {
    throw new Error(
      "File đã tải lên là bảng COGS, không phải Etsy Sold Order Items.",
    );
  }

  // 3. Kiểm tra các header bắt buộc của Etsy Items
  const missingHeaders: string[] = [];
  for (const expected of ETSY_ITEMS_SOURCE_HEADERS) {
    if (!rawHeaders.includes(expected)) {
      missingHeaders.push(expected);
    }
  }

  if (missingHeaders.length > 0) {
    throw new Error(
      `File CSV thiếu ${missingHeaders.length} header chuẩn của Etsy Order Items: ${missingHeaders.slice(0, 5).join(", ")}${missingHeaders.length > 5 ? "..." : ""}`,
    );
  }

  // 4. Kiểm tra tên shop nếu có trong tên file
  const lowerFileName = fileName.toLowerCase();
  if (
    lowerFileName.includes("linh") ||
    lowerFileName.includes("97decor") ||
    lowerFileName.includes("97_decor")
  ) {
    // File hợp lệ cho shop 97Decor
  } else if (
    lowerFileName.includes("evernest") ||
    lowerFileName.includes("orivia") ||
    lowerFileName.includes("kindlora")
  ) {
    throw new Error(
      `File "${fileName}" dường như thuộc về shop khác, không phải của shop 97Decor (BO Ms. Linh).`,
    );
  }

  // Tạo map header -> index trong dòng nguồn
  const headerIndexMap = new Map<string, number>();
  rawHeaders.forEach((h, idx) => {
    headerIndexMap.set(h, idx);
  });

  const txIdIndex = headerIndexMap.get("Transaction ID") ?? -1;
  const orderIdIndex = headerIndexMap.get("Order ID") ?? -1;

  const mappedRows: MappedItemRow[] = [];
  const errors: ItemsValidationSummary["errors"] = [];
  const warnings: string[] = [];

  const transactionIdCountMap = new Map<string, number>();
  const orderIdItemCountMap = new Map<string, number>();

  // 5. Duyệt từng dòng dữ liệu và map sang 34 cột RAW.Items
  for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
    const rawRow = dataRows[rIdx];
    const rowNumber = rIdx + 2; // Dòng 1 là header

    // Bỏ qua dòng trống hoàn toàn
    if (rawRow.length === 0 || rawRow.every((c) => !c || c.trim() === "")) {
      continue;
    }

    const txIdVal = txIdIndex >= 0 ? (rawRow[txIdIndex] ?? "").trim() : "";
    const orderIdVal =
      orderIdIndex >= 0 ? (rawRow[orderIdIndex] ?? "").trim() : "";

    // Kiểm tra Transaction ID
    if (!txIdVal) {
      errors.push({
        rowNumber,
        column: "Transaction ID",
        orderId: orderIdVal,
        message: "Transaction ID bị trống.",
      });
    } else {
      transactionIdCountMap.set(
        txIdVal,
        (transactionIdCountMap.get(txIdVal) || 0) + 1,
      );
    }

    // Kiểm tra Order ID
    if (!orderIdVal) {
      errors.push({
        rowNumber,
        column: "Order ID",
        transactionId: txIdVal,
        message: "Order ID bị trống.",
      });
    } else {
      orderIdItemCountMap.set(
        orderIdVal,
        (orderIdItemCountMap.get(orderIdVal) || 0) + 1,
      );
    }

    // Khởi tạo dòng mapped dạng object
    const rowRecord: Record<string, string | number> = {};

    for (const h of RAW_ITEMS_HEADERS) {
      if (h === "Store") {
        rowRecord.Store = storeValue;
        continue;
      }

      const colIdx = headerIndexMap.get(h);
      const rawCell =
        colIdx !== undefined && colIdx < rawRow.length ? rawRow[colIdx] : "";
      const trimmedCell = (rawCell ?? "").trim();

      // Kiểm tra cột kiểu text: bảo toàn text nguyên gốc, không đổi kiểu
      if (TEXT_ITEM_COLUMNS.has(h)) {
        rowRecord[h] = trimmedCell;
      } else if (NUMERIC_ITEM_COLUMNS.has(h)) {
        if (!trimmedCell) {
          rowRecord[h] = "";
        } else if (!isValidNumberString(trimmedCell)) {
          errors.push({
            rowNumber,
            column: h,
            transactionId: txIdVal,
            orderId: orderIdVal,
            message: `Giá trị số không hợp lệ: "${trimmedCell}".`,
          });
          rowRecord[h] = trimmedCell;
        } else {
          rowRecord[h] = Number(trimmedCell);
        }
      } else {
        // Cột ngày, currency, variations, text khác: giữ nguyên chuỗi
        rowRecord[h] = trimmedCell;
      }
    }

    mappedRows.push(rowRecord as unknown as MappedItemRow);
  }

  // 6. Tổng hợp các Transaction ID bị trùng lặp
  const duplicateTransactionIds: string[] = [];
  for (const [txId, count] of transactionIdCountMap.entries()) {
    if (count > 1) {
      duplicateTransactionIds.push(txId);
    }
  }

  if (duplicateTransactionIds.length > 0) {
    warnings.push(
      `Phát hiện ${duplicateTransactionIds.length} Transaction ID xuất hiện nhiều hơn 1 lần trong file: ${duplicateTransactionIds.slice(0, 3).join(", ")}${duplicateTransactionIds.length > 3 ? "..." : ""}`,
    );
  }

  // 7. Thống kê số lượng đơn có nhiều item (multi-item orders)
  let multiItemOrdersCount = 0;
  for (const count of orderIdItemCountMap.values()) {
    if (count > 1) {
      multiItemOrdersCount += 1;
    }
  }

  const validRowsCount = mappedRows.length - errors.length;

  const summary: ItemsValidationSummary = {
    fileName,
    fileSizeBytes,
    totalSourceRows: dataRows.length,
    validRowsCount: Math.max(0, validRowsCount),
    errorRowsCount: errors.length,
    duplicateTransactionIds,
    multiItemOrdersCount,
    errors,
    warnings,
  };

  return {
    headers: [...RAW_ITEMS_HEADERS],
    rows: mappedRows,
    summary,
  };
}
