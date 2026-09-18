import { createHash, randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export const ETSY_SHOPS = [
  { code: "97DECOR", name: "97Decor" },
  { code: "ARTISANHAND", name: "Artisanhand" },
  { code: "EVERNEST", name: "Evernest" },
  { code: "POCDY", name: "Pocdy" },
  { code: "TIMOND", name: "Timond" },
] as const;

const MAX_FILE_BYTES = 20 * 1024 * 1024;
const MAX_FILES = 12;

type SourceRow = Record<string, unknown>;
type ReportType = "ORDERS" | "ORDER_ITEMS" | "STATEMENTS";

interface ParsedSource {
  fileHash: string;
  fileName: string;
  reportType: ReportType;
  rows: SourceRow[];
  sourceMonth: Date;
}

export interface EtsyImportResult {
  fileName: string;
  reportType: ReportType | "UNKNOWN";
  sourceMonth: string | null;
  status: "COMPLETED" | "SKIPPED" | "FAILED";
  totalRows: number;
  insertedRows: number;
  skippedRows: number;
  message: string;
}

function cleanText(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" || normalized === "--" ? null : normalized;
}

function integer(value: unknown): number | null {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized.replaceAll(",", ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value: unknown): number | null {
  const normalized = cleanText(value);
  if (!normalized) return null;
  const parenthesized = normalized.startsWith("(") && normalized.endsWith(")");
  const numeric = normalized.replaceAll(",", "").replace(/[^0-9.-]/g, "");
  if (!numeric || numeric === "-" || numeric === ".") return null;
  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  return parenthesized ? -Math.abs(parsed) : parsed;
}

function parseDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate()),
    );
  }
  const normalized = cleanText(value);
  if (!normalized) return null;

  const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    return new Date(
      Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])),
    );
  }

  const us = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!us) return null;
  const year = us[3].length === 2 ? Number(us[3]) + 2000 : Number(us[3]);
  return new Date(Date.UTC(year, Number(us[1]) - 1, Number(us[2])));
}

function monthStart(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), 1));
}

function monthLabel(value: Date): string {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}`;
}

function sha256(value: string | ArrayBuffer): string {
  return createHash("sha256")
    .update(typeof value === "string" ? value : Buffer.from(value))
    .digest("hex");
}

function jsonRow(row: SourceRow): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(row)) as Prisma.InputJsonValue;
}

function detectReport(headers: string[]): ReportType {
  const values = new Set(headers);
  if (
    values.has("Transaction ID") &&
    values.has("Item Name") &&
    values.has("Order ID")
  ) {
    return "ORDER_ITEMS";
  }
  if (values.has("Sale Date") && values.has("Order ID")) return "ORDERS";
  if (values.has("Date") && values.has("Type") && values.has("Net"))
    return "STATEMENTS";
  throw new Error("Cấu trúc cột không khớp báo cáo Etsy được hỗ trợ.");
}

async function parseFile(file: File): Promise<ParsedSource> {
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    throw new Error("Chỉ hỗ trợ file CSV hoặc XLSX.");
  }
  if (file.size > MAX_FILE_BYTES)
    throw new Error("File vượt quá giới hạn 20 MB.");

  const contents = await file.arrayBuffer();
  const workbook = XLSX.read(contents, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error("File không có worksheet.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const headers = (matrix[0] ?? []).map((header) => String(header).trim());
  const reportType = detectReport(headers);
  const rows = XLSX.utils
    .sheet_to_json<SourceRow>(worksheet, { defval: null, raw: false })
    .filter((row) =>
      Object.values(row).some((value) => cleanText(value) !== null),
    );
  const dateColumn = reportType === "STATEMENTS" ? "Date" : "Sale Date";
  const firstDate = rows.map((row) => parseDate(row[dateColumn])).find(Boolean);
  if (!firstDate) throw new Error("Không xác định được tháng dữ liệu.");

  return {
    fileHash: sha256(contents),
    fileName: file.name,
    reportType,
    rows,
    sourceMonth: monthStart(firstDate),
  };
}

async function createOrders(
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

async function createOrderItems(
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

function extractOrderId(row: SourceRow): string | null {
  const searchable = `${cleanText(row.Info) ?? ""} ${cleanText(row.Title) ?? ""}`;
  return searchable.match(/Order\s*#?\s*(\d+)/i)?.[1] ?? null;
}

async function createStatements(
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

async function importSource(
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
          : await createStatements(source, shopId, batch.id);
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

async function reconcileOrderItems(): Promise<void> {
  await prisma.$executeRaw`
    UPDATE etsy_order_items AS item
    SET etsy_order_id = orders.id, match_status = 'MATCHED', updated_at = NOW()
    FROM etsy_orders AS orders
    WHERE item.shop_id = orders.shop_id
      AND item.order_id = orders.order_id
      AND (item.etsy_order_id IS NULL OR item.match_status <> 'MATCHED')
  `;
}

export async function importEtsyFiles(shopCode: string, files: File[]) {
  if (files.length === 0) throw new Error("Chưa chọn file để import.");
  if (files.length > MAX_FILES)
    throw new Error(`Mỗi lần chỉ import tối đa ${MAX_FILES} file.`);

  const shop = await prisma.etsyShop.findUnique({ where: { code: shopCode } });
  if (!shop) throw new Error("Shop Etsy không hợp lệ.");

  const results: EtsyImportResult[] = [];
  for (const file of files) {
    try {
      const source = await parseFile(file);
      results.push(await importSource(source, shop.id));
    } catch (error) {
      results.push({
        fileName: file.name,
        reportType: "UNKNOWN",
        sourceMonth: null,
        status: "FAILED",
        totalRows: 0,
        insertedRows: 0,
        skippedRows: 0,
        message:
          error instanceof Error ? error.message : "Không thể nhập file.",
      });
    }
  }
  await reconcileOrderItems();

  return {
    results,
    summary: {
      files: results.length,
      completed: results.filter((result) => result.status === "COMPLETED")
        .length,
      skipped: results.filter((result) => result.status === "SKIPPED").length,
      failed: results.filter((result) => result.status === "FAILED").length,
      insertedRows: results.reduce(
        (sum, result) => sum + result.insertedRows,
        0,
      ),
    },
  };
}
