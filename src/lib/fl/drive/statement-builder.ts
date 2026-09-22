import { prisma } from "@/lib/prisma";
import {
  databaseDateRange,
  type FlowaSheetValue,
  flowaShopLabel,
  formatEtsyStatementDate,
  numeric,
  REFUND_MONTH_OVERRIDES,
} from "./types";

export async function fetchFlowaStatementValues(
  from: Date,
  to: Date,
  shopCode?: string,
): Promise<FlowaSheetValue[][]> {
  const range = databaseDateRange(from, to);
  const shopCondition =
    shopCode && shopCode !== "ALL" ? { shop: { code: shopCode } } : {};

  const statements = await prisma.etsyStatement.findMany({
    where: {
      statementDate: {
        gte: range.from,
        lt: range.to,
      },
      ...shopCondition,
    },
    include: {
      shop: { select: { code: true, name: true } },
      importBatch: { select: { sourceFileName: true } },
    },
    orderBy: [{ statementDate: "desc" }, { id: "asc" }],
  });

  const statementOrderIds = statements
    .map((item) => item.extractedOrderId)
    .filter((orderId): orderId is string => Boolean(orderId));
  const relatedOrders = statementOrderIds.length
    ? await prisma.etsyOrder.findMany({
        where: { orderId: { in: [...new Set(statementOrderIds)] } },
        select: { orderId: true, saleDate: true },
      })
    : [];
  const orderMonthByOrderId = new Map(
    relatedOrders.map((order) => [
      order.orderId,
      `${order.saleDate.getUTCFullYear()}-${String(order.saleDate.getUTCMonth() + 1).padStart(2, "0")}`,
    ]),
  );

  const cancellationByOrderId = new Map<
    string,
    { sale: number; refund: number; hasSale: boolean; hasRefund: boolean }
  >();
  for (const item of statements) {
    if (
      !item.extractedOrderId ||
      (item.type !== "Sale" && item.type !== "Refund")
    ) {
      continue;
    }
    const summary = cancellationByOrderId.get(item.extractedOrderId) || {
      sale: 0,
      refund: 0,
      hasSale: false,
      hasRefund: false,
    };
    if (item.type === "Sale") {
      summary.sale += numeric(item.amount);
      summary.hasSale = true;
    } else {
      summary.refund += numeric(item.amount);
      summary.hasRefund = true;
    }
    cancellationByOrderId.set(item.extractedOrderId, summary);
  }
  const cancelledOrderIds = new Set(
    [...cancellationByOrderId].flatMap(([orderId, summary]) =>
      !orderMonthByOrderId.has(orderId) &&
      summary.hasSale &&
      summary.hasRefund &&
      Math.abs(summary.sale + summary.refund) < 0.0001
        ? [orderId]
        : [],
    ),
  );
  const reportableStatements = statements.filter(
    (item) =>
      !item.extractedOrderId || !cancelledOrderIds.has(item.extractedOrderId),
  );

  return reportableStatements.map((item, index) => {
    const statementMonth = `${item.statementDate.getUTCFullYear()}-${String(item.statementDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const isRefundAdjustment =
      item.type === "Refund" || item.title === "Refund to buyer for sales tax";
    const month =
      (isRefundAdjustment && item.extractedOrderId
        ? REFUND_MONTH_OVERRIDES[item.extractedOrderId] ||
          orderMonthByOrderId.get(item.extractedOrderId)
        : undefined) || statementMonth;
    const shopName = flowaShopLabel(item.shop.code.toUpperCase(), month);
    const dateFormatted = formatEtsyStatementDate(item.statementDate);
    const orderId = item.extractedOrderId || "";
    const sourceFileName = item.importBatch.sourceFileName || "";

    return [
      month,
      shopName,
      index + 2, // Source row, will be re-indexed during write
      dateFormatted,
      item.type,
      item.title || "",
      item.info || "",
      item.currency || "USD",
      item.amount !== null ? numeric(item.amount) : 0,
      item.feesAndTaxes !== null ? numeric(item.feesAndTaxes) : 0,
      item.net !== null ? numeric(item.net) : 0,
      orderId,
      sourceFileName,
    ];
  });
}
