import * as XLSX from "xlsx";
import { parseOrderManagement } from "./order-management-parser";
import type { EquarusPaymentSummary, EquarusRawOrderRow } from "./types";

function parseCost(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "")
    return null;
  const text = String(value).trim();
  if (!/^-?\d+(?:\.\d*)?$/.test(text) || !Number.isFinite(Number(text)))
    throw new Error("Giá trị chi phí Equarus không hợp lệ.");
  return Number(text);
}

export interface ParsedEquarusWorkbook {
  paymentSummaries: EquarusPaymentSummary[];
  orderRows: EquarusRawOrderRow[];
}

/**
 * Định dạng ngày từ Excel serial number hoặc chuỗi sang YYYY-MM-DD 00:00:00
 */
export function formatEquarusDate(
  val: string | number | null | undefined,
): string {
  if (val === null || val === undefined || val === "") return "";
  if (typeof val === "number") {
    try {
      const parsed = XLSX.SSF.parse_date_code(val);
      if (parsed) {
        const pad = (n: number) => String(n).padStart(2, "0");
        return `${parsed.y}-${pad(parsed.m)}-${pad(parsed.d)} 00:00:00`;
      }
    } catch {
      // Fallback nếu lỗi parse serial date
    }
  }

  const s = String(val).trim();
  if (!s) return "";
  if (s.includes("00:00:00")) return s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return `${s} 00:00:00`;
  return s;
}

/**
 * Phân tích cấu trúc bảng hai tầng trong sheet 'Payment Management' của file COGS-Equarus
 */
export function parseEquarusWorkbook(
  fileBuffer: Buffer | ArrayBuffer,
): ParsedEquarusWorkbook {
  const workbook = XLSX.read(fileBuffer, { type: "buffer" });
  if (workbook.Sheets["Order Management"])
    return parseOrderManagement(workbook.Sheets["Order Management"]);
  const sheetName = "Payment Management";
  const worksheet = workbook.Sheets[sheetName];

  if (!worksheet) {
    throw new Error(
      `File Excel không chứa worksheet "${sheetName}". Các sheets hiện có: ${workbook.SheetNames.join(", ")}`,
    );
  }

  // Đọc ma trận các ô theo định dạng mảng 2 chiều
  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
  }) as (string | number | null | undefined)[][];

  if (matrix.length < 3) {
    throw new Error(
      "Worksheet Payment Management không đủ dữ liệu (tối thiểu 3 hàng).",
    );
  }

  const expected = new Map([
    [5, "Create Day"],
    [6, "Order ID"],
    [7, "Order Base Cost"],
    [8, "Order Amazon Fulfillment Cost"],
    [9, "Order Amount"],
    [13, "Order Status"],
  ]);
  for (const [index, header] of expected)
    if (String(matrix[1][index] ?? "").trim() !== header)
      throw new Error(`Header Equarus không khớp: ${header}`);

  const paymentSummaries: EquarusPaymentSummary[] = [];
  const orderRows: EquarusRawOrderRow[] = [];

  let currentPayment: EquarusPaymentSummary | null = null;
  let currentPaymentOrdersSum = 0;

  for (let r = 2; r < matrix.length; r++) {
    const row = matrix[r];
    const rowNumber = r + 1; // 1-indexed

    // Cột 1 (index 1): Payment ID (vd: PN00001-00037)
    const paymentIdCell = row[1];
    if (
      paymentIdCell !== undefined &&
      paymentIdCell !== null &&
      String(paymentIdCell).trim() !== ""
    ) {
      const pId = String(paymentIdCell).trim();

      // Lưu block payment trước đó nếu có
      if (currentPayment) {
        currentPayment.sumOrdersAmount = Number(
          currentPaymentOrdersSum.toFixed(2),
        );
        currentPayment.difference = Number(
          ((currentPayment.totalAmount ?? 0) - currentPaymentOrdersSum).toFixed(
            2,
          ),
        );
        paymentSummaries.push(currentPayment);
      }

      const totalBaseCost = parseCost(row[14]);
      const totalAmazonCost = parseCost(row[15]);
      const totalAmount = parseCost(row[16]);
      const claimsBack = parseCost(row[32]);
      const totalPayment = parseCost(row[33]);

      currentPayment = {
        paymentId: pId,
        totalBaseCost,
        totalAmazonCost,
        totalAmount,
        claimsBack,
        totalPayment,
        ordersCount: 0,
        sumOrdersAmount: 0,
        difference: 0,
      };
      currentPaymentOrdersSum = 0;
    }

    // Cột 6 (index 6): Order ID trong nhóm Order ID List
    const orderIdCell = row[6];
    if (
      orderIdCell !== undefined &&
      orderIdCell !== null &&
      String(orderIdCell).trim() !== ""
    ) {
      if (typeof orderIdCell === "number" && !Number.isSafeInteger(orderIdCell))
        throw new Error(
          "Order ID dạng số vượt giới hạn chính xác; cần export ID dạng text.",
        );
      const orderId = String(orderIdCell).trim();
      const createDay = row[5] ?? null;
      const orderBaseCost = parseCost(row[7]);
      const orderAmazonFulfillmentCost = parseCost(row[8]);
      const orderAmount = parseCost(row[9]);
      const orderStatus = String(row[13] ?? "").trim();

      if (currentPayment) {
        currentPayment.ordersCount += 1;
        if (orderAmount !== null) {
          currentPaymentOrdersSum += orderAmount;
        }
      }

      orderRows.push({
        paymentId: currentPayment?.paymentId ?? "",
        createDay,
        orderId,
        orderBaseCost,
        orderAmazonFulfillmentCost,
        orderAmount,
        orderStatus,
        rowNumber,
      });
    }
  }

  // Kết thúc block payment cuối cùng
  if (currentPayment) {
    currentPayment.sumOrdersAmount = Number(currentPaymentOrdersSum.toFixed(2));
    currentPayment.difference = Number(
      ((currentPayment.totalAmount ?? 0) - currentPaymentOrdersSum).toFixed(2),
    );
    paymentSummaries.push(currentPayment);
  }

  return {
    paymentSummaries,
    orderRows,
  };
}
