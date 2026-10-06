import { parseCsv } from "@/lib/fl/orders-parser/csv-parser";
import {
  type ColumnMappingInfo,
  ETSY_ORDERS_SOURCE_HEADERS,
  type MappedOrderRow,
  NUMERIC_COLUMNS,
  type OrdersValidationSummary,
  type RawOrderHeader,
  type ValidationErrorItem,
} from "@/lib/fl/orders-parser/types";

export const ORDERS_MAPPING_RULES: ColumnMappingInfo[] = [
  {
    sourceColumn: "Sale Date",
    targetColumn: "Sale Date",
    dataType: "string",
    rule: "Giữ nguyên chuỗi ngày nguồn (MM/DD/YY hoặc ISO), không biến đổi",
    required: true,
  },
  {
    sourceColumn: "Order ID",
    targetColumn: "Order ID",
    dataType: "string",
    rule: "Định dạng text, giữ nguyên số 0 đầu nếu có, kiểm tra trùng lặp",
    required: true,
  },
  {
    sourceColumn: "Buyer User ID",
    targetColumn: "Buyer User ID",
    dataType: "string",
    rule: "Giữ nguyên text username khách hàng",
    required: false,
  },
  {
    sourceColumn: "Full Name",
    targetColumn: "Full Name",
    dataType: "string",
    rule: "Họ và tên người nhận, giữ nguyên",
    required: false,
  },
  {
    sourceColumn: "First Name",
    targetColumn: "First Name",
    dataType: "string",
    rule: "Tên người nhận",
    required: false,
  },
  {
    sourceColumn: "Last Name",
    targetColumn: "Last Name",
    dataType: "string",
    rule: "Họ người nhận",
    required: false,
  },
  {
    sourceColumn: "Number of Items",
    targetColumn: "Number of Items",
    dataType: "number",
    rule: "Số lượng sản phẩm trong đơn, parse số nguyên",
    required: false,
  },
  {
    sourceColumn: "Payment Method",
    targetColumn: "Payment Method",
    dataType: "string",
    rule: "Phương thức thanh toán (Credit Card, PayPal...)",
    required: false,
  },
  {
    sourceColumn: "Date Shipped",
    targetColumn: "Date Shipped",
    dataType: "string",
    rule: "Ngày giao hàng, giữ nguyên chuỗi",
    required: false,
  },
  {
    sourceColumn: "Street 1",
    targetColumn: "Street 1",
    dataType: "string",
    rule: "Địa chỉ dòng 1, giữ nguyên",
    required: false,
  },
  {
    sourceColumn: "Street 2",
    targetColumn: "Street 2",
    dataType: "string",
    rule: "Địa chỉ dòng 2, giữ nguyên",
    required: false,
  },
  {
    sourceColumn: "Ship City",
    targetColumn: "Ship City",
    dataType: "string",
    rule: "Thành phố nhận hàng",
    required: false,
  },
  {
    sourceColumn: "Ship State",
    targetColumn: "Ship State",
    dataType: "string",
    rule: "Bang / Tỉnh nhận hàng",
    required: false,
  },
  {
    sourceColumn: "Ship Zipcode",
    targetColumn: "Ship Zipcode",
    dataType: "string",
    rule: "Mã bưu điện, định dạng text bảo toàn số 0 đầu (vd: 07030)",
    required: false,
  },
  {
    sourceColumn: "Ship Country",
    targetColumn: "Ship Country",
    dataType: "string",
    rule: "Quốc gia nhận hàng",
    required: false,
  },
  {
    sourceColumn: "Currency",
    targetColumn: "Currency",
    dataType: "string",
    rule: "Loại tiền tệ (USD, EUR...), không tự quy đổi",
    required: false,
  },
  {
    sourceColumn: "Order Value",
    targetColumn: "Order Value",
    dataType: "number",
    rule: "Giá trị đơn hàng (chưa trừ discount/tax/ship), parse float chính xác",
    required: false,
  },
  {
    sourceColumn: "Coupon Code",
    targetColumn: "Coupon Code",
    dataType: "string",
    rule: "Mã giảm giá đã dùng",
    required: false,
  },
  {
    sourceColumn: "Coupon Details",
    targetColumn: "Coupon Details",
    dataType: "string",
    rule: "Chi tiết mã giảm giá (% off, fixed...)",
    required: false,
  },
  {
    sourceColumn: "Discount Amount",
    targetColumn: "Discount Amount",
    dataType: "number",
    rule: "Số tiền giảm giá, parse float",
    required: false,
  },
  {
    sourceColumn: "Shipping Discount",
    targetColumn: "Shipping Discount",
    dataType: "number",
    rule: "Giảm giá tiền ship, parse float",
    required: false,
  },
  {
    sourceColumn: "Shipping",
    targetColumn: "Shipping",
    dataType: "number",
    rule: "Phí ship khách trả, parse float",
    required: false,
  },
  {
    sourceColumn: "Sales Tax",
    targetColumn: "Sales Tax",
    dataType: "number",
    rule: "Thuế bán hàng, parse float",
    required: false,
  },
  {
    sourceColumn: "Order Total",
    targetColumn: "Order Total",
    dataType: "number",
    rule: "Tổng tiền khách thanh toán, parse float",
    required: false,
  },
  {
    sourceColumn: "Status",
    targetColumn: "Status",
    dataType: "string",
    rule: "Trạng thái đơn hàng Etsy (nếu có)",
    required: false,
  },
  {
    sourceColumn: "Card Processing Fees",
    targetColumn: "Card Processing Fees",
    dataType: "number",
    rule: "Phí xử lý thẻ, parse float",
    required: false,
  },
  {
    sourceColumn: "Order Net",
    targetColumn: "Order Net",
    dataType: "number",
    rule: "Tiền thực nhận sau phí thẻ, parse float",
    required: false,
  },
  {
    sourceColumn: "Adjusted Order Total",
    targetColumn: "Adjusted Order Total",
    dataType: "number",
    rule: "Tổng tiền sau điều chỉnh, parse float",
    required: false,
  },
  {
    sourceColumn: "Adjusted Card Processing Fees",
    targetColumn: "Adjusted Card Processing Fees",
    dataType: "number",
    rule: "Phí thẻ sau điều chỉnh, parse float",
    required: false,
  },
  {
    sourceColumn: "Adjusted Net Order Amount",
    targetColumn: "Adjusted Net Order Amount",
    dataType: "number",
    rule: "Thực nhận sau điều chỉnh, parse float",
    required: false,
  },
  {
    sourceColumn: "Buyer",
    targetColumn: "Buyer",
    dataType: "string",
    rule: "Tên tài khoản người mua",
    required: false,
  },
  {
    sourceColumn: "Order Type",
    targetColumn: "Order Type",
    dataType: "string",
    rule: "Loại đơn hàng (online...)",
    required: false,
  },
  {
    sourceColumn: "Payment Type",
    targetColumn: "Payment Type",
    dataType: "string",
    rule: "Hình thức thanh toán (online_cc...)",
    required: false,
  },
  {
    sourceColumn: "InPerson Discount",
    targetColumn: "InPerson Discount",
    dataType: "number",
    rule: "Giảm giá bán trực tiếp, parse float",
    required: false,
  },
  {
    sourceColumn: "InPerson Location",
    targetColumn: "InPerson Location",
    dataType: "string",
    rule: "Địa điểm bán trực tiếp",
    required: false,
  },
  {
    sourceColumn: "SKU",
    targetColumn: "SKU",
    dataType: "string",
    rule: "Danh sách SKU các món hàng trong đơn, giữ nguyên text phân cách bởi dấu phẩy",
    required: false,
  },
  {
    sourceColumn: "[Tự động gán theo Shop]",
    targetColumn: "Store",
    dataType: "string",
    rule: 'Giá trị cố định "97Decor" theo cấu hình BO Ms. Linh',
    required: true,
  },
];

