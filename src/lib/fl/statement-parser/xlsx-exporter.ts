import * as XLSX from "xlsx";
import { getBoSheetDestination } from "@/lib/fl/bo-import-config";
import type {
  MappedStatementRow,
  StatementParseResult,
  StatementValidationSummary,
} from "./types";
import { RAW_STATEMENT_HEADERS } from "./types";

export interface StatementColumnMappingInfo {
  targetHeader: string;
  sourceHeader: string;
  dataType: string;
  isRequired: boolean;
  notes: string;
}

export const STATEMENT_MAPPING_SPEC: StatementColumnMappingInfo[] = [
  {
    targetHeader: "Date",
    sourceHeader: "Date",
    dataType: "String",
    isRequired: true,
    notes:
      "Giữ nguyên chuỗi ngày nguồn (e.g. 30-Sep-26), không quy đổi múi giờ hay ép sang date object.",
  },
  {
    targetHeader: "Type",
    sourceHeader: "Type",
    dataType: "String",
    isRequired: true,
    notes:
      "Loại giao dịch Etsy (Marketing, Tax, Fee, Sale, Deposit,...). Giữ nguyên text gốc.",
  },
  {
    targetHeader: "Title",
    sourceHeader: "Title",
    dataType: "String",
    isRequired: true,
    notes:
      "Tiêu đề giao dịch. Giữ nguyên chuỗi text chứa Order # hoặc Listing #, không chuyển ID thành số.",
  },
  {
    targetHeader: "Info",
    sourceHeader: "Info",
    dataType: "String",
    isRequired: false,
    notes:
      "Mô tả chi tiết giao dịch. Giữ nguyên text và ID, không chuyển đổi thành số.",
  },
  {
    targetHeader: "Currency",
    sourceHeader: "Currency",
    dataType: "String",
    isRequired: true,
    notes: "Mã loại tiền tệ (USD). Giữ nguyên, không quy đổi tỷ giá.",
  },
  {
    targetHeader: "Amount",
    sourceHeader: "Amount",
    dataType: "String",
    isRequired: false,
    notes:
      "Giữ nguyên chuỗi tiền nguồn (dấu âm, ngoặc đơn, ký hiệu $ và '--'). Không biến '--' hoặc ô trống thành 0.",
  },
  {
    targetHeader: "Fees & Taxes",
    sourceHeader: "Fees & Taxes",
    dataType: "String",
    isRequired: false,
    notes:
      "Giữ nguyên chuỗi tiền phí và thuế (e.g. ($15.00), -$0.20, '--'). Không tính lại hoặc làm tròn.",
  },
  {
    targetHeader: "Net",
    sourceHeader: "Net",
    dataType: "String",
    isRequired: false,
    notes:
      "Giữ nguyên chuỗi tiền thực nhận Net từ Etsy CSV. Không tự ý tính lại Net hay gom giao dịch.",
  },
  {
    targetHeader: "Tax Details",
    sourceHeader: "Tax Details",
    dataType: "String",
    isRequired: false,
    notes:
      "Chi tiết thuế Etsy. Giữ nguyên '--' hoặc nội dung text nguồn, không biến thành 0.",
  },
  {
    targetHeader: "Store",
    sourceHeader: "[Tự động điền]",
    dataType: "String",
    isRequired: true,
    notes:
      "Cố định '97Decor' theo cấu hình BO Ms. Linh. Không lấy từ cột phụ thứ 10 của CSV.",
  },
];

export interface StatementPreviewWorkbookOptions {
  rows: MappedStatementRow[];
  summary: StatementValidationSummary;
}

