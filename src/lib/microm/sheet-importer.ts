import { prisma } from "@/lib/prisma";
import { MICROM_SPREADSHEET_ID, MICROM_TABS } from "./constants";
import { acquireMicromLock } from "./lock-manager";
import {
  parseMicromAds,
  parseMicromCogs,
  parseMicromOrders,
  parseMicromShopifyItems,
} from "./sheet-parser";
import { readMicromSheetData } from "./sheet-reader";
import { MicromReconciliationError, type TabFingerprints } from "./types";

export interface SheetImportOptions {
  triggerType?: "MANUAL" | "SCHEDULED";
  actor?: string;
  allowUnreconciledEdit?: boolean;
  acknowledgementReason?: string;
}

export interface SheetImportResult {
  runId: string;
  status: "SUCCESS" | "NO_CHANGE" | "FAILED";
  totalRows: number;
  ordersCount: number;
  cogsCount: number;
  adsCount: number;
  itemsCount: number;
  providerReconciled: boolean;
  manualEditAcknowledged: boolean;
  fingerprints: TabFingerprints;
  activeRunId: string;
  message: string;
}

export async function runMicromSheetToDbImport(
  options: SheetImportOptions = {},
): Promise<SheetImportResult> {
  const triggerType = options.triggerType || "MANUAL";
  const actor = options.actor || "system";
  const spreadsheetId = MICROM_SPREADSHEET_ID;

  // 1. Acquire atomic concurrency lock with heartbeat
  const lockHandle = await acquireMicromLock(`sheet_import_${triggerType}`);

  let runId = "";
  try {
    // 2. Read Sheet and compute fingerprints
    const { data: sheetData, fingerprints: currentFingerprints } =
      await readMicromSheetData(spreadsheetId);

    // 3. Gating against latest Provider-to-Sheet Reconciliation
    const latestSyncRun = await prisma.micromSourceSyncRun.findFirst({
      orderBy: { startedAt: "desc" },
    });

    let isProviderReconciled = false;
    let isManualEditAcknowledged = false;

    if (latestSyncRun?.isReconciled && latestSyncRun.status === "SUCCESS") {
      const syncFps =
        (latestSyncRun.perTabFingerprints as TabFingerprints) || {};
      const orderMatch = syncFps.Orders === currentFingerprints.Orders;
      const cogsMatch = syncFps.COGS === currentFingerprints.COGS;
      const adsMatch = syncFps.Ads === currentFingerprints.Ads;
      const itemsMatch =
        syncFps.Shopify_Items === currentFingerprints.Shopify_Items;

      if (orderMatch && cogsMatch && adsMatch && itemsMatch) {
        isProviderReconciled = true;
      } else {
        // Human edited sheet after provider sync
        if (!options.allowUnreconciledEdit) {
          const changedTabs: string[] = [];
          if (!orderMatch) changedTabs.push("Orders");
          if (!cogsMatch) changedTabs.push("COGS");
          if (!adsMatch) changedTabs.push("Ads");
          if (!itemsMatch) changedTabs.push("Shopify_Items");

          throw new MicromReconciliationError(
            `Google Sheet đã bị chỉnh sửa thủ công sau lần đồng bộ provider gần nhất (các tab thay đổi: ${changedTabs.join(
              ", ",
            )}). Yêu cầu quản trị viên xác nhận ghi đè có kiểm soát (allowUnreconciledEdit) trước khi kích hoạt snapshot.`,
          );
        }
        isManualEditAcknowledged = true;
      }
    } else {
      // No reconciled sync run yet
      if (!options.allowUnreconciledEdit) {
        throw new MicromReconciliationError(
          "Chưa có bản ghi đồng bộ Provider-to-Sheet nào hoàn tất và đối soát thành công. Vui lòng chạy Provider-to-Sheet trước hoặc xác nhận ghi đè có kiểm soát.",
        );
      }
      isManualEditAcknowledged = true;
    }

    // 4. Check No-Change Shortcut against active snapshot
    const activeSnapshot = await prisma.micromSheetActiveSnapshot.findUnique({
      where: { id: 1 },
      include: { activeRun: true },
    });

    if (activeSnapshot?.activeRun?.checksums) {
      const activeFps =
        (
          activeSnapshot.activeRun.checksums as {
            fingerprints?: TabFingerprints;
          }
        )?.fingerprints || {};

      const isIdentical =
        activeFps.Orders === currentFingerprints.Orders &&
        activeFps.COGS === currentFingerprints.COGS &&
        activeFps.Ads === currentFingerprints.Ads &&
        activeFps.Shopify_Items === currentFingerprints.Shopify_Items;

      if (isIdentical) {
        // Update lastCheckedAt without modifying data or updatedAt
        await prisma.micromSheetActiveSnapshot.update({
          where: { id: 1 },
          data: { lastCheckedAt: new Date() },
        });

        return {
          runId: activeSnapshot.activeRun.id,
          status: "NO_CHANGE",
          totalRows: activeSnapshot.activeRun.totalRows,
          ordersCount: activeSnapshot.activeRun.ordersCount,
          cogsCount: activeSnapshot.activeRun.cogsCount,
          adsCount: activeSnapshot.activeRun.adsCount,
          itemsCount: activeSnapshot.activeRun.itemsCount,
          providerReconciled: activeSnapshot.activeRun.providerReconciled,
          manualEditAcknowledged:
            activeSnapshot.activeRun.manualEditAcknowledged,
          fingerprints: currentFingerprints,
          activeRunId: activeSnapshot.activeRun.id,
          message:
            "Dữ liệu Google Sheet không thay đổi. Đã cập nhật mốc kiểm tra thành công.",
        };
      }
    }

    // 5. Parse all 4 tabs
    const parsedOrders = parseMicromOrders(sheetData[MICROM_TABS.ORDERS].rows);
    const parsedCogs = parseMicromCogs(sheetData[MICROM_TABS.COGS].rows);
    const parsedAds = parseMicromAds(sheetData[MICROM_TABS.ADS].rows);
    const parsedItems = parseMicromShopifyItems(
      sheetData[MICROM_TABS.SHOPIFY_ITEMS].rows,
    );

    const totalRows =
      parsedOrders.length +
      parsedCogs.length +
      parsedAds.length +
      parsedItems.length;

    // 6. Create Import Run
    const run = await prisma.micromSheetImportRun.create({
      data: {
        spreadsheetId,
        status: "RUNNING",
        triggerType,
        actor,
        startedAt: new Date(),
        heartbeatAt: new Date(),
        totalRows,
        ordersCount: parsedOrders.length,
        cogsCount: parsedCogs.length,
        adsCount: parsedAds.length,
        itemsCount: parsedItems.length,
        sourceSyncRunId: latestSyncRun?.id || null,
        providerReconciled: isProviderReconciled,
        manualEditAcknowledged: isManualEditAcknowledged,
        acknowledgementReason: options.acknowledgementReason || null,
        checksums: {
          fingerprints: currentFingerprints,
          ordersTotalEur: parsedOrders.reduce(
            (s, o) => s + o.eligibleRevenueEur,
            0,
          ),
          cogsTotalUsd: parsedCogs.reduce((s, c) => s + c.eligibleCogsUsd, 0),
          adsTotalUsd: parsedAds.reduce((s, a) => s + a.spendUsd, 0),
        },
      },
    });
    runId = run.id;

    // 7. Insert projection rows in batch
    await prisma.$transaction(
      async (tx) => {
        // Orders
        if (parsedOrders.length > 0) {
          await tx.micromSheetOrder.createMany({
            data: parsedOrders.map((o) => ({
              batchId: run.id,
              sourceRow: o.sourceRow,
              orderId: o.orderId,
              shopifyId: o.shopifyId,
              orderDate: o.orderDate,
              period: o.period,
              financialStatus: o.financialStatus,
              fulfillmentStatus: o.fulfillmentStatus,
              currency: o.currency,
              subtotal: o.subtotal,
              discount: o.discount,
              shipping: o.shipping,
              tax: o.tax,
              grossOrder: o.grossOrder,
              eligibleRevenueEur: o.eligibleRevenueEur,
              fxRate: o.fxRate,
              eligibleRevenueUsdCalc: o.eligibleRevenueUsdCalc,
              grossOrderUsdCalc: o.grossOrderUsdCalc,
              sourceLine: o.sourceLine,
              rawValues: o.rawValues as object,
            })),
          });
        }

        // COGS
        if (parsedCogs.length > 0) {
          await tx.micromSheetCogs.createMany({
            data: parsedCogs.map((c) => ({
              batchId: run.id,
              sourceRow: c.sourceRow,
              pgprintOrderId: c.pgprintOrderId,
              pgcOrderId: c.pgcOrderId,
              customerOrderId: c.customerOrderId,
              costDate: c.costDate,
              period: c.period,
              sourceStatus: c.sourceStatus,
              currency: c.currency,
              production: c.production,
              shipping: c.shipping,
              cogsSourceUsd: c.cogsSourceUsd,
              eligibleCogsUsd: c.eligibleCogsUsd,
              sourceLine: c.sourceLine,
              controlNote: c.controlNote,
              rowKey: c.rowKey,
              rawValues: c.rawValues as object,
            })),
          });
        }

        // Ads
        if (parsedAds.length > 0) {
          await tx.micromSheetAd.createMany({
            data: parsedAds.map((a) => ({
              batchId: run.id,
              sourceRow: a.sourceRow,
              accountName: a.accountName,
              accountId: a.accountId,
              date: a.date,
              period: a.period,
              currency: a.currency,
              spendUsd: a.spendUsd,
              impressions: a.impressions,
              clicks: a.clicks,
              purchases: a.purchases,
              sourceLine: a.sourceLine,
              controlNote: a.controlNote,
              rowKey: a.rowKey,
              rawValues: a.rawValues as object,
            })),
          });
        }

        // Shopify Items (enriched with period & orderDate from Orders)
        const orderMap = new Map<string, { period: string; orderDate: Date }>();
        for (const o of parsedOrders) {
          orderMap.set(o.orderId, { period: o.period, orderDate: o.orderDate });
          orderMap.set(o.shopifyId, {
            period: o.period,
            orderDate: o.orderDate,
          });
        }

        if (parsedItems.length > 0) {
          await tx.micromSheetShopifyItem.createMany({
            data: parsedItems.map((it) => {
              const matched = orderMap.get(it.orderId);
              return {
                batchId: run.id,
                sourceRow: it.sourceRow,
                orderId: it.orderId,
                period: matched?.period || null,
                orderDate: matched?.orderDate || null,
                lineItemId: it.lineItemId,
                productName: it.productName,
                sku: it.sku,
                quantity: it.quantity,
                lineTotal: it.lineTotal,
                currency: it.currency,
                fulfillment: it.fulfillment,
                sourceLine: it.sourceLine,
                rawValues: it.rawValues as object,
              };
            }),
          });
        }

        // 8. Atomically switch Active Snapshot
        await tx.micromSheetActiveSnapshot.upsert({
          where: { id: 1 },
          create: {
            id: 1,
            activeRunId: run.id,
            lastCheckedAt: new Date(),
          },
          update: {
            activeRunId: run.id,
            lastCheckedAt: new Date(),
          },
        });

        // 9. Update Run status to SUCCESS
        await tx.micromSheetImportRun.update({
          where: { id: run.id },
          data: {
            status: "SUCCESS",
            completedAt: new Date(),
            insertedRows: totalRows,
          },
        });
      },
      { timeout: 30000 },
    );

    return {
      runId: run.id,
      status: "SUCCESS",
      totalRows,
      ordersCount: parsedOrders.length,
      cogsCount: parsedCogs.length,
      adsCount: parsedAds.length,
      itemsCount: parsedItems.length,
      providerReconciled: isProviderReconciled,
      manualEditAcknowledged: isManualEditAcknowledged,
      fingerprints: currentFingerprints,
      activeRunId: run.id,
      message: "Import Sheet-to-DB hoàn tất và chuyển snapshot thành công.",
    };
  } catch (err: unknown) {
    if (runId) {
      const msg = err instanceof Error ? err.message : String(err);
      await prisma.micromSheetImportRun
        .update({
          where: { id: runId },
          data: {
            status: "FAILED",
            completedAt: new Date(),
            errorMessage: msg,
          },
        })
        .catch(() => {});
    }
    throw err;
  } finally {
    await lockHandle.release();
  }
}