export interface ParseAndMapResult {
  rows: MappedOrderRow[];
  summary: OrdersValidationSummary;
  mappingTable: ColumnMappingInfo[];
}

/**
 * Kiểm tra tên file để đảm bảo không import nhầm file của shop khác vào 97Decor.
 * Chú ý: Đây là kiểm tra tên file kết hợp với lựa chọn shop của người dùng, không phải xác minh nguồn gốc tuyệt đối.
 */
export function validateShopFilename(
  fileName: string,
  targetShopCode = "97DECOR",
): { valid: boolean; error?: string } {
  const lower = fileName.toLowerCase();

  // Kiểm tra nếu tên file chứa tên các shop khác
  const otherShops = [
    { code: "97DECOR", pattern: "97decor" },
    { code: "EVERNEST", pattern: "evernest" },
    { code: "ORIVIA", pattern: "orivia" },
    { code: "TIMOND", pattern: "timond" },
    { code: "ARTISAN", pattern: "artisan" },
    { code: "KINDLORA", pattern: "kindlora" },
    { code: "EVERMIRTH", pattern: "evermirth" },
    { code: "POCDY", pattern: "pocdy" },
  ];

  for (const other of otherShops) {
    if (other.code !== targetShopCode && lower.includes(other.pattern)) {
      return {
        valid: false,
        error: `Tên file "${fileName}" chứa nhận diện của shop "${other.code}". Không được gán file của shop khác vào ${targetShopCode}.`,
      };
    }
  }

  // Khuyến nghị tên file chứa 97decor (nhưng không bắt buộc tuyệt đối nếu người dùng đã chủ động chọn shop 97Decor)
  return { valid: true };
}

