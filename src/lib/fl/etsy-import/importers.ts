import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  cleanText,
  type EtsyImportResult,
  extractOrderId,
  integer,
  jsonRow,
  money,
  monthLabel,
  type ParsedSource,
  parseDate,
  sha256,
} from "./types";

export async function createOrders(
  source: ParsedSource,
  shopId: string,
  batchId: string,
): Promise<{ inserted: number; invalid: number }> {
  let invalid = 0;
  const data: Prisma.EtsyOrderCreateManyInput[] = [];

  for (const row of source.rows) {
    const orderId = cleanText(row["Order ID"]);
    const saleDate = parseDate(row["Sale Date"]);
    if (!orderId || !saleDate) {
      invalid += 1;
      continue;
    }
    data.push({
      id: randomUUID(),
      shopId,
      importBatchId: batchId,
      orderId,
      saleDate,
      buyerUserId: cleanText(row["Buyer User ID"]),
      fullName: cleanText(row["Full Name"]),
      firstName: cleanText(row["First Name"]),
      lastName: cleanText(row["Last Name"]),
      numberOfItems: integer(row["Number of Items"]),
      paymentMethod: cleanText(row["Payment Method"]),
      dateShipped: parseDate(row["Date Shipped"]),
      street1: cleanText(row["Street 1"]),
      street2: cleanText(row["Street 2"]),
      shipCity: cleanText(row["Ship City"]),
      shipState: cleanText(row["Ship State"]),
      shipZipcode: cleanText(row["Ship Zipcode"]),
      shipCountry: cleanText(row["Ship Country"]),
      currency: cleanText(row.Currency),
      orderValue: money(row["Order Value"]),
      couponCode: cleanText(row["Coupon Code"]),
      couponDetails: cleanText(row["Coupon Details"]),
      discountAmount: money(row["Discount Amount"]),
      shippingDiscount: money(row["Shipping Discount"]),
      shipping: money(row.Shipping),
      salesTax: money(row["Sales Tax"]),
      orderTotal: money(row["Order Total"]),
      status: cleanText(row.Status),
      cardProcessingFees: money(row["Card Processing Fees"]),
      orderNet: money(row["Order Net"]),
      adjustedOrderTotal: money(row["Adjusted Order Total"]),
      adjustedCardProcessingFees: money(row["Adjusted Card Processing Fees"]),
      adjustedNetOrderAmount: money(row["Adjusted Net Order Amount"]),
      buyer: cleanText(row.Buyer),
      orderType: cleanText(row["Order Type"]),
      paymentType: cleanText(row["Payment Type"]),
      inPersonDiscount: money(row["InPerson Discount"]),
      inPersonLocation: cleanText(row["InPerson Location"]),
      sku: cleanText(row.SKU),
      rawPayload: jsonRow(row),
    });
  }

  const created = await prisma.etsyOrder.createMany({
    data,
    skipDuplicates: true,
  });
  return { inserted: created.count, invalid };
}

