import { isLinhShop } from "@/lib/fl/bo-import-config";
import { formatEquarusDate } from "./equarus-parser";
import type {
  CogsExistingComparison,
  CogsParseResult,
  CogsValidationDetail,
  CogsValidationSummary,
  EquarusPaymentSummary,
  EquarusRawOrderRow,
  MappedCogsRow,
} from "./types";

export interface OrdersStoreLookupItem {
  orderId: string;
  store: string;
}

export interface ExistingCogsItem {
  orderId: string;
  store: string;
  supplier: string;
  totalCost: number;
}

export interface CogsMapperOptions {
  fileName: string;
  fileSizeBytes: number;
  ordersLookup: Map<string, Set<string>>;
  existingCogsMap?: Map<string, ExistingCogsItem>;
}

/**
 * Chuẩn hóa tên store: "97decor", "97Decor" -> "97DECOR", "Timond", "timond" -> "TIMOND"
 */
export function normalizeStoreName(rawStore: string): string {
  const s = (rawStore || "").trim();
  if (!s) return "";
  if (
    s.toLowerCase().includes("97decor") ||
    s.toLowerCase().includes("97 decor")
  ) {
    return "97DECOR";
  }
  if (s.toLowerCase().includes("timond")) {
    return "TIMOND";
  }
  return s.toUpperCase();
}

/**
 * Ánh xạ danh sách đơn Equarus sang 14 cột chuẩn RAW.COGS và kiểm tra tính toàn vẹn
 */
