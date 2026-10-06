import * as XLSX from "xlsx";
import type {
  ItemsParseResult,
  ItemsValidationSummary,
  MappedItemRow,
} from "./types";
import { RAW_ITEMS_HEADERS } from "./types";

export interface ItemColumnMappingInfo {
  targetHeader: string;
  sourceHeader: string;
  dataType: string;
  isRequired: boolean;
  notes: string;
}

export const ITEMS_MAPPING_SPEC: ItemColumnMappingInfo[] = [
  {
    targetHeader: "Sale Date",
    sourceHeader: "Sale Date",
    dataType: "String",
    isRequired: true,
    notes: "Giữ nguyên chuỗi ngày nguồn (MM/DD/YY).",
  },
  {
    targetHeader: "Item Name",
    sourceHeader: "Item Name",
    dataType: "String",
    isRequired: true,
    notes: "Tên tiêu đề sản phẩm được mua.",
  },
  {
    targetHeader: "Buyer",
    sourceHeader: "Buyer",
    dataType: "String",
    isRequired: false,
    notes: "Họ tên / ID tài khoản người mua.",
  },
  {
    targetHeader: "Quantity",
    sourceHeader: "Quantity",
    dataType: "Number",
    isRequired: true,
    notes: "Số lượng sản phẩm trong dòng giao dịch.",
  },
  {
    targetHeader: "Price",
    sourceHeader: "Price",
    dataType: "Number",
    isRequired: true,
    notes: "Đơn giá sản phẩm.",
  },
  {
    targetHeader: "Coupon Code",
    sourceHeader: "Coupon Code",
    dataType: "String",
    isRequired: false,
    notes: "Mã giảm giá áp dụng (nếu có).",
  },
  {
    targetHeader: "Coupon Details",
    sourceHeader: "Coupon Details",
    dataType: "String",
    isRequired: false,
    notes: "Chi tiết mã giảm giá.",
  },
  {
    targetHeader: "Discount Amount",
    sourceHeader: "Discount Amount",
    dataType: "Number",
    isRequired: false,
    notes: "Số tiền giảm giá cho item.",
  },
  {
    targetHeader: "Shipping Discount",
    sourceHeader: "Shipping Discount",
    dataType: "Number",
    isRequired: false,
    notes: "Số tiền giảm giá phí vận chuyển.",
  },
  {
    targetHeader: "Order Shipping",
    sourceHeader: "Order Shipping",
    dataType: "Number",
    isRequired: false,
    notes: "Phí vận chuyển của đơn hàng.",
  },
  {
    targetHeader: "Order Sales Tax",
    sourceHeader: "Order Sales Tax",
    dataType: "Number",
    isRequired: false,
    notes: "Thuế bán hàng.",
  },
  {
    targetHeader: "Item Total",
    sourceHeader: "Item Total",
    dataType: "Number",
    isRequired: true,
    notes: "Tổng giá trị dòng sản phẩm sau giảm giá.",
  },
  {
    targetHeader: "Currency",
    sourceHeader: "Currency",
    dataType: "String",
    isRequired: true,
    notes: "Đơn vị tiền tệ (USD, etc.).",
  },
  {
    targetHeader: "Transaction ID",
    sourceHeader: "Transaction ID",
    dataType: "String (Text)",
    isRequired: true,
    notes:
      "Khóa định danh duy nhất của dòng sản phẩm (dùng để Upsert chống trùng).",
  },
  {
    targetHeader: "Listing ID",
    sourceHeader: "Listing ID",
    dataType: "String (Text)",
    isRequired: true,
    notes: "Mã listing sản phẩm trên Etsy, giữ nguyên dạng text.",
  },
  {
    targetHeader: "Date Paid",
    sourceHeader: "Date Paid",
    dataType: "String",
    isRequired: false,
    notes: "Ngày thanh toán.",
  },
  {
    targetHeader: "Date Shipped",
    sourceHeader: "Date Shipped",
    dataType: "String",
    isRequired: false,
    notes: "Ngày gửi hàng.",
  },
  {
    targetHeader: "Ship Name",
    sourceHeader: "Ship Name",
    dataType: "String",
    isRequired: false,
    notes: "Tên người nhận hàng.",
  },
  {
    targetHeader: "Ship Address1",
    sourceHeader: "Ship Address1",
    dataType: "String",
    isRequired: false,
    notes: "Địa chỉ nhận hàng dòng 1.",
  },
  {
    targetHeader: "Ship Address2",
    sourceHeader: "Ship Address2",
    dataType: "String",
    isRequired: false,
    notes: "Địa chỉ nhận hàng dòng 2.",
  },
  {
    targetHeader: "Ship City",
    sourceHeader: "Ship City",
    dataType: "String",
    isRequired: false,
    notes: "Thành phố nhận hàng.",
  },
  {
    targetHeader: "Ship State",
    sourceHeader: "Ship State",
    dataType: "String",
    isRequired: false,
    notes: "Bang / Tỉnh nhận hàng.",
  },
  {
    targetHeader: "Ship Zipcode",
    sourceHeader: "Ship Zipcode",
    dataType: "String (Text)",
    isRequired: false,
    notes: "Mã bưu điện, giữ nguyên số 0 đầu dạng text.",
  },
  {
    targetHeader: "Ship Country",
    sourceHeader: "Ship Country",
    dataType: "String",
    isRequired: false,
    notes: "Quốc gia nhận hàng.",
  },
  {
    targetHeader: "Order ID",
    sourceHeader: "Order ID",
    dataType: "String (Text)",
    isRequired: true,
    notes: "Mã đơn hàng Etsy chứa sản phẩm này (một đơn có thể có nhiều item).",
  },
  {
    targetHeader: "Variations",
    sourceHeader: "Variations",
    dataType: "String",
    isRequired: false,
    notes: "Phân loại / biến thể sản phẩm (màu sắc, kích thước...).",
  },
  {
    targetHeader: "Order Type",
    sourceHeader: "Order Type",
    dataType: "String",
    isRequired: false,
    notes: "Loại đơn hàng (online).",
  },
  {
    targetHeader: "Listings Type",
    sourceHeader: "Listings Type",
    dataType: "String",
    isRequired: false,
    notes: "Loại listing (listing).",
  },
  {
    targetHeader: "Payment Type",
    sourceHeader: "Payment Type",
    dataType: "String",
    isRequired: false,
    notes: "Phương thức thanh toán (online_cc).",
  },
  {
    targetHeader: "InPerson Discount",
    sourceHeader: "InPerson Discount",
    dataType: "Number",
    isRequired: false,
    notes: "Giảm giá trực tiếp.",
  },
  {
    targetHeader: "InPerson Location",
    sourceHeader: "InPerson Location",
    dataType: "String",
    isRequired: false,
    notes: "Địa điểm bán trực tiếp.",
  },
  {
    targetHeader: "VAT Paid by Buyer",
    sourceHeader: "VAT Paid by Buyer",
    dataType: "Number",
    isRequired: false,
    notes: "Thuế VAT người mua thanh toán.",
  },
  {
    targetHeader: "SKU",
    sourceHeader: "SKU",
    dataType: "String (Text)",
    isRequired: false,
    notes: "Mã SKU sản phẩm quản lý nội bộ, giữ nguyên chuỗi text.",
  },
  {
    targetHeader: "Store",
    sourceHeader: "(Cột tự sinh)",
    dataType: "String",
    isRequired: true,
    notes: "Điền cố định tên shop '97Decor'.",
  },
];

