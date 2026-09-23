import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseAdRows,
  parseCogsRows,
  parseOrderRows,
  parsePayoutRows,
  validateSheetHeaders,
} from "./parser";
import { checkActiveEcDriveSync, fetchRawSheetsData } from "./reader";
import type {
  ImportValidationSummary,
  SheetImportResult,
  SheetName,
} from "./types";

const CHUNK_SIZE = 250;

function computeChecksum(data: unknown): string {
  return crypto
    .createHash("sha256")
    .update(typeof data === "string" ? data : JSON.stringify(data))
    .digest("hex");
}

export async function executeSheetImport(options?: {
  actor?: string;
  spreadsheetId?: string;
}): Promise<SheetImportResult> {
  // 1. Concurrency check
  await checkActiveEcDriveSync();

  const startedAt = new Date();
  const run = await prisma.ecSheetImportRun.create({
    data: {
      spreadsheetId: options?.spreadsheetId || "default",
      status: "RUNNING",
      actor: options?.actor || "Admin",
      startedAt,
      heartbeatAt: startedAt,
    },
  });

  try {
    // 2. Fetch raw sheet ranges from Google Sheets API
    const rawData = await fetchRawSheetsData(options?.spreadsheetId);

    // Update spreadsheetId if default
    await prisma.ecSheetImportRun.update({
      where: { id: run.id },
      data: { spreadsheetId: rawData.spreadsheetId, heartbeatAt: new Date() },
    });

    // 3. Validate headers for all 4 sheets
    validateSheetHeaders("Orders", rawData.sheets.Orders.headers);
    validateSheetHeaders("COGS", rawData.sheets.COGS.headers);
    validateSheetHeaders("Ads", rawData.sheets.Ads.headers);
    validateSheetHeaders("Payouts", rawData.sheets.Payouts.headers);

    // 4. Parse rows strictly
    const orders = parseOrderRows(rawData.sheets.Orders.rows);
    const cogs = parseCogsRows(rawData.sheets.COGS.rows);
    const ads = parseAdRows(rawData.sheets.Ads.rows);
    const payouts = parsePayoutRows(rawData.sheets.Payouts.rows);

    const totalRows = orders.length + cogs.length + ads.length + payouts.length;

    // 5. Build validation summaries
    const summaries: Record<SheetName, ImportValidationSummary> = {
      Orders: {
        sheet: "Orders",
        totalRows: orders.length,
        distinctKeys: new Set(orders.map((r) => r.orderName)).size,
        monthCounts: orders.reduce<Record<string, number>>((acc, r) => {
          acc[r.month] = (acc[r.month] || 0) + 1;
          return acc;
        }, {}),
        sums: {
          grossSales: orders
            .reduce((sum, r) => sum.plus(r.grossSales), new Prisma.Decimal(0))
            .toFixed(2),
          correctedNet: orders
            .reduce((sum, r) => sum.plus(r.correctedNet), new Prisma.Decimal(0))
            .toFixed(2),
          originalTax: orders
            .reduce((sum, r) => sum.plus(r.originalTax), new Prisma.Decimal(0))
            .toFixed(2),
        },
        checksum: computeChecksum(orders.map((r) => r.orderName)),
      },
      COGS: {
        sheet: "COGS",
        totalRows: cogs.length,
        distinctKeys: new Set(cogs.map((r) => r.rowKey)).size,
        monthCounts: cogs.reduce<Record<string, number>>((acc, r) => {
          acc[r.month] = (acc[r.month] || 0) + 1;
          return acc;
        }, {}),
        sums: {
          totalCost: cogs
            .reduce((sum, r) => sum.plus(r.totalCost), new Prisma.Decimal(0))
            .toFixed(2),
          estimatedCost: cogs
            .reduce(
              (sum, r) => sum.plus(r.estimatedCost),
              new Prisma.Decimal(0),
            )
            .toFixed(2),
        },
        checksum: computeChecksum(cogs.map((r) => r.rowKey)),
      },
      Ads: {
        sheet: "Ads",
        totalRows: ads.length,
        distinctKeys: new Set(ads.map((r) => r.externalId)).size,
        monthCounts: ads.reduce<Record<string, number>>((acc, r) => {
          acc[r.month] = (acc[r.month] || 0) + 1;
          return acc;
        }, {}),
        sums: {
          spend: ads
            .reduce((sum, r) => sum.plus(r.spend), new Prisma.Decimal(0))
            .toFixed(2),
        },
        checksum: computeChecksum(ads.map((r) => r.externalId)),
      },
      Payouts: {
        sheet: "Payouts",
        totalRows: payouts.length,
        distinctKeys: new Set(payouts.map((r) => r.balanceTransactionId)).size,
        monthCounts: payouts.reduce<Record<string, number>>((acc, r) => {
          acc[r.monthLocal] = (acc[r.monthLocal] || 0) + 1;
          return acc;
        }, {}),
        sums: {
          gross: payouts
            .reduce((sum, r) => sum.plus(r.gross), new Prisma.Decimal(0))
            .toFixed(2),
          fee: payouts
            .reduce((sum, r) => sum.plus(r.fee), new Prisma.Decimal(0))
            .toFixed(2),
          net: payouts
            .reduce((sum, r) => sum.plus(r.net), new Prisma.Decimal(0))
            .toFixed(2),
        },
        checksum: computeChecksum(payouts.map((r) => r.balanceTransactionId)),
      },
    };

    // 6. Insert data in bounded chunks
    let insertedRows = 0;

    // Insert Orders
    for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
      const chunk = orders.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetOrder.createMany({
        data: chunk.map((r) => ({
          batchId: run.id,
          shop: "EC",
          month: r.month,
          sourceRow: r.sourceRow,
          orderName: r.orderName,
          orderDate: r.orderDate,
          grossSales: r.grossSales,
          discounts: r.discounts,
          shippingCharged: r.shippingCharged,
          originalTax: r.originalTax,
          correctedNet: r.correctedNet,
          refundSnapshot: r.refundSnapshot,
          beforeRefund: r.beforeRefund,
          source: r.source,
          itemName: r.itemName,
          rawValues: r.rawValues,
        })),
      });
      insertedRows += res.count;
    }

    // Insert COGS
    for (let i = 0; i < cogs.length; i += CHUNK_SIZE) {
      const chunk = cogs.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetCogs.createMany({
        data: chunk.map((r) => ({
          batchId: run.id,
          shop: "EC",
          month: r.month,
          sourceRow: r.sourceRow,
          supplier: r.supplier,
          costDate: r.costDate,
          referenceOrderId: r.referenceOrderId,
          itemsName: r.itemsName,
          supplierOrderId: r.supplierOrderId,
          totalCost: r.totalCost,
          estimatedCost: r.estimatedCost,
          rowKey: r.rowKey,
          treatment: r.treatment,
          source: r.source,
          rawValues: r.rawValues,
        })),
      });
      insertedRows += res.count;
    }

    // Insert Ads
    for (let i = 0; i < ads.length; i += CHUNK_SIZE) {
      const chunk = ads.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetAd.createMany({
        data: chunk.map((r) => ({
          batchId: run.id,
          shop: "EC",
          month: r.month,
          sourceRow: r.sourceRow,
          externalId: r.externalId,
          date: r.date,
          accountId: r.accountId,
          campaignId: r.campaignId,
          campaignName: r.campaignName,
          currency: r.currency,
          spend: r.spend,
          granularity: r.granularity,
          source: r.source,
          rawValues: r.rawValues,
        })),
      });
      insertedRows += res.count;
    }

    // Insert Payouts
    for (let i = 0; i < payouts.length; i += CHUNK_SIZE) {
      const chunk = payouts.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetPayout.createMany({
        data: chunk.map((r) => ({
          batchId: run.id,
          shop: "EC",
          monthLocal: r.monthLocal,
          sourceRow: r.sourceRow,
          balanceTransactionId: r.balanceTransactionId,
          payoutId: r.payoutId,
          type: r.type,
          currency: r.currency,
          gross: r.gross,
          fee: r.fee,
          net: r.net,
          processedUtc: r.processedUtc,
          processedGmt7: r.processedGmt7,
          processedVietnam: r.processedVietnam,
          reason: r.reason,
          sourceId: r.sourceId,
          orderId: r.orderId,
          source: r.source,
          rawValues: r.rawValues,
        })),
      });
      insertedRows += res.count;
    }

    // 7. Re-check concurrency before atomic publishing
    await checkActiveEcDriveSync();

    // 8. Atomic publish snapshot switch
    const completedAt = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.ecSheetActiveSnapshot.upsert({
        where: { id: 1 },
        create: { id: 1, activeRunId: run.id },
        update: { activeRunId: run.id },
      });

      await tx.ecSheetImportRun.update({
        where: { id: run.id },
        data: {
          status: "COMPLETED",
          completedAt,
          totalRows,
          insertedRows,
          ordersCount: orders.length,
          cogsCount: cogs.length,
          adsCount: ads.length,
          payoutsCount: payouts.length,
          checksums: {
            Orders: summaries.Orders.checksum,
            COGS: summaries.COGS.checksum,
            Ads: summaries.Ads.checksum,
            Payouts: summaries.Payouts.checksum,
          },
          sheetStats: summaries as unknown as Prisma.InputJsonValue,
        },
      });
    });

    return {
      runId: run.id,
      spreadsheetId: rawData.spreadsheetId,
      status: "COMPLETED",
      startedAt,
      completedAt,
      totalRows,
      insertedRows,
      ordersCount: orders.length,
      cogsCount: cogs.length,
      adsCount: ads.length,
      payoutsCount: payouts.length,
      summaries,
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Đồng bộ từ Google Sheet thất bại.";

    await prisma.ecSheetImportRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage,
        errorDetails: {
          error: String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
      },
    });

    throw error;
  }
}