export function mapEquarusOrdersToCogs(
  orderRows: EquarusRawOrderRow[],
  paymentSummaries: EquarusPaymentSummary[],
  options: CogsMapperOptions,
): CogsParseResult {
  const { fileName, fileSizeBytes, ordersLookup, existingCogsMap } = options;

  const mappedRows: MappedCogsRow[] = [];
  const validationDetails: CogsValidationDetail[] = [];
  const existingComparisons: CogsExistingComparison[] = [];
  const warnings: string[] = [];

  let skippedOrdersCount = 0;
  let mapped97DecorCount = 0;
  let outOfScopeCount = 0;
  let unmappedCount = 0;
  let conflictCount = 0;
  let mathDiscrepanciesCount = 0;
  let alreadyInCogsCount = 0;
  let identicalCostCount = 0;
  let diffCostCount = 0;

  for (const raw of orderRows) {
    const { orderId, rowNumber, paymentId } = raw;
    // Confirmed TikTok order excluded by the user; do not infer channel from ID length.
    if (orderId === "577568415222501945") {
      skippedOrdersCount++;
      validationDetails.push({
        orderId,
        rowNumber,
        paymentId,
        status: "SKIPPED_TIKTOK",
        message:
          "Bỏ qua đơn TikTok theo xác nhận của người dùng; không ghi COGS.",
      });
      continue;
    }
    const hasReplaceSuffix = /-Replace$/i.test(orderId);

    // 1. Tra cứu Store từ bảng RAW.Orders
    // Use the original order only to resolve Store. Keep the replacement ID
    // unchanged in mapped rows and existing-cost comparisons below.
    const directStores = ordersLookup.get(orderId);
    const lookupStores =
      directStores && directStores.size > 0
        ? directStores
        : hasReplaceSuffix
          ? ordersLookup.get(orderId.replace(/-Replace$/i, ""))
          : directStores;
    const sourceStore = normalizeStoreName(raw.sourceStore ?? "");
    const ordersStores = lookupStores
      ? new Set(
          Array.from(lookupStores).map(normalizeStoreName).filter(Boolean),
        )
      : undefined;
    const storesSet = ordersStores;
    if (
      sourceStore &&
      ordersStores?.size === 1 &&
      !ordersStores.has(sourceStore)
    ) {
      conflictCount++;
      validationDetails.push({
        orderId,
        rowNumber,
        paymentId,
        status: "CONFLICT_SOURCE_STORE",
        detectedStore: sourceStore,
        message: `Store trong COGS (${sourceStore}) khác RAW.Orders (${Array.from(ordersStores).join(", ")}); cần sửa nguồn hoặc import lại Orders trước.`,
      });
      continue;
    }
    let resolvedStore = "";

    if (!storesSet || storesSet.size === 0) {
      unmappedCount++;
      if (hasReplaceSuffix) {
        validationDetails.push({
          orderId,
          rowNumber,
          paymentId,
          status: "UNMAPPED_REPLACE_SUFFIX",
          message:
            "Không tìm thấy đơn '-Replace' hoặc đơn gốc trong RAW.Orders. Cần import Orders của kỳ tương ứng trước.",
        });
      } else {
        validationDetails.push({
          orderId,
          rowNumber,
          paymentId,
          status: "UNMAPPED_MISSING_ORDERS",
          message:
            "Không tìm thấy Order ID trong tab RAW.Orders. Cần import Orders của kỳ tương ứng trước.",
        });
      }
    } else if (storesSet.size > 1) {
      conflictCount++;
      const detected = Array.from(storesSet).join(", ");
      validationDetails.push({
        orderId,
        rowNumber,
        paymentId,
        status: "CONFLICT_MULTIPLE_STORES",
        detectedStore: detected,
        message: `Xung đột: Order ID khớp nhiều Store khác nhau (${detected}).`,
      });
    } else {
      // Khớp đúng 1 store
      const originalStore = Array.from(storesSet)[0];
      const normStore = normalizeStoreName(originalStore);

      if (isLinhShop(normStore)) {
        mapped97DecorCount++;
        resolvedStore = normStore;
      } else {
        // Ngoài phạm vi Ms. Linh (ví dụ: TIMOND)
        outOfScopeCount++;
        resolvedStore = normStore;
        validationDetails.push({
          orderId,
          rowNumber,
          paymentId,
          status: "OUT_OF_SCOPE",
          detectedStore: normStore,
          message: `Đơn hàng thuộc shop "${normStore}" (ngoài phạm vi 97Decor và Timond của Ms. Linh). Không tự động chuyển thành 97Decor.`,
        });
      }
    }

    // 2. Kiểm tra tính toán chi phí: Production cost + Shipping cost = Total cost nguồn
    const baseCostNum = raw.orderBaseCost ?? 0;
    const shipCostNum = raw.orderAmazonFulfillmentCost ?? 0;
    const totalAmountNum = raw.orderAmount ?? 0;
    const calculatedTotal = Number((baseCostNum + shipCostNum).toFixed(2));
    const isMathMismatch =
      raw.orderBaseCost !== null &&
      raw.orderAmazonFulfillmentCost !== null &&
      raw.orderAmount !== null &&
      Math.abs(calculatedTotal - totalAmountNum) >= 0.01;

    if (isMathMismatch) {
      mathDiscrepanciesCount++;
      validationDetails.push({
        orderId,
        rowNumber,
        paymentId,
        status: "MAPPED_97DECOR",
        message: `Sai lệch chi phí: Base Cost (${baseCostNum}) + Shipping (${shipCostNum}) = ${calculatedTotal} ≠ Total Amount nguồn (${totalAmountNum}).`,
      });
    }

    // 3. Đối chiếu với dữ liệu hiện có trong RAW.COGS
    if (existingCogsMap) {
      const existingKey = orderId;
      const existing = existingCogsMap.get(existingKey);
      if (existing) {
        alreadyInCogsCount++;
        const costDiff = Number(
          (existing.totalCost - totalAmountNum).toFixed(2),
        );
        if (Math.abs(costDiff) < 0.01) {
          identicalCostCount++;
          existingComparisons.push({
            orderId,
            store: existing.store,
            sourceAmount: totalAmountNum,
            existingCost: existing.totalCost,
            difference: 0,
            status: "IDENTICAL",
          });
        } else {
          diffCostCount++;
          existingComparisons.push({
            orderId,
            store: existing.store,
            sourceAmount: totalAmountNum,
            existingCost: existing.totalCost,
            difference: costDiff,
            status: "DIFF_COST",
          });
        }
      } else {
        existingComparisons.push({
          orderId,
          store: resolvedStore,
          sourceAmount: totalAmountNum,
          existingCost: 0,
          difference: totalAmountNum,
          status: "NOT_IN_COGS",
        });
      }
    }

    // 4. Ánh xạ sang 14 cột của RAW.COGS
    const mappedRow: MappedCogsRow = {
      "Etsy Order ID": orderId,
      "Supplier Order ID": "",
      Store: resolvedStore,
      Supplier: "EQUARUS",
      "Source date": formatEquarusDate(raw.createDay),
      "Status nguồn": raw.orderStatus,
      Currency: "",
      "Production cost": raw.orderBaseCost !== null ? raw.orderBaseCost : "",
      "Shipping cost":
        raw.orderAmazonFulfillmentCost !== null
          ? raw.orderAmazonFulfillmentCost
          : "",
      Tax: "",
      "Other cost": "",
      "Total cost nguồn": raw.orderAmount !== null ? raw.orderAmount : "",
      "Source line ID": "",
      "Source file": "",
    };

    mappedRows.push(mappedRow);
  }

  if (skippedOrdersCount > 0) {
    warnings.push(
      `Đã bỏ qua ${skippedOrdersCount} dòng của đơn TikTok 577568415222501945 theo xác nhận; không ghi vào RAW.COGS.`,
    );
  }
  // 5. Thêm cảnh báo tổng hợp
  if (unmappedCount > 0) {
    warnings.push(
      `Có ${unmappedCount} đơn hàng chưa map được Store từ RAW.Orders. Đơn '-Replace' đã được tra thêm bằng ID đơn gốc. Cần import Orders tương ứng trước khi ghi.`,
    );
  }
  if (outOfScopeCount > 0) {
    warnings.push(
      `Có ${outOfScopeCount} đơn hàng thuộc shop khác (TIMOND) ngoài phạm vi shop 97Decor và Timond của Ms. Linh. Cần phân loại an toàn, không tự chuyển đổi Store.`,
    );
  }
  for (const p of paymentSummaries) {
    if (Math.abs(p.difference) >= 0.01) {
      warnings.push(
        `Nhóm payment ${p.paymentId} có chênh lệch: Tổng payment ${p.totalAmount} so với tổng chi tiết đơn hàng ${p.sumOrdersAmount} (Chênh lệch: ${p.difference}). Cần chốt trước khi bật ghi.`,
      );
    }
  }
  if (alreadyInCogsCount === orderRows.length && diffCostCount === 0) {
    warnings.push(
      `Toàn bộ ${alreadyInCogsCount} đơn hàng trong file đã tồn tại trên tab RAW.COGS với chi phí khớp 100%. Không được append lại gây nhân đôi dữ liệu.`,
    );
  }

  const summary: CogsValidationSummary = {
    fileName,
    fileSizeBytes,
    totalOrdersCount: orderRows.length,
    skippedOrdersCount,
    mapped97DecorCount,
    outOfScopeCount,
    unmappedCount,
    conflictCount,
    alreadyInCogsCount,
    identicalCostCount,
    diffCostCount,
    paymentSummaries,
    mathDiscrepanciesCount,
    validationDetails,
    warnings,
  };

  return {
    headers: [
      "Etsy Order ID",
      "Supplier Order ID",
      "Store",
      "Supplier",
      "Source date",
      "Status nguồn",
      "Currency",
      "Production cost",
      "Shipping cost",
      "Tax",
      "Other cost",
      "Total cost nguồn",
      "Source line ID",
      "Source file",
    ],
    rows: mappedRows,
    summary,
    existingComparisons,
  };
}