export async function createOrderItems(
  source: ParsedSource,
  shopId: string,
  batchId: string,
): Promise<{ inserted: number; invalid: number }> {
  let invalid = 0;
  const orderIds = source.rows
    .map((row) => cleanText(row["Order ID"]))
    .filter(Boolean) as string[];
  const orders = await prisma.etsyOrder.findMany({
    where: { shopId, orderId: { in: [...new Set(orderIds)] } },
    select: { id: true, orderId: true },
  });
  const orderMap = new Map(orders.map((order) => [order.orderId, order.id]));
  const occurrences = new Map<string, number>();
  const data: Prisma.EtsyOrderItemCreateManyInput[] = [];

  for (const row of source.rows) {
    const orderId = cleanText(row["Order ID"]);
    const saleDate = parseDate(row["Sale Date"]);
    if (!orderId || !saleDate) {
      invalid += 1;
      continue;
    }
    const baseKey =
      cleanText(row["Transaction ID"]) ?? sha256(JSON.stringify(row));
    const occurrence = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, occurrence);
    const etsyOrderId = orderMap.get(orderId) ?? null;
    data.push({
      id: randomUUID(),
      shopId,
      importBatchId: batchId,
      etsyOrderId,
      orderId,
      sourceKey: sha256(`${baseKey}:${occurrence}`),
      transactionId: cleanText(row["Transaction ID"]),
      listingId: cleanText(row["Listing ID"]),
      saleDate,
      itemName: cleanText(row["Item Name"]),
      buyer: cleanText(row.Buyer),
      quantity: integer(row.Quantity),
      price: money(row.Price),
      couponCode: cleanText(row["Coupon Code"]),
      couponDetails: cleanText(row["Coupon Details"]),
      discountAmount: money(row["Discount Amount"]),
      shippingDiscount: money(row["Shipping Discount"]),
      orderShipping: money(row["Order Shipping"]),
      orderSalesTax: money(row["Order Sales Tax"]),
      itemTotal: money(row["Item Total"]),
      currency: cleanText(row.Currency),
      datePaid: parseDate(row["Date Paid"]),
      dateShipped: parseDate(row["Date Shipped"]),
      shipName: cleanText(row["Ship Name"]),
      shipAddress1: cleanText(row["Ship Address1"]),
      shipAddress2: cleanText(row["Ship Address2"]),
      shipCity: cleanText(row["Ship City"]),
      shipState: cleanText(row["Ship State"]),
      shipZipcode: cleanText(row["Ship Zipcode"]),
      shipCountry: cleanText(row["Ship Country"]),
      variations: cleanText(row.Variations),
      orderType: cleanText(row["Order Type"]),
      listingsType: cleanText(row["Listings Type"]),
      paymentType: cleanText(row["Payment Type"]),
      inPersonDiscount: money(row["InPerson Discount"]),
      inPersonLocation: cleanText(row["InPerson Location"]),
      vatPaidByBuyer: money(row["VAT Paid by Buyer"]),
      sku: cleanText(row.SKU),
      matchStatus: etsyOrderId ? "MATCHED" : "UNMATCHED",
      rawPayload: jsonRow(row),
    });
  }

  const created = await prisma.etsyOrderItem.createMany({
    data,
    skipDuplicates: true,
  });
  return { inserted: created.count, invalid };
}

export async function createStatements(
  source: ParsedSource,
  shopId: string,
  batchId: string,
): Promise<{ inserted: number; invalid: number }> {
  let invalid = 0;
  const occurrences = new Map<string, number>();
  const data: Prisma.EtsyStatementCreateManyInput[] = [];

  for (const row of source.rows) {
    const statementDate = parseDate(row.Date);
    const type = cleanText(row.Type);
    if (!statementDate || !type) {
      invalid += 1;
      continue;
    }
    const signature = JSON.stringify([
      statementDate.toISOString().slice(0, 10),
      type,
      cleanText(row.Title),
      cleanText(row.Info),
      cleanText(row.Currency),
      money(row.Amount),
      money(row["Fees & Taxes"]),
      money(row.Net),
      cleanText(row["Tax Details"]),
    ]);
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    data.push({
      id: randomUUID(),
      shopId,
      importBatchId: batchId,
      sourceKey: sha256(`${signature}:${occurrence}`),
      statementDate,
      type,
      title: cleanText(row.Title),
      info: cleanText(row.Info),
      currency: cleanText(row.Currency),
      amount: money(row.Amount),
      feesAndTaxes: money(row["Fees & Taxes"]),
      net: money(row.Net),
      taxDetails: cleanText(row["Tax Details"]),
      extractedOrderId: extractOrderId(row),
      rawPayload: jsonRow(row),
    });
  }

  const created = await prisma.etsyStatement.createMany({
    data,
    skipDuplicates: true,
  });
  return { inserted: created.count, invalid };
}

export async function createCogs(
  source: ParsedSource,
): Promise<{ inserted: number; invalid: number }> {
  let invalid = 0;
  let inserted = 0;

  for (const row of source.rows) {
    const orderId = cleanText(row.orderId);
    if (!orderId) {
      invalid += 1;
      continue;
    }
    const createDay = parseDate(row.createDay) || new Date();
    const vendor = cleanText(row.vendor) || "EQUARUS";
    const amount = money(row.orderAmount) || 0;
    const status =
      cleanText(row.paymentStatus) || cleanText(row.orderStatus) || "MATCHED";
    const itemKey = `flowa-cogs-${orderId}`;

    await prisma.cogsRecord.upsert({
      where: { itemKey },
      create: {
        supplier: vendor,
        date: createDay,
        referenceOrderId: orderId,
        totalCost: amount,
        estimatedCost: 0,
        itemKey,
        mappingStatus: status,
        rawPayload: jsonRow(row),
      },
      update: {
        supplier: vendor,
        date: createDay,
        totalCost: amount,
        mappingStatus: status,
        rawPayload: jsonRow(row),
        syncedAt: new Date(),
      },
    });
    inserted += 1;
  }

  return { inserted, invalid };
}

