import { prisma } from "@/lib/prisma";
import {
  cogsCostForReport,
  databaseDateRange,
  type FlowaSheetValue,
  flowaShopLabel,
  flowaSupplierLabel,
  numeric,
  rawArray,
  rawText,
  record,
} from "./types";

export async function fetchFlowaCogsValues(
  from: Date,
  to: Date,
  shopCode?: string,
): Promise<FlowaSheetValue[][]> {
  const range = databaseDateRange(from, to);
  const shopCondition =
    shopCode && shopCode !== "ALL" ? { shop: { code: shopCode } } : {};

  // Find all Etsy orders in the range
  const orders = await prisma.etsyOrder.findMany({
    where: {
      saleDate: {
        gte: range.from,
        lt: range.to,
      },
      ...shopCondition,
    },
    include: {
      shop: { select: { code: true } },
    },
    orderBy: [{ saleDate: "asc" }, { orderId: "asc" }],
  });

  if (!orders.length) return [];

  const orderIds = orders.map((o) => o.orderId);

  // Check matching in CogsRecord
  const cogsRecords = await prisma.cogsRecord.findMany({
    where: {
      referenceOrderId: { in: orderIds },
    },
    select: {
      referenceOrderId: true,
      supplier: true,
      totalCost: true,
      mappingStatus: true,
      date: true,
      rawPayload: true,
    },
  });

  const cogsMap = new Map<
    string,
    Array<{
      supplier: string;
      totalCost: number;
      status: string;
      date: Date;
      rawPayload: unknown;
    }>
  >();

  for (const cogs of cogsRecords) {
    if (cogs.referenceOrderId) {
      const list = cogsMap.get(cogs.referenceOrderId) || [];
      list.push({
        supplier: cogs.supplier,
        totalCost: cogsCostForReport(
          cogs.referenceOrderId,
          numeric(cogs.totalCost),
        ),
        status: cogs.mappingStatus || "OK",
        date: cogs.date,
        rawPayload: cogs.rawPayload,
      });
      cogsMap.set(cogs.referenceOrderId, list);
    }
  }

  // Return COGS rows
  // Columns: [Month, Shop, Order ID, Vendor, Cost USD, Status]
  const rows: FlowaSheetValue[][] = [];

  for (const order of orders) {
    const list = cogsMap.get(order.orderId);
    if (!list || list.length === 0) continue;
    const month = `${order.saleDate.getUTCFullYear()}-${String(order.saleDate.getUTCMonth() + 1).padStart(2, "0")}`;
    const claims = list.filter((cogs) => cogs.supplier === "Claim / Reimburse");
    const ungroupedSourceCosts = list.filter(
      (cogs) => cogs.supplier !== "Claim / Reimburse",
    );
    const sourceCosts = ungroupedSourceCosts.filter((cost) => {
      if (cost.supplier !== "Fastway") return true;
      const isPrimaryShipment =
        rawText(record(cost.rawPayload).orderName) === order.orderId;
      return isPrimaryShipment;
    });
    const claimTotal = claims.reduce((sum, claim) => sum + claim.totalCost, 0);
    const outputCosts = sourceCosts.length
      ? sourceCosts.map((cogs, index) => ({
          ...cogs,
          totalCost: cogs.totalCost + (index === 0 ? claimTotal : 0),
          supplier:
            index === 0 && claimTotal > 0
              ? `${cogs.supplier}+ISSUE`
              : cogs.supplier,
        }))
      : claims;

    for (const cogs of outputCosts) {
      rows.push([
        month,
        flowaShopLabel(order.shop.code.toUpperCase(), month),
        order.orderId,
        flowaSupplierLabel(cogs.supplier),
        cogs.totalCost,
        "OK",
      ]);
    }
  }

  const orphanClaims = await prisma.cogsRecord.findMany({
    where: {
      supplier: "Claim / Reimburse",
      date: { gte: range.from, lt: range.to },
      referenceOrderId: { not: null },
    },
    select: {
      referenceOrderId: true,
      totalCost: true,
      rawPayload: true,
    },
  });
  const orphanOrderIds = orphanClaims
    .map((claim) => claim.referenceOrderId)
    .filter(
      (orderId): orderId is string =>
        typeof orderId === "string" && !orderIds.includes(orderId),
    );

  if (orphanOrderIds.length) {
    const cancelledBases = await prisma.cogsRecord.findMany({
      where: {
        referenceOrderId: { in: [...new Set(orphanOrderIds)] },
        supplier: "EQUARUS",
        mappingStatus: "Cancel",
      },
      select: { referenceOrderId: true, date: true, rawPayload: true },
    });
    const cancelledBaseByOrderId = new Map(
      cancelledBases
        .filter((base): base is typeof base & { referenceOrderId: string } =>
          Boolean(base.referenceOrderId),
        )
        .map((base) => [base.referenceOrderId, base]),
    );

    for (const claim of orphanClaims) {
      if (
        !claim.referenceOrderId ||
        orderIds.includes(claim.referenceOrderId)
      ) {
        continue;
      }
      const base = cancelledBaseByOrderId.get(claim.referenceOrderId);
      if (!base) continue;
      const raw = rawArray(base.rawPayload);
      const orphanShop = rawText(raw[9]).toUpperCase();
      if (
        !orphanShop ||
        (shopCode && shopCode !== "ALL" && orphanShop !== shopCode)
      ) {
        continue;
      }
      const month = `${base.date.getUTCFullYear()}-${String(base.date.getUTCMonth() + 1).padStart(2, "0")}`;
      rows.push([
        month,
        flowaShopLabel(orphanShop, month),
        claim.referenceOrderId,
        "EQUARUS ISSUE - CANCEL",
        numeric(claim.totalCost),
        "OK - Flowa chịu giá vốn đơn cancel",
      ]);
    }
  }

  return rows;
}
