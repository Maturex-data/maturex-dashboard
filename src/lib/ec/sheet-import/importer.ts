import crypto from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";
import { prisma } from "@/lib/prisma";
import {
  acquireSheetImportLock,
  releaseSheetImportLock,
  updateSheetImportHeartbeat,
  verifyLockOwnership,
} from "./lock";
import {
  parseAdRows,
  parseCogsRows,
  parseOrderRows,
  parsePayoutRows,
  validateSheetHeaders,
} from "./parser";
import {
  checkActiveEcDriveSync,
  fetchRawSheetsData,
  fetchSpreadsheetMetadata,
} from "./reader";
import {
  ImportAlreadyRunningError,
  ImportError,
  type ImportErrorCategory,
  type ImportTriggerType,
  type ImportValidationSummary,
  type SheetImportOptions,
  type SheetImportResult,
  type SheetName,
  type SpreadsheetMetadata,
} from "./types";

const CHUNK_SIZE = 250;

function computeChecksum(data: unknown): string {
  return crypto
    .createHash("sha256")
    .update(typeof data === "string" ? data : JSON.stringify(data))
    .digest("hex");
}

function generateRunId(): string {
  return `run_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

async function runRetentionCleanup(
  currentRunId: string,
  previousRunId?: string | null,
): Promise<void> {
  try {
    const keepRunIds = [currentRunId];
    if (previousRunId && previousRunId !== currentRunId) {
      keepRunIds.push(previousRunId);
    }

    // Clean up partial data from failed or incomplete runs older than 10 minutes
    const staleFailedRuns = await prisma.ecSheetImportRun.findMany({
      where: {
        id: { notIn: keepRunIds },
        status: { in: ["FAILED", "RUNNING"] },
        startedAt: { lt: new Date(Date.now() - 10 * 60 * 1000) },
      },
      select: { id: true },
      take: 20,
    });

    const staleIds = staleFailedRuns.map((r) => r.id);
    if (staleIds.length > 0) {
      await Promise.all([
        prisma.ecSheetOrder.deleteMany({
          where: { batchId: { in: staleIds } },
        }),
        prisma.ecSheetCogs.deleteMany({ where: { batchId: { in: staleIds } } }),
        prisma.ecSheetAd.deleteMany({ where: { batchId: { in: staleIds } } }),
        prisma.ecSheetPayout.deleteMany({
          where: { batchId: { in: staleIds } },
        }),
      ]);
    }

    // Clean up child rows of older completed runs beyond the 3 most recent
    const olderCompletedRuns = await prisma.ecSheetImportRun.findMany({
      where: {
        id: { notIn: keepRunIds },
        status: "COMPLETED",
      },
      orderBy: { completedAt: "desc" },
      skip: 2, // Keep 2 more historical completed runs + current + previous rollback
      select: { id: true },
      take: 10,
    });

    const olderIds = olderCompletedRuns.map((r) => r.id);
    if (olderIds.length > 0) {
      await Promise.all([
        prisma.ecSheetOrder.deleteMany({
          where: { batchId: { in: olderIds } },
        }),
        prisma.ecSheetCogs.deleteMany({ where: { batchId: { in: olderIds } } }),
        prisma.ecSheetAd.deleteMany({ where: { batchId: { in: olderIds } } }),
        prisma.ecSheetPayout.deleteMany({
          where: { batchId: { in: olderIds } },
        }),
      ]);
    }
  } catch (cleanErr) {
    console.warn("Retention cleanup error (non-fatal):", cleanErr);
  }
}

export async function executeSheetImport(
  options?: SheetImportOptions,
): Promise<SheetImportResult> {
  const startTime = Date.now();
  const triggerType: ImportTriggerType = options?.triggerType || "MANUAL";
  const actor =
    options?.actor || (triggerType === "CRON" ? "System Cron" : "Admin");
  const runId = generateRunId();
  const startedAt = new Date();

  // 1. Shared atomic DB-backed lock
  const lockResult = await acquireSheetImportLock(runId);
  if (!lockResult.acquired) {
    throw new ImportAlreadyRunningError(
      `Một tiến trình đồng bộ khác đang chạy (bắt đầu lúc ${lockResult.lockedAt?.toISOString() || "gần đây"}). Vui lòng đợi hoàn tất.`,
    );
  }

  let runCreated = false;

  try {
    // 2. Concurrency check against active upstream /ec-drive-sync
    await checkActiveEcDriveSync();

    // 3. Create initial import run record
    await prisma.ecSheetImportRun.create({
      data: {
        id: runId,
        spreadsheetId: options?.spreadsheetId || "default",
        status: "RUNNING",
        triggerType,
        actor,
        startedAt,
        heartbeatAt: startedAt,
      },
    });
    runCreated = true;

    // 3.5. Fast Metadata Probe (Zero-Payload check via Google Drive API)
    const targetSpreadsheetId = options?.spreadsheetId || REPORT_SPREADSHEET_ID;
    let driveMeta: SpreadsheetMetadata | null = null;

    if (!options?.forceRefresh) {
      try {
        driveMeta = await fetchSpreadsheetMetadata(targetSpreadsheetId);

        const activeSnapshot = await prisma.ecSheetActiveSnapshot.findUnique({
          where: { id: 1 },
          include: { activeRun: true },
        });

        const activeRun = activeSnapshot?.activeRun;
        const prevStats = activeRun?.sheetStats as Record<
          string,
          unknown
        > | null;
        const prevModifiedTime = prevStats?._driveModifiedTime as
          | string
          | undefined;

        if (
          activeRun &&
          activeRun.spreadsheetId === targetSpreadsheetId &&
          activeRun.status === "COMPLETED" &&
          prevModifiedTime &&
          driveMeta?.modifiedTime &&
          prevModifiedTime === driveMeta.modifiedTime
        ) {
          const completedAt = new Date();

          await Promise.all([
            prisma.ecSheetImportRun.update({
              where: { id: runId },
              data: {
                status: "COMPLETED",
                completedAt,
                spreadsheetId: targetSpreadsheetId,
                totalRows: activeRun.totalRows,
                insertedRows: 0,
                ordersCount: activeRun.ordersCount,
                cogsCount: activeRun.cogsCount,
                adsCount: activeRun.adsCount,
                payoutsCount: activeRun.payoutsCount,
                checksums: activeRun.checksums as Prisma.InputJsonValue,
                sheetStats: activeRun.sheetStats as Prisma.InputJsonValue,
              },
            }),
            prisma.ecSheetActiveSnapshot.update({
              where: { id: 1 },
              data: { lastCheckedAt: completedAt },
            }),
          ]);

          const elapsedMs = Date.now() - startTime;
          return {
            runId,
            spreadsheetId: targetSpreadsheetId,
            status: "NO_CHANGE",
            triggerType,
            startedAt,
            completedAt,
            totalRows: activeRun.totalRows,
            insertedRows: 0,
            ordersCount: activeRun.ordersCount,
            cogsCount: activeRun.cogsCount,
            adsCount: activeRun.adsCount,
            payoutsCount: activeRun.payoutsCount,
            summaries:
              (activeRun.sheetStats as unknown as Record<
                SheetName,
                ImportValidationSummary
              >) || {},
            elapsedMs,
            isNoChange: true,
            driveModifiedTime: driveMeta.modifiedTime,
            fastChecked: true,
            message: `Không có thay đổi trên Google Sheet (lần sửa gần nhất: ${new Date(driveMeta.modifiedTime).toLocaleString("vi-VN")}) - Fast Check hoàn tất trong ${elapsedMs}ms!`,
          };
        }
      } catch (probeErr) {
        console.warn(
          "[EC Sheet Import] Drive metadata probe error (gracefully falling back to full fetch):",
          probeErr,
        );
      }
    }

    // 4. Fetch raw sheet ranges from Google Sheets API
    const rawData = await fetchRawSheetsData(options?.spreadsheetId);

    // Update spreadsheetId and heartbeat
    await prisma.ecSheetImportRun.update({
      where: { id: runId },
      data: { spreadsheetId: rawData.spreadsheetId, heartbeatAt: new Date() },
    });
    await updateSheetImportHeartbeat(runId);

    // 5. Validate headers for all 4 sheets
    validateSheetHeaders("Orders", rawData.sheets.Orders.headers);
    validateSheetHeaders("COGS", rawData.sheets.COGS.headers);
    validateSheetHeaders("Ads", rawData.sheets.Ads.headers);
    validateSheetHeaders("Payouts", rawData.sheets.Payouts.headers);

    // 6. Parse rows strictly
    const orders = parseOrderRows(rawData.sheets.Orders.rows);
    const cogs = parseCogsRows(rawData.sheets.COGS.rows);
    const ads = parseAdRows(rawData.sheets.Ads.rows);
    const payouts = parsePayoutRows(rawData.sheets.Payouts.rows);

    const totalRows = orders.length + cogs.length + ads.length + payouts.length;

    // 7. Compute robust content fingerprints (hashing all normalized data values)
    const orderChecksum = computeChecksum(
      orders
        .map(
          (r) =>
            `${r.orderName}|${r.orderDate.toISOString().slice(0, 10)}|${r.grossSales.toFixed(4)}|${r.discounts.toFixed(4)}|${r.shippingCharged.toFixed(4)}|${r.originalTax.toFixed(4)}|${r.correctedNet.toFixed(4)}|${r.refundSnapshot.toFixed(4)}|${r.beforeRefund.toFixed(4)}|${r.source ?? ""}|${r.itemName ?? ""}`,
        )
        .join("\n"),
    );

    const cogsChecksum = computeChecksum(
      cogs
        .map(
          (r) =>
            `${r.rowKey}|${r.supplier}|${r.costDate.toISOString().slice(0, 10)}|${r.referenceOrderId ?? ""}|${r.itemsName ?? ""}|${r.supplierOrderId ?? ""}|${r.totalCost.toFixed(4)}|${r.estimatedCost.toFixed(4)}|${r.treatment}|${r.source ?? ""}`,
        )
        .join("\n"),
    );

    const adsChecksum = computeChecksum(
      ads
        .map(
          (r) =>
            `${r.externalId}|${r.date.toISOString().slice(0, 10)}|${r.accountId}|${r.campaignId ?? ""}|${r.campaignName ?? ""}|${r.currency}|${r.spend.toFixed(4)}|${r.granularity}|${r.source ?? ""}`,
        )
        .join("\n"),
    );

    const payoutsChecksum = computeChecksum(
      payouts
        .map(
          (r) =>
            `${r.balanceTransactionId}|${r.payoutId ?? ""}|${r.type}|${r.currency}|${r.gross.toFixed(4)}|${r.fee.toFixed(4)}|${r.net.toFixed(4)}|${r.processedUtc.toISOString()}|${r.processedVietnam}|${r.reason ?? ""}|${r.sourceId ?? ""}|${r.orderId ?? ""}|${r.source ?? ""}`,
        )
        .join("\n"),
    );

    // 8. Build validation summaries
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
        checksum: orderChecksum,
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
        checksum: cogsChecksum,
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
        checksum: adsChecksum,
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
        checksum: payoutsChecksum,
      },
    };

    // 9. Compare with active snapshot for "NO CHANGE" shortcut
    const activeSnapshot = await prisma.ecSheetActiveSnapshot.findUnique({
      where: { id: 1 },
      include: { activeRun: true },
    });

    const prevChecksums = activeSnapshot?.activeRun?.checksums as Record<
      string,
      string
    > | null;

    const sameSpreadsheet =
      activeSnapshot?.activeRun?.spreadsheetId === rawData.spreadsheetId;

    const isUnchanged =
      sameSpreadsheet &&
      Boolean(prevChecksums) &&
      prevChecksums?.Orders === orderChecksum &&
      prevChecksums?.COGS === cogsChecksum &&
      prevChecksums?.Ads === adsChecksum &&
      prevChecksums?.Payouts === payoutsChecksum;

    const enrichedSummaries = {
      ...summaries,
      _driveModifiedTime: driveMeta?.modifiedTime ?? null,
      _driveVersion: driveMeta?.version ?? null,
    };

    if (isUnchanged) {
      const completedAt = new Date();
      await Promise.all([
        prisma.ecSheetImportRun.update({
          where: { id: runId },
          data: {
            status: "COMPLETED",
            completedAt,
            totalRows,
            insertedRows: 0,
            ordersCount: orders.length,
            cogsCount: cogs.length,
            adsCount: ads.length,
            payoutsCount: payouts.length,
            checksums: {
              Orders: orderChecksum,
              COGS: cogsChecksum,
              Ads: adsChecksum,
              Payouts: payoutsChecksum,
            },
            sheetStats: enrichedSummaries as unknown as Prisma.InputJsonValue,
          },
        }),
        // Update lastCheckedAt on the active snapshot so UI/API knows the sheet was verified recently
        prisma.ecSheetActiveSnapshot.update({
          where: { id: 1 },
          data: { lastCheckedAt: completedAt },
        }),
      ]);

      return {
        runId,
        spreadsheetId: rawData.spreadsheetId,
        status: "NO_CHANGE",
        triggerType,
        startedAt,
        completedAt,
        totalRows,
        insertedRows: 0,
        ordersCount: orders.length,
        cogsCount: cogs.length,
        adsCount: ads.length,
        payoutsCount: payouts.length,
        summaries,
        elapsedMs: Date.now() - startTime,
        message:
          "Dữ liệu Google Sheet không thay đổi so với bản snapshot đang hoạt động.",
        isNoChange: true,
        driveModifiedTime: driveMeta?.modifiedTime,
        fastChecked: false,
      };
    }

    // 10. Insert data in bounded chunks with heartbeat update after every batch
    let insertedRows = 0;

    // Insert Orders
    for (let i = 0; i < orders.length; i += CHUNK_SIZE) {
      const chunk = orders.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetOrder.createMany({
        data: chunk.map((r) => ({
          batchId: runId,
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
      await updateSheetImportHeartbeat(runId);
    }

    // Insert COGS
    for (let i = 0; i < cogs.length; i += CHUNK_SIZE) {
      const chunk = cogs.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetCogs.createMany({
        data: chunk.map((r) => ({
          batchId: runId,
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
      await updateSheetImportHeartbeat(runId);
    }

    // Insert Ads
    for (let i = 0; i < ads.length; i += CHUNK_SIZE) {
      const chunk = ads.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetAd.createMany({
        data: chunk.map((r) => ({
          batchId: runId,
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
      await updateSheetImportHeartbeat(runId);
    }

    // Insert Payouts
    for (let i = 0; i < payouts.length; i += CHUNK_SIZE) {
      const chunk = payouts.slice(i, i + CHUNK_SIZE);
      const res = await prisma.ecSheetPayout.createMany({
        data: chunk.map((r) => ({
          batchId: runId,
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
      await updateSheetImportHeartbeat(runId);
    }

    // 11. Re-check concurrency before atomic publishing
    await checkActiveEcDriveSync();

    // 12. Atomic publish snapshot switch in transaction with ownership check
    const completedAt = new Date();
    await prisma.$transaction(async (tx) => {
      // Assert lock ownership
      await verifyLockOwnership(runId, tx);

      // Re-verify upstream sync inside transaction
      const activeSync = await tx.ecDriveSyncRun.findFirst({
        where: { status: { in: ["RUNNING", "QUEUED"] } },
        select: { id: true, source: true },
      });
      if (activeSync) {
        throw new Error(
          `Một tác vụ EC Drive Sync (${activeSync.source}) vừa được kích hoạt. Hủy publish snapshot để đảm bảo toàn vẹn.`,
        );
      }

      await tx.ecSheetActiveSnapshot.upsert({
        where: { id: 1 },
        create: { id: 1, activeRunId: runId, lastCheckedAt: completedAt },
        update: { activeRunId: runId, lastCheckedAt: completedAt },
      });

      await tx.ecSheetImportRun.update({
        where: { id: runId },
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
            Orders: orderChecksum,
            COGS: cogsChecksum,
            Ads: adsChecksum,
            Payouts: payoutsChecksum,
          },
          sheetStats: enrichedSummaries as unknown as Prisma.InputJsonValue,
        },
      });
    });

    // 13. Bounded retention cleanup: keep current and previous active runs, purge older
    await runRetentionCleanup(runId, activeSnapshot?.activeRunId);

    return {
      runId,
      spreadsheetId: rawData.spreadsheetId,
      status: "COMPLETED",
      triggerType,
      startedAt,
      completedAt,
      totalRows,
      insertedRows,
      ordersCount: orders.length,
      cogsCount: cogs.length,
      adsCount: ads.length,
      payoutsCount: payouts.length,
      summaries,
      elapsedMs: Date.now() - startTime,
      driveModifiedTime: driveMeta?.modifiedTime,
      fastChecked: false,
      message: `Đồng bộ thành công ${insertedRows.toLocaleString()} dòng từ Google Sheet!`,
    };
  } catch (error) {
    const errorCategory: ImportErrorCategory =
      error instanceof ImportError ? error.category : "SYSTEM_ERROR";

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Đồng bộ từ Google Sheet thất bại.";

    if (runCreated) {
      await prisma.ecSheetImportRun
        .update({
          where: { id: runId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorCategory,
            errorMessage,
            errorDetails: {
              error: String(error),
              category: errorCategory,
              stack: error instanceof Error ? error.stack : undefined,
            },
          },
        })
        .catch(() => undefined);
    }

    throw error;
  } finally {
    // Release the DB-backed lock
    await releaseSheetImportLock(runId);
  }
}