/**
 * Phân tích và ánh xạ file Etsy Sold Orders CSV thành cấu trúc 37 cột RAW.Orders
 */
export function parseAndMapEtsyOrders(
  csvContent: string,
  fileName: string,
  fileSizeBytes: number,
  options?: {
    shopCode?: string;
    storeValue?: string;
  },
): ParseAndMapResult {
  const shopCode = options?.shopCode || "97DECOR";
  const storeValue = options?.storeValue || "97Decor";

  // 1. Kiểm tra nhận diện tên file
  const shopCheck = validateShopFilename(fileName, shopCode);
  if (!shopCheck.valid) {
    throw new Error(shopCheck.error);
  }

  // 2. Parse CSV
  const rawRows = parseCsv(csvContent);
  if (rawRows.length === 0) {
    throw new Error("File CSV rỗng, không có dữ liệu.");
  }

  const rawHeaders = rawRows[0].map((h) => h.trim());

  // 3. Kiểm tra trùng lặp header trong file nguồn
  const headerCountMap = new Map<string, number>();
  for (const h of rawHeaders) {
    headerCountMap.set(h, (headerCountMap.get(h) || 0) + 1);
  }
  const duplicatedHeaders = Array.from(headerCountMap.entries())
    .filter(([_, count]) => count > 1)
    .map(([h]) => h);
  if (duplicatedHeaders.length > 0) {
    throw new Error(
      `File CSV chứa header bị trùng lặp: ${duplicatedHeaders.join(", ")}. Vui lòng kiểm tra lại cấu trúc file.`,
    );
  }

  // 4. Kiểm tra thiếu header bắt buộc (phải đủ 36 cột Etsy chuẩn)
  const headerIndexMap = new Map<string, number>();
  for (let idx = 0; idx < rawHeaders.length; idx++) {
    headerIndexMap.set(rawHeaders[idx], idx);
  }

  const missingHeaders = ETSY_ORDERS_SOURCE_HEADERS.filter(
    (h) => !headerIndexMap.has(h),
  );
  if (missingHeaders.length > 0) {
    throw new Error(
      `File CSV thiếu ${missingHeaders.length} cột bắt buộc của Etsy Sold Orders: ${missingHeaders.join(", ")}.`,
    );
  }

  // 5. Duyệt và ánh xạ từng dòng dữ liệu
  const mappedRows: MappedOrderRow[] = [];
  const errors: ValidationErrorItem[] = [];
  const warnings: string[] = [];

  const orderIdRowMap = new Map<string, number[]>();

  for (let rowIndex = 1; rowIndex < rawRows.length; rowIndex++) {
    const rawRow = rawRows[rowIndex];
    const rowNumber = rowIndex + 1; // 1-indexed trong Excel

    // Bỏ qua dòng trống hoàn toàn
    if (rawRow.every((cell) => cell.trim() === "")) {
      continue;
    }

    const rowObj: Partial<MappedOrderRow> = {};
    let rowHasError = false;

    // Map 36 cột nguồn theo tên cột
    for (const header of ETSY_ORDERS_SOURCE_HEADERS) {
      const colIndex = headerIndexMap.get(header) ?? -1;
      const rawValue = colIndex < rawRow.length ? rawRow[colIndex] : "";
      const trimmedValue = rawValue.trim();

      if (trimmedValue === "") {
        // Trường trống giữ trống (null trong cell)
        rowObj[header as RawOrderHeader] = null;
        continue;
      }

      if (NUMERIC_COLUMNS.has(header)) {
        // Loại bỏ dấu phẩy phân tách nghìn nếu có
        const cleanNumStr = trimmedValue.replaceAll(",", "");
        const num = Number(cleanNumStr);
        if (Number.isNaN(num) || !Number.isFinite(num)) {
          errors.push({
            rowNumber,
            column: header,
            message: `Giá trị "${trimmedValue}" không phải là số hợp lệ.`,
          });
          rowHasError = true;
          rowObj[header as RawOrderHeader] = null;
        } else {
          rowObj[header as RawOrderHeader] = num;
        }
      } else {
        // Cột text (giữ nguyên chuỗi, bao gồm cả số 0 đầu)
        rowObj[header as RawOrderHeader] = trimmedValue;
      }
    }

    // Cột 37: Store
    rowObj.Store = storeValue;

    // Kiểm tra Order ID
    const orderId = String(rowObj["Order ID"] ?? "").trim();
    if (!orderId) {
      errors.push({
        rowNumber,
        column: "Order ID",
        message: "Dòng thiếu Order ID.",
      });
      rowHasError = true;
    } else {
      const existing = orderIdRowMap.get(orderId) || [];
      existing.push(rowNumber);
      orderIdRowMap.set(orderId, existing);
    }

    if (!rowHasError) {
      mappedRows.push(rowObj as MappedOrderRow);
    }
  }

  // 6. Thống kê Order ID trùng lặp
  const duplicateOrderIds: Array<{
    orderId: string;
    count: number;
    rows: number[];
  }> = [];
  for (const [orderId, rowList] of orderIdRowMap.entries()) {
    if (rowList.length > 1) {
      duplicateOrderIds.push({
        orderId,
        count: rowList.length,
        rows: rowList,
      });
      warnings.push(
        `Order ID "${orderId}" xuất hiện ${rowList.length} lần tại các dòng: ${rowList.join(", ")}.`,
      );
    }
  }

  const summary: OrdersValidationSummary = {
    fileName,
    fileSizeBytes,
    totalSourceRows: rawRows.length - 1,
    validRowsCount: mappedRows.length,
    errorRowsCount: errors.length,
    duplicateOrderIds,
    errors,
    warnings,
    shopCode,
    storeValue,
    detectedShopName: storeValue,
  };

  return {
    rows: mappedRows,
    summary,
    mappingTable: ORDERS_MAPPING_RULES,
  };
}
