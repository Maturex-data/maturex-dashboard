import * as XLSX from "xlsx";
import type { CogsParseResult } from "./types";
import { RAW_COGS_HEADERS } from "./types";

export function buildCogsPreviewWorkbook(
  result: CogsParseResult,
): XLSX.WorkBook {
  const { rows, summary, existingComparisons } = result;
  const workbook = XLSX.utils.book_new();

  // ------------------------------------------------------------------
  // Sheet 1: Mapped (14 cột chuẩn RAW.COGS)
  // ------------------------------------------------------------------
  const mappedSheetData = [
    [...RAW_COGS_HEADERS],
    ...rows.map((r) => RAW_COGS_HEADERS.map((h) => r[h] ?? "")),
  ];
  const mappedSheet = XLSX.utils.aoa_to_sheet(mappedSheetData);
  mappedSheet["!cols"] = [
    { wch: 18 }, // Etsy Order ID
    { wch: 18 }, // Supplier Order ID
    { wch: 12 }, // Store
    { wch: 12 }, // Supplier
    { wch: 22 }, // Source date
    { wch: 14 }, // Status nguồn
    { wch: 10 }, // Currency
    { wch: 15 }, // Production cost
    { wch: 15 }, // Shipping cost
    { wch: 10 }, // Tax
    { wch: 12 }, // Other cost
    { wch: 16 }, // Total cost nguồn
    { wch: 16 }, // Source line ID
    { wch: 16 }, // Source file
  ];
  XLSX.utils.book_append_sheet(workbook, mappedSheet, "Mapped");

  // ------------------------------------------------------------------
  // Sheet 2: Validation (Dòng chưa map, ngoài phạm vi, sai lệch số)
  // ------------------------------------------------------------------
  const validationSheetData: (string | number)[][] = [
    ["BÁO CÁO KIỂM TRA & RÀ SOÁT DỮ LIỆU COGS EQUARUS"],
    ["Tên file nguồn:", summary.fileName],
    [
      "Dung lượng:",
      `${(summary.fileSizeBytes / 1024).toFixed(1)} KB (${summary.fileSizeBytes} bytes)`,
    ],
    ["Tổng số dòng đơn hàng:", summary.totalOrdersCount],
    ["Số đơn khớp shop Ms. Linh:", summary.mapped97DecorCount],
    ["Số đơn ngoài phạm vi Ms. Linh:", summary.outOfScopeCount],
    ["Số đơn chưa map được Store:", summary.unmappedCount],
    ["Số đơn xung đột nhiều Store:", summary.conflictCount],
    [
      "Số đơn sai lệch phép tính (Base + Ship != Total):",
      summary.mathDiscrepanciesCount,
    ],
    [""],
    ["DANH SÁCH CÁC VẤN ĐỀ CẦN XỬ LÝ / CHỐNG GHI ĐÈ"],
    [
      "Dòng Excel",
      "Order ID",
      "Payment ID",
      "Phân loại",
      "Store phát hiện",
      "Nội dung chi tiết",
    ],
    ...summary.validationDetails.map((v) => [
      v.rowNumber,
      v.orderId,
      v.paymentId,
      v.status,
      v.detectedStore || "",
      v.message,
    ]),
  ];
  const validationSheet = XLSX.utils.aoa_to_sheet(validationSheetData);
  validationSheet["!cols"] = [
    { wch: 12 },
    { wch: 22 },
    { wch: 16 },
    { wch: 28 },
    { wch: 16 },
    { wch: 65 },
  ];
  XLSX.utils.book_append_sheet(workbook, validationSheet, "Validation");

  // ------------------------------------------------------------------
  // Sheet 3: Existing (Đơn đã có trên COGS và so sánh chi phí)
  // ------------------------------------------------------------------
  const existingSheetData: (string | number)[][] = [
    ["ĐỐI CHIẾU DỮ LIỆU VỚI TAB RAW.COGS HIỆN CÓ"],
    ["Tổng số đơn trong file:", summary.totalOrdersCount],
    ["Số đơn ĐÃ TỒN TẠI trên RAW.COGS:", summary.alreadyInCogsCount],
    ["Số đơn có dữ liệu KHỚP:", summary.identicalCostCount],
    ["Số đơn có dữ liệu THAY ĐỔI:", summary.diffCostCount],
    [""],
    [
      "LƯU Ý CHỐNG NHÂN ĐÔI DỮ LIỆU:",
      "Đối chiếu theo Store + Supplier + Order ID. Dòng giống được bỏ qua; thay đổi cần duyệt; xem tab Import review.",
    ],
    [""],
    [
      "STT",
      "Order ID",
      "Store trên Sheet",
      "Tổng tiền nguồn",
      "Tổng tiền trên Sheet",
      "Chênh lệch",
      "Trạng thái đối chiếu",
    ],
    ...existingComparisons.map((c, idx) => [
      idx + 1,
      c.orderId,
      c.store,
      c.sourceAmount,
      c.existingCost,
      c.difference,
      c.status === "IDENTICAL"
        ? "Khớp hoàn toàn (Skip / Không ghi lại)"
        : c.status === "DIFF_COST"
          ? "Chênh lệch chi phí (Cần duyệt)"
          : "Chưa có trên Sheet (Thêm mới)",
    ]),
  ];
  const existingSheet = XLSX.utils.aoa_to_sheet(existingSheetData);
  existingSheet["!cols"] = [
    { wch: 6 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 18 },
    { wch: 14 },
    { wch: 35 },
  ];
  XLSX.utils.book_append_sheet(workbook, existingSheet, "Existing");

  // ------------------------------------------------------------------
  // Sheet 4: Payment checks (Tổng payment so với tổng dòng đơn)
  // ------------------------------------------------------------------
  const paymentSheetData: (string | number)[][] = [
    ["KIỂM TRA ĐỐI SOÁT TỔNG PAYMENT VÀ CHI TIẾT ĐƠN HÀNG"],
    [""],
    [
      "Mã Payment",
      "Số đơn hàng",
      "Base Cost (Header)",
      "Amazon Ship (Header)",
      "Total Amount (Header)",
      "Tổng đơn Amount (Chi tiết)",
      "Chênh lệch",
      "Claims hoàn tiền",
      "Thực trả (Total Payment)",
      "Đánh giá",
    ],
    ...summary.paymentSummaries.map((p) => [
      p.paymentId,
      p.ordersCount,
      p.totalBaseCost ?? 0,
      p.totalAmazonCost ?? 0,
      p.totalAmount ?? 0,
      p.sumOrdersAmount,
      p.difference,
      p.claimsBack ?? 0,
      p.totalPayment ?? 0,
      Math.abs(p.difference) < 0.01
        ? "Khớp chính xác 100%"
        : `LỆCH ${p.difference} USD (Cần chốt phương án)`,
    ]),
    [""],
    ["GHI CHÚ NGHIỆP VỤ"],
    [
      "1.",
      "Nhóm payment PN00001-00035 đang chênh lệch 631,55 USD giữa tổng payment (1.398,22) và tổng 28 dòng đơn (766,67).",
    ],
    [
      "2.",
      "Hệ thống không tự ý phân bổ phần chênh lệch này vào các đơn hàng. Chờ chỉ định của quản trị viên.",
    ],
  ];
  const paymentSheet = XLSX.utils.aoa_to_sheet(paymentSheetData);
  paymentSheet["!cols"] = [
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 20 },
    { wch: 20 },
    { wch: 24 },
    { wch: 14 },
    { wch: 16 },
    { wch: 22 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(workbook, paymentSheet, "Payment checks");

  return workbook;
}

export function exportCogsPreviewToBuffer(
  result: CogsParseResult,
  plan?: ReturnType<typeof import("./import-plan").planCogs>,
): Buffer {
  const workbook = buildCogsPreviewWorkbook(result);
  if (plan) {
    const review = [
      [
        "Order ID",
        "Khóa",
        "Phân loại",
        "Cột",
        "Trên Sheet",
        "Trong file",
        "Lỗi",
      ],
    ];
    for (const d of plan.decisions) {
      if (d.changes.length)
        for (const c of d.changes)
          review.push([
            d.orderId,
            d.key,
            d.kind,
            c.column,
            String(c.before),
            String(c.after),
            d.message || "",
          ]);
      else review.push([d.orderId, d.key, d.kind, "", "", "", d.message || ""]);
    }
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet(review),
      "Import review",
    );
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