export function buildStatementPreviewWorkbook(
  options: StatementPreviewWorkbookOptions,
  boId = "ms-linh",
): XLSX.WorkBook {
  const { rows, summary } = options;
  const workbook = XLSX.utils.book_new();

  // ----------------------------------------------------
  // Sheet 1: RAW.Statement (10 cột chuẩn)
  // ----------------------------------------------------
  const sheetData = [
    [...RAW_STATEMENT_HEADERS],
    ...rows.map((row) => RAW_STATEMENT_HEADERS.map((h) => row[h] ?? "")),
  ];

  const rawStatementSheet = XLSX.utils.aoa_to_sheet(sheetData);
  rawStatementSheet["!cols"] = [
    { wch: 14 }, // Date
    { wch: 14 }, // Type
    { wch: 42 }, // Title
    { wch: 38 }, // Info
    { wch: 10 }, // Currency
    { wch: 14 }, // Amount
    { wch: 14 }, // Fees & Taxes
    { wch: 14 }, // Net
    { wch: 14 }, // Tax Details
    { wch: 12 }, // Store
  ];
  XLSX.utils.book_append_sheet(workbook, rawStatementSheet, "RAW.Statement");

  // ----------------------------------------------------
  // Sheet 2: Mapping
  // ----------------------------------------------------
  const mappingRows = [
    [
      "STT",
      "Cột đích (RAW.Statement)",
      "Cột nguồn (Etsy CSV)",
      "Kiểu dữ liệu",
      "Bắt buộc",
      "Ghi chú chuyển đổi & Bảo toàn",
    ],
    ...STATEMENT_MAPPING_SPEC.map((spec, idx) => [
      idx + 1,
      spec.targetHeader,
      spec.sourceHeader,
      spec.dataType,
      spec.isRequired ? "Có" : "Không",
      spec.notes,
    ]),
  ];

  const mappingSheet = XLSX.utils.aoa_to_sheet(mappingRows);
  mappingSheet["!cols"] = [
    { wch: 6 },
    { wch: 26 },
    { wch: 26 },
    { wch: 16 },
    { wch: 10 },
    { wch: 65 },
  ];
  XLSX.utils.book_append_sheet(workbook, mappingSheet, "Mapping");

  // ----------------------------------------------------
  // Sheet 3: Thống kê & Cảnh báo (Validation)
  // ----------------------------------------------------
  const typesRows = Object.entries(summary.detectedTypes).map(
    ([type, count]) => [`- ${type}:`, count],
  );

  const validationData: (string | number)[][] = [
    ["BÁO CÁO KIỂM TRA FILE ETSY PAYMENT STATEMENT"],
    ["Tên file nguồn:", summary.fileName],
    [
      "Dung lượng:",
      `${(summary.fileSizeBytes / 1024).toFixed(1)} KB (${summary.fileSizeBytes} bytes)`,
    ],
    [
      "Tháng xác minh:",
      `${summary.verifiedMonth} (${summary.verifiedMonthLabel})`,
    ],
    ["Shop phụ trách:", "97DECOR (Store: 97Decor)"],
    [
      "BO phụ trách:",
      boId === "mr-nam" ? "mr-nam (Mr. Nam)" : "ms-linh (Ms. Linh)",
    ],
    ["Tổng số dòng nguồn hợp lệ:", summary.totalSourceRows],
    ["Số dòng có lỗi:", summary.errorRowsCount],
    [
      "Trạng thái:",
      summary.errorRowsCount === 0 ? "HỢP LỆ (READY)" : "CẦN XỬ LÝ LỖI",
    ],
    [""],
    ["PHÂN BỔ GIAO DỊCH THEO LOẠI (TYPE)"],
    ...typesRows,
    [""],
    ["CƠ CHẾ IMPORT LẠI & CHỐNG MẤT DÒNG"],
    [
      "1.",
      "Không áp dụng deduplicate theo Date + Type + Title + Amount vì Statement có nhiều giao dịch trùng lặp hợp lệ (vd: nhiều phí listing/tax cùng ngày).",
    ],
    [
      "2.",
      "Cơ chế thay thế an toàn: Khi import tháng đã xác minh (vd: 2026-09) cho shop 97Decor, hệ thống sẽ xóa các dòng cũ của 97Decor trong tháng đó và ghi toàn bộ dữ liệu mới.",
    ],
    [
      "3.",
      "Bảo toàn shop khác: Toàn bộ dòng của các shop khác (vd: Timond) hoặc các tháng khác của 97Decor trong tab RAW.Statement được giữ nguyên 100%.",
    ],
    [""],
    ["LƯU Ý QUAN TRỌNG"],
    [
      "1.",
      "File này được tạo ở chế độ xem trước (Preview) để duyệt cấu trúc 10 cột RAW.Statement.",
    ],
    [
      "2.",
      `Google Sheet đích: Spreadsheet ID: ${getBoSheetDestination(boId).spreadsheetId} (tab RAW.Statement - gid ${getBoSheetDestination(boId).statementSheetId}).`,
    ],
    [
      "3.",
      "Tính năng ghi thật lên Google Sheet tạm thời bị khóa cho đến khi người dùng duyệt preview và cơ chế thay thế.",
    ],
    [""],
  ];

  if (summary.warnings.length > 0) {
    validationData.push(
      ["DANH SÁCH CẢNH BÁO"],
      ...summary.warnings.map((w) => ["⚠️", w]),
      [""],
    );
  }

  if (summary.errors.length > 0) {
    validationData.push(
      ["DANH SÁCH DÒNG LỖI CỤ THỂ"],
      ["Dòng CSV", "Cột", "Nội dung lỗi"],
      ...summary.errors.map((err) => [err.rowNumber, err.column, err.message]),
    );
  }

  const validationSheet = XLSX.utils.aoa_to_sheet(validationData);
  validationSheet["!cols"] = [{ wch: 30 }, { wch: 60 }, { wch: 40 }];
  XLSX.utils.book_append_sheet(
    workbook,
    validationSheet,
    "Thống kê & Cảnh báo",
  );

  return workbook;
}

export function exportStatementPreviewToBuffer(
  result: StatementParseResult,
  boId = "ms-linh",
): Buffer {
  const workbook = buildStatementPreviewWorkbook(
    {
      rows: result.rows,
      summary: result.summary,
    },
    boId,
  );
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
