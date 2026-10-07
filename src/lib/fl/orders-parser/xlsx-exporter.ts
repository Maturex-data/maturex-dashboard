import * as XLSX from "xlsx";
import { getBoSheetDestination } from "@/lib/fl/bo-import-config";
import type {
  ColumnMappingInfo,
  MappedOrderRow,
  OrdersValidationSummary,
} from "@/lib/fl/orders-parser/types";
import { RAW_ORDERS_HEADERS } from "@/lib/fl/orders-parser/types";

/**
 * Xuất workbook 3 sheet: RAW.Orders, Mapping, Validation
 */
export function buildOrdersPreviewWorkbook(
  params: {
    rows: MappedOrderRow[];
    summary: OrdersValidationSummary;
    mappingTable: ColumnMappingInfo[];
  },
  boId = "ms-linh",
): XLSX.WorkBook {
  const { rows, summary, mappingTable } = params;

  const workbook = XLSX.utils.book_new();

  // ----------------------------------------------------
  // Sheet 1: RAW.Orders
  // ----------------------------------------------------
  const rawOrdersData: (string | number | null)[][] = [
    [...RAW_ORDERS_HEADERS],
    ...rows.map((row) =>
      RAW_ORDERS_HEADERS.map((header) => {
        const val = row[header];
        return val === null || val === undefined ? "" : val;
      }),
    ),
  ];

  const rawOrdersSheet = XLSX.utils.aoa_to_sheet(rawOrdersData);

  // Cấu hình độ rộng cột cho RAW.Orders
  rawOrdersSheet["!cols"] = RAW_ORDERS_HEADERS.map((header) => {
    if (header.includes("Date")) return { wch: 14 };
    if (header.includes("ID") || header === "SKU") return { wch: 18 };
    if (header.includes("Name") || header.includes("Street"))
      return { wch: 22 };
    if (header.includes("City") || header.includes("State")) return { wch: 16 };
    return { wch: 15 };
  });

  XLSX.utils.book_append_sheet(workbook, rawOrdersSheet, "RAW.Orders");

  // ----------------------------------------------------
  // Sheet 2: Mapping
  // ----------------------------------------------------
  const mappingHeaders = [
    "STT",
    "Cột đích (RAW.Orders)",
    "Cột nguồn (Etsy CSV)",
    "Kiểu dữ liệu",
    "Bắt buộc",
    "Quy tắc ánh xạ",
  ];

  const mappingData: (string | number)[][] = [
    mappingHeaders,
    ...mappingTable.map((item, idx) => [
      idx + 1,
      item.targetColumn,
      item.sourceColumn,
      item.dataType,
      item.required ? "Có" : "Không",
      item.rule,
    ]),
  ];

  const mappingSheet = XLSX.utils.aoa_to_sheet(mappingData);
  mappingSheet["!cols"] = [
    { wch: 6 },
    { wch: 28 },
    { wch: 28 },
    { wch: 14 },
    { wch: 12 },
    { wch: 65 },
  ];

  XLSX.utils.book_append_sheet(workbook, mappingSheet, "Mapping");

  // ----------------------------------------------------
  // Sheet 3: Validation
  // ----------------------------------------------------
  const validationData: (string | number)[][] = [
    ["BÁO CÁO KIỂM TRA DỮ LIỆU (VALIDATION REPORT)"],
    ["Thời gian kiểm tra", new Date().toLocaleString("vi-VN")],
    ["Tên file nguồn", summary.fileName],
    ["Dung lượng file", `${(summary.fileSizeBytes / 1024).toFixed(1)} KB`],
    ["Nhóm BO", boId === "mr-nam" ? "Mr. Nam (mr-nam)" : "Ms. Linh (ms-linh)"],
    ["Shop phụ trách", "97Decor (97DECOR)"],
    ["Giá trị gán cột Store", summary.storeValue],
    [""],
    ["THỐNG KÊ TỔNG QUAN", "SỐ LƯỢNG"],
    ["Tổng số dòng nguồn (không kể header)", summary.totalSourceRows],
    ["Số dòng hợp lệ đã map", summary.validRowsCount],
    ["Số dòng có lỗi bị loại bỏ", summary.errorRowsCount],
    ["Số Order ID bị trùng lặp", summary.duplicateOrderIds.length],
    [
      "Trạng thái tổng thể",
      summary.errorRowsCount === 0 ? "HỢP LỆ (READY)" : "CÓ LỖI (HAS ERRORS)",
    ],
    [""],
    ["LƯU Ý QUAN TRỌNG"],
    [
      "1.",
      "File này được tạo ở chế độ xem trước (Preview) để duyệt cấu trúc dữ liệu.",
    ],
    [
      "2.",
      `Google Sheet đích: Spreadsheet ID: ${getBoSheetDestination(boId).spreadsheetId} (tab RAW.Orders - gid ${getBoSheetDestination(boId).ordersSheetId}).`,
    ],
    [
      "3.",
      "Phương thức đồng bộ (Append / Upsert / Thay thế theo tháng) sẽ được quyết định sau khi duyệt XLSX này.",
    ],
    [""],
  ];

  if (summary.duplicateOrderIds.length > 0) {
    validationData.push(
      ["DANH SÁCH ORDER ID TRÙNG LẶP"],
      ["STT", "Order ID", "Số lần xuất hiện", "Các dòng trong Excel"],
      ...summary.duplicateOrderIds.map((item, idx) => [
        idx + 1,
        item.orderId,
        item.count,
        item.rows.join(", "),
      ]),
      [""],
    );
  }

  if (summary.errors.length > 0) {
    validationData.push(
      ["DANH SÁCH LỖI DỮ LIỆU"],
      ["STT", "Dòng (Excel Row)", "Cột", "Mô tả lỗi"],
      ...summary.errors.map((item, idx) => [
        idx + 1,
        item.rowNumber,
        item.column ?? "—",
        item.message,
      ]),
    );
  }

  const validationSheet = XLSX.utils.aoa_to_sheet(validationData);
  validationSheet["!cols"] = [
    { wch: 35 },
    { wch: 35 },
    { wch: 25 },
    { wch: 45 },
  ];

  XLSX.utils.book_append_sheet(workbook, validationSheet, "Validation");

  return workbook;
}

/**
 * Ghi workbook ra file đĩa (dành cho scripts / server exports)
 */
export function exportOrdersPreviewToFile(
  params: {
    rows: MappedOrderRow[];
    summary: OrdersValidationSummary;
    mappingTable: ColumnMappingInfo[];
  },
  outputPath: string,
): void {
  const workbook = buildOrdersPreviewWorkbook(params);
  XLSX.writeFile(workbook, outputPath);
}

/**
 * Xuất buffer (dành cho web download / API response)
 */
export function exportOrdersPreviewToBuffer(
  params: {
    rows: MappedOrderRow[];
    summary: OrdersValidationSummary;
    mappingTable: ColumnMappingInfo[];
  },
  boId = "ms-linh",
): Buffer {
  const workbook = buildOrdersPreviewWorkbook(params, boId);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