export async function createCogsClaim(
  source: ParsedSource,
): Promise<{ inserted: number; invalid: number }> {
  let invalid = 0;
  let inserted = 0;

  for (const row of source.rows) {
    const ticketId = cleanText(row.ticketId);
    const issuesOrderId = cleanText(row.issuesOrderId);
    if (!ticketId && !issuesOrderId) {
      invalid += 1;
      continue;
    }
    const date = parseDate(row.ticketDate) || new Date();
    const amount = money(row.partnerShare) ?? money(row.orderAmount) ?? 0;
    const itemKey = `flowa-claim-${ticketId || issuesOrderId}`;

    await prisma.cogsRecord.upsert({
      where: { itemKey },
      create: {
        supplier: "Claim / Reimburse",
        date,
        referenceOrderId: issuesOrderId,
        supplierOrderId: ticketId,
        totalCost: amount,
        estimatedCost: 0,
        itemKey,
        mappingStatus: cleanText(row.status) || "CLAIM",
        rawPayload: jsonRow(row),
      },
      update: {
        supplier: "Claim / Reimburse",
        date,
        referenceOrderId: issuesOrderId,
        supplierOrderId: ticketId,
        totalCost: amount,
        mappingStatus: cleanText(row.status) || "CLAIM",
        rawPayload: jsonRow(row),
        syncedAt: new Date(),
      },
    });
    inserted += 1;
  }

  return { inserted, invalid };
}

export async function importSource(
  source: ParsedSource,
  shopId: string,
): Promise<EtsyImportResult> {
  const existing = await prisma.etsyImportBatch.findFirst({
    where: { shopId, reportType: source.reportType, fileHash: source.fileHash },
  });
  if (existing?.status === "COMPLETED") {
    return {
      fileName: source.fileName,
      reportType: source.reportType,
      sourceMonth: monthLabel(source.sourceMonth),
      status: "SKIPPED",
      totalRows: source.rows.length,
      insertedRows: 0,
      skippedRows: source.rows.length,
      message: "File đã được nhập trước đó.",
    };
  }

  const batch = existing
    ? await prisma.etsyImportBatch.update({
        where: { id: existing.id },
        data: {
          status: "PROCESSING",
          totalRows: source.rows.length,
          insertedRows: 0,
          skippedRows: 0,
          failedRows: 0,
          errorDetails: undefined,
          completedAt: null,
          startedAt: new Date(),
        },
      })
    : await prisma.etsyImportBatch.create({
        data: {
          id: randomUUID(),
          shopId,
          reportType: source.reportType,
          sourceFileName: source.fileName,
          sourceMonth: source.sourceMonth,
          fileHash: source.fileHash,
          totalRows: source.rows.length,
        },
      });

  try {
    const counts =
      source.reportType === "ORDERS"
        ? await createOrders(source, shopId, batch.id)
        : source.reportType === "ORDER_ITEMS"
          ? await createOrderItems(source, shopId, batch.id)
          : source.reportType === "STATEMENTS"
            ? await createStatements(source, shopId, batch.id)
            : source.reportType === "COGS"
              ? await createCogs(source)
              : await createCogsClaim(source);
    const skippedRows = source.rows.length - counts.inserted;
    await prisma.etsyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "COMPLETED",
        insertedRows: counts.inserted,
        skippedRows,
        failedRows: counts.invalid,
        completedAt: new Date(),
      },
    });
    return {
      fileName: source.fileName,
      reportType: source.reportType,
      sourceMonth: monthLabel(source.sourceMonth),
      status: "COMPLETED",
      totalRows: source.rows.length,
      insertedRows: counts.inserted,
      skippedRows,
      message: counts.inserted > 0 ? "Đã nhập dữ liệu." : "Không có dòng mới.",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Không thể nhập file.";
    await prisma.etsyImportBatch.update({
      where: { id: batch.id },
      data: {
        status: "FAILED",
        failedRows: source.rows.length,
        errorDetails: { message },
        completedAt: new Date(),
      },
    });
    throw error;
  }
}
