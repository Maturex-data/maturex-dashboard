import assert from "node:assert";
import * as fs from "node:fs";
import * as XLSX from "xlsx";
import { parseCsv } from "../src/lib/fl/orders-parser/csv-parser";
import {
  parseAndMapEtsyOrders,
  validateShopFilename,
} from "../src/lib/fl/orders-parser/orders-mapper";
import {
  ETSY_ORDERS_SOURCE_HEADERS,
  RAW_ORDERS_HEADERS,
} from "../src/lib/fl/orders-parser/types";
import { exportOrdersPreviewToFile } from "../src/lib/fl/orders-parser/xlsx-exporter";

console.log("=== BẮT ĐẦU CHẠY TEST ORDERS PARSER & MAPPER ===");

// 1. Kiểm tra đủ 37 cột đúng thứ tự
console.log("\n[Test 1] Kiểm tra đủ 37 cột đích đúng thứ tự:");
assert.strictEqual(RAW_ORDERS_HEADERS.length, 37, "Phải có đúng 37 cột đích");
assert.strictEqual(
  RAW_ORDERS_HEADERS[0],
  "Sale Date",
  "Cột 1 phải là Sale Date",
);
assert.strictEqual(RAW_ORDERS_HEADERS[36], "Store", "Cột 37 phải là Store");
assert.strictEqual(
  ETSY_ORDERS_SOURCE_HEADERS.length,
  36,
  "Phải có đúng 36 cột nguồn Etsy",
);
console.log("✓ Đủ 37 cột đúng thứ tự.");

// 2. Kiểm tra CSV có BOM, dấu phẩy và xuống dòng trong ô
console.log(
  "\n[Test 2] Kiểm tra CSV parser với BOM, dấu phẩy và xuống dòng trong ô:",
);
const testCsvWithBomAndMultiline =
  '\uFEFF"Header 1","Header 2","Header 3"\r\n"Val 1","Val, with comma","Line 1\nLine 2"\r\n"Escaped ""quotes""","Simple",123';
const parsedCells = parseCsv(testCsvWithBomAndMultiline);
assert.strictEqual(parsedCells.length, 3, "Phải có 3 dòng (1 header + 2 data)");
assert.strictEqual(
  parsedCells[0][0],
  "Header 1",
  "BOM phải được strip khỏi header đầu",
);
assert.strictEqual(
  parsedCells[1][1],
  "Val, with comma",
  "Phải parse đúng ô chứa dấu phẩy",
);
assert.strictEqual(
  parsedCells[1][2],
  "Line 1\nLine 2",
  "Phải parse đúng ô chứa xuống dòng",
);
assert.strictEqual(
  parsedCells[2][0],
  'Escaped "quotes"',
  "Phải parse đúng escaped quotes",
);
console.log(
  "✓ CSV parser hỗ trợ hoàn hảo BOM, quoted commas, multiline cells và escaped quotes.",
);

// 3. ID / Zipcode / SKU bảo toàn số 0 đầu
console.log("\n[Test 3] Kiểm tra ID, Zipcode, SKU bảo toàn text và số 0 đầu:");
const headerRow = ETSY_ORDERS_SOURCE_HEADERS.join(",");
const mockRowLeadingZeros = ETSY_ORDERS_SOURCE_HEADERS.map((h) => {
  if (h === "Order ID") return "04188182467";
  if (h === "Ship Zipcode") return "07030";
  if (h === "SKU") return "0012397DC";
  if (h === "Buyer User ID") return "009buyer";
  if (h === "Sale Date") return "09/30/26";
  if (h === "Order Value") return "50.00";
  return "";
}).join(",");

const mockCsvContent = `${headerRow}\n${mockRowLeadingZeros}`;
const resultLeadingZero = parseAndMapEtsyOrders(
  mockCsvContent,
  "97decor_test.csv",
  1000,
);
const firstRow = resultLeadingZero.rows[0];