export function buildItemsPreviewWorkbook(params: {
  rows: MappedItemRow[];
  summary: ItemsValidationSummary;
}): XLSX.WorkBook {
  const { rows, summary } = params;
  const workbook = XLSX.utils.book_new();

  // ----------------------------------------------------
  // Sheet 1: RAW.Items
  // ----------------------------------------------------
  const rawItemsData: (string | number | null)[][] = [
    [...RAW_ITEMS_HEADERS],
    ...rows.map((row) =>
      RAW_ITEMS_HEADERS.map((header) => {
        const val = row[header];
        return val === null || val === undefined ? "" : val;
      }),
    ),
  ];

  const rawItemsSheet = XLSX.utils.aoa_to_sheet(rawItemsData);

  // Cấu hình độ rộng cột cho RAW.Items
  rawItemsSheet["!cols"] = RAW_ITEMS_HEADERS.map((header) => {
    if (header.includes("Date")) return { wch: 14 };
    if (header.includes("ID") || header === "SKU") return { wch: 18 };
    if (header.includes("Name") || header.includes("Address"))
      return { wch: 25 };
    if (header === "Variations") return { wch: 30 };
    return { wch: 15 };
  });

  XLSX.utils.book_append_sheet(workbook, rawItemsSheet, "RAW.Items");

  // ----------------------------------------------------
  // Sheet 2: Mapping
  // ----------------------------------------------------
  const mappingRows = [
    [
      "STT",
      "Cột đích (RAW.Items)",
      "Cột nguồn (Etsy CSV)",
      "Kiểu dữ liệu",
      "Bắt buộc",
      "Ghi chú chuyển đổi",
    ],
    ...ITEMS_MAPPING_SPEC.map((spec, idx) => [
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
    { wch: 12 },
    { wch: 55 },
  ];
  XLSX.utils.book_append_sheet(workbook, mappingSheet, "Mapping");

  // ----------------------------------------------------
  // Sheet 3: Validation
  // ----------------------------------------------------
  const validationData: (string | number)[][] = [
    ["KẾT QUẢ KIỂM TRA FILE ETSY SOLD ORDER ITEMS"],
    ["Tên file nguồn:", summary.fileName],
    [
      "Dung lượng:",
      `${(summary.fileSizeBytes / 1024).toFixed(1)} KB (${summary.fileSizeBytes} bytes)`,
    ],
    ["Tổng số dòng dữ liệu nguồn:", summary.totalSourceRows],
    ["Số dòng hợp lệ sau ánh xạ:", summary.validRowsCount],
    ["Số dòng có lỗi:", summary.errorRowsCount],
    ["Số Transaction ID trùng lặp:", summary.duplicateTransactionIds.length],
    ["Số đơn hàng chứa nhiều hơn 1 item:", summary.multiItemOrdersCount],
    [
      "Trạng thái:",
      summary.errorRowsCount === 0 ? "HỢP LỆ (READY)" : "CẦN XỬ LÝ LỖI",
    ],
    [""],
    ["LƯU Ý QUAN TRỌNG"],
    [
      "1.",
      "File này được tạo ở chế độ xem trước (Preview) để duyệt cấu trúc 34 cột RAW.Items.",
    ],
    [
      "2.",
      "Google Sheet đích: Spreadsheet ID: 1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do (tab RAW.Items - gid 136409036).",
    ],
    ["3.", "Khóa chống trùng (Deduplication): Transaction ID (Cột N)."],
    [""],
  ];

  if (summary.duplicateTransactionIds.length > 0) {
    validationData.push(
      ["DANH SÁCH TRANSACTION ID TRÙNG LẶP"],
      ["Transaction ID"],
      ...summary.duplicateTransactionIds.map((id) => [id]),
      [""],
    );
  }

  if (summary.errors.length > 0) {
    validationData.push(
      ["DANH SÁCH DÒNG LỖI CỤ THỂ"],
      ["Dòng CSV", "Cột", "Transaction ID", "Order ID", "Nội dung lỗi"],
      ...summary.errors.map((err) => [
        err.rowNumber,
        err.column,
        err.transactionId || "",
        err.orderId || "",
        err.message,
      ]),
    );
  }

  const validationSheet = XLSX.utils.aoa_to_sheet(validationData);
  validationSheet["!cols"] = [
    { wch: 32 },
    { wch: 50 },
    { wch: 22 },
    { wch: 20 },
    { wch: 45 },
  ];
  XLSX.utils.book_append_sheet(workbook, validationSheet, "Validation");

  return workbook;
}

export function exportItemsPreviewToBuffer(result: ItemsParseResult): Buffer {
  const workbook = buildItemsPreviewWorkbook({
    rows: result.rows,
    summary: result.summary,
  });
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