assert.strictEqual(
  firstRow["Order ID"],
  "04188182467",
  "Order ID không được mất số 0 đầu",
);
assert.strictEqual(
  firstRow["Ship Zipcode"],
  "07030",
  "Ship Zipcode không được mất số 0 đầu",
);
assert.strictEqual(firstRow.SKU, "0012397DC", "SKU không được mất số 0 đầu");
assert.strictEqual(
  firstRow["Buyer User ID"],
  "009buyer",
  "Buyer User ID không được mất số 0 đầu",
);
assert.strictEqual(
  firstRow.Store,
  "97Decor",
  "Cột Store phải được gán đúng 97Decor",
);
console.log("✓ ID, Zipcode, SKU và User ID giữ nguyên dạng chuỗi text.");

// 4. Ô trống giữ trống, không tự điền 0 hoặc ngày giả
console.log("\n[Test 4] Kiểm tra ô trống không bị biến thành 0 hoặc ngày giả:");
assert.strictEqual(
  firstRow["Discount Amount"],
  null,
  "Discount Amount trống phải là null",
);
assert.strictEqual(
  firstRow["Shipping Discount"],
  null,
  "Shipping Discount trống phải là null",
);
assert.strictEqual(
  firstRow["Date Shipped"],
  null,
  "Date Shipped trống phải là null",
);
assert.strictEqual(
  firstRow["InPerson Discount"],
  null,
  "InPerson Discount trống phải là null",
);
console.log("✓ Ô trống không bị ép thành 0 hoặc giá trị giả.");

// 5. Kiểm tra lỗi: Header thiếu, trùng, hoặc số không hợp lệ
console.log(
  "\n[Test 5] Kiểm tra bắt lỗi Header thiếu, trùng lặp và số không hợp lệ:",
);

// 5a: Thiếu header
assert.throws(
  () => {
    parseAndMapEtsyOrders("Sale Date,Order ID", "97decor_test.csv", 100);
  },
  /thiếu.*cột bắt buộc/,
  "Phải báo lỗi khi thiếu header",
);
console.log("✓ Bắt lỗi thiếu header thành công.");

// 5b: Trùng header
const dupHeaderCsv = `${headerRow},Order ID\n${mockRowLeadingZeros},04188182467`;
assert.throws(
  () => {
    parseAndMapEtsyOrders(dupHeaderCsv, "97decor_test.csv", 100);
  },
  /trùng lặp/,
  "Phải báo lỗi khi header bị trùng lặp",
);
console.log("✓ Bắt lỗi header bị trùng lặp thành công.");

// 5c: Số tiền không hợp lệ
const mockRowInvalidNumber = ETSY_ORDERS_SOURCE_HEADERS.map((h) => {
  if (h === "Order ID") return "123456";
  if (h === "Sale Date") return "09/30/26";
  if (h === "Order Value") return "NOT_A_NUMBER";
  return "";
}).join(",");
const resultInvalidNum = parseAndMapEtsyOrders(
  `${headerRow}\n${mockRowInvalidNumber}`,
  "97decor_test.csv",
  100,
);
assert.strictEqual(
  resultInvalidNum.summary.errorRowsCount,
  1,
  "Phải ghi nhận dòng có lỗi số",
);
assert.strictEqual(
  resultInvalidNum.summary.errors[0].column,
  "Order Value",
  "Cột báo lỗi phải là Order Value",
);
console.log("✓ Bắt lỗi số tiền không hợp lệ thành công.");

// 6. Kiểm tra phát hiện Order ID trùng lặp
console.log("\n[Test 6] Kiểm tra phát hiện và báo cáo Order ID trùng lặp:");
const mockRowDup1 = ETSY_ORDERS_SOURCE_HEADERS.map((h) => {
  if (h === "Order ID") return "DUP_ORDER_999";
  if (h === "Sale Date") return "09/30/26";
  return "";
}).join(",");
const mockRowDup2 = ETSY_ORDERS_SOURCE_HEADERS.map((h) => {
  if (h === "Order ID") return "DUP_ORDER_999";
  if (h === "Sale Date") return "09/30/26";
  return "";
}).join(",");
const resultDup = parseAndMapEtsyOrders(
  `${headerRow}\n${mockRowDup1}\n${mockRowDup2}`,
  "97decor_test.csv",
  100,
);
assert.strictEqual(
  resultDup.summary.duplicateOrderIds.length,
  1,
  "Phải phát hiện 1 Order ID bị trùng",
);
assert.strictEqual(
  resultDup.summary.duplicateOrderIds[0].orderId,
  "DUP_ORDER_999",
);
assert.strictEqual(
  resultDup.summary.duplicateOrderIds[0].count,
  2,
  "Xuất hiện 2 lần",
);
console.log("✓ Báo cáo Order ID trùng lặp chính xác.");

// 7. Từ chối file của shop khác
console.log("\n[Test 7] Kiểm tra từ chối file của shop khác:");
const shopCheckOrivia = validateShopFilename(
  "orivia_EtsySoldOrders2026.csv",
  "97DECOR",
);
assert.strictEqual(
  shopCheckOrivia.valid,
  false,
  "Phải từ chối file có tên shop Orivia",
);

const shopCheckTimond = validateShopFilename("timond_orders.csv", "97DECOR");
assert.strictEqual(
  shopCheckTimond.valid,
  false,
  "Phải từ chối file có tên shop Timond",
);

const shopCheckPocdy = validateShopFilename("pocdy_statement.csv", "97DECOR");
assert.strictEqual(
  shopCheckPocdy.valid,
  false,
  "Phải từ chối file có tên shop Pocdy",
);
console.log("✓ Ngăn chặn thành công file của shop khác.");

// 8. Test trên file thực tế và đối chiếu XLSX
console.log(
  "\n[Test 8] Test trực tiếp trên file thật /Users/tatuanthanh/Downloads/linh/97decor_EtsySoldOrders2026-9.csv:",
);
const realFilePath =
  "/Users/tatuanthanh/Downloads/linh/97decor_EtsySoldOrders2026-9.csv";
const realCsvContent = fs.readFileSync(realFilePath, "utf-8");
const realStat = fs.statSync(realFilePath);

const realResult = parseAndMapEtsyOrders(
  realCsvContent,
  "97decor_EtsySoldOrders2026-9.csv",
  realStat.size,
  {
    shopCode: "97DECOR",
    storeValue: "97Decor",
  },
);

assert.strictEqual(
  realResult.summary.totalSourceRows,
  191,
  "Tổng dòng nguồn phải là 191",
);
assert.strictEqual(
  realResult.summary.validRowsCount,
  191,
  "Tổng dòng hợp lệ phải là 191",
);
assert.strictEqual(
  realResult.summary.errorRowsCount,
  0,
  "Số dòng lỗi phải là 0",
);
assert.strictEqual(
  realResult.summary.duplicateOrderIds.length,
  0,
  "Số Order ID trùng phải là 0",
);

// Đối chiếu dòng đầu tiên với file nguồn
const firstRealRow = realResult.rows[0];
assert.strictEqual(firstRealRow["Order ID"], "4188182467");
assert.strictEqual(firstRealRow["Buyer User ID"], "adockter0318");
assert.strictEqual(firstRealRow["Order Value"], 83.82);
assert.strictEqual(firstRealRow["Order Total"], 86.67);
assert.strictEqual(firstRealRow.SKU, "97DC130128000000,97DC126157000000");
assert.strictEqual(firstRealRow.Store, "97Decor");

// Xuất file preview XLSX và kiểm tra lại từ file đã xuất
const previewPath =
  "/Users/tatuanthanh/Downloads/data/linh-97decor-orders-preview.xlsx";
exportOrdersPreviewToFile(realResult, previewPath);
assert.ok(
  fs.existsSync(previewPath),
  "File preview XLSX phải tồn tại trên đĩa",
);

const wbRead = XLSX.readFile(previewPath);
assert.deepStrictEqual(
  wbRead.SheetNames,
  ["RAW.Orders", "Mapping", "Validation"],
  "XLSX phải có đúng 3 sheet",
);

const sheetRows = XLSX.utils.sheet_to_json(wbRead.Sheets["RAW.Orders"], {
  header: 1,
});
assert.strictEqual(
  sheetRows.length,
  192,
  "RAW.Orders phải có đúng 192 dòng (1 header + 191 data)",
);
assert.strictEqual(
  (sheetRows[0] as unknown[]).length,
  37,
  "RAW.Orders phải có đúng 37 cột",
);

console.log(
  `✓ Đã kiểm tra đối chiếu hoàn tất 191 dòng nguồn khớp 100% với file XLSX preview: ${previewPath}`,
);
console.log("\n=== TẤT CẢ 8 TEST CASES ĐÃ PASS THÀNH CÔNG 100%! ===");
