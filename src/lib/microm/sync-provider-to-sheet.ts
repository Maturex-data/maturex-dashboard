import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { prisma } from "@/lib/prisma";
import { MICROM_SPREADSHEET_ID } from "./constants";
import { acquireMicromLock } from "./lock-manager";
import { fetchMicromMetaInsights } from "./meta-adapter";
import { fetchMicromPGPrintOrders } from "./pgprint-adapter";
import {
  writeAdsToSheet,
  writeCogsToSheet,
  writeOrdersToSheet,
  writeShopifyItemsToSheet,
} from "./sheet-writer";
import { fetchMicromShopifyOrders } from "./shopify-adapter";
import type {
  MicromProviderRunSummary,
  TabFingerprints,
  TabStats,
} from "./types";

export interface SyncProviderToSheetOptions {
  triggerType?: "MANUAL" | "SCHEDULED";
  actor?: string;
  sinceDate?: string;
  isFullBackfill?: boolean;
}

export async function runMicromProviderToSheetSync(
  options: SyncProviderToSheetOptions = {},
): Promise<MicromProviderRunSummary> {
  const triggerType = options.triggerType || "MANUAL";
  const actor = options.actor || "system";
  const spreadsheetId = MICROM_SPREADSHEET_ID;

  // Compute effective date window: scheduled runs default to rolling 14-day lookback to avoid API timeouts
  const defaultSinceDate =
    options.isFullBackfill || (triggerType === "MANUAL" && !options.sinceDate)
      ? "2026-01-01T00:00:00Z"
      : new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
  const effectiveSinceDate = options.sinceDate || defaultSinceDate;

  // 1. Acquire atomic concurrency lock with 30s heartbeat
  const lockHandle = await acquireMicromLock(`provider_sync_${triggerType}`);

  let runId = "";
  try {
    // 2. Create MicromSourceSyncRun
    const run = await prisma.micromSourceSyncRun.create({
      data: {
        status: "RUNNING",
        triggerType,
        actor,
        startedAt: new Date(),
        windowStart: new Date(effectiveSinceDate),
        windowEnd: new Date(),
      },
    });
    runId = run.id;

    const errors: string[] = [];
    const sourcesSummary: Record<string, unknown> = {};
    const fingerprints: TabFingerprints = {};
    const stats: Record<string, TabStats> = {};

    const access = await getGoogleDriveAccess();
    const token = access.accessToken;

    // --- Provider 1: Shopify Orders & Items ---
    try {
      const shopifyRes = await fetchMicromShopifyOrders({
        sinceDate: effectiveSinceDate,
      });

      const writeOrders = await writeOrdersToSheet(
        spreadsheetId,
        token,
        shopifyRes.orderRows,
      );
      fingerprints.Orders = writeOrders.fingerprint;
      stats.Orders = {
        rowCount: writeOrders.writtenCount,
        minDate: shopifyRes.orderRows[shopifyRes.orderRows.length - 1]?.ngayTao,
        maxDate: shopifyRes.orderRows[0]?.ngayTao,
      };

      const writeItems = await writeShopifyItemsToSheet(
        spreadsheetId,
        token,
        shopifyRes.itemRows,
      );
      fingerprints.Shopify_Items = writeItems.fingerprint;
      stats.Shopify_Items = {
        rowCount: writeItems.writtenCount,
      };

      sourcesSummary.shopify = {
        success: true,
        ordersFetched: shopifyRes.orders.length,
        orderRowsWritten: writeOrders.writtenCount,
        itemRowsWritten: writeItems.writtenCount,
      };
    } catch (sErr: unknown) {
      const msg = sErr instanceof Error ? sErr.message : String(sErr);
      errors.push(`Shopify: ${msg}`);
      sourcesSummary.shopify = { success: false, error: msg };
    }

    // --- Provider 2: PGPrint COGS ---
    try {
      const pgprintRes = await fetchMicromPGPrintOrders({
        fromTime: Date.parse(effectiveSinceDate),
      });

      const writeCogs = await writeCogsToSheet(
        spreadsheetId,
        token,
        pgprintRes.cogsRows,
      );
      fingerprints.COGS = writeCogs.fingerprint;
      stats.COGS = {
        rowCount: writeCogs.writtenCount,
        minDate: pgprintRes.cogsRows[pgprintRes.cogsRows.length - 1]?.ngayTao,
        maxDate: pgprintRes.cogsRows[0]?.ngayTao,
      };

      sourcesSummary.pgprint = {
        success: true,
        ordersFetched: pgprintRes.orders.length,
        cogsRowsWritten: writeCogs.writtenCount,
      };
    } catch (pErr: unknown) {
      const msg = pErr instanceof Error ? pErr.message : String(pErr);
      errors.push(`PGPrint: ${msg}`);
      sourcesSummary.pgprint = { success: false, error: msg };
    }

    // --- Provider 3: Meta Ads ---
    try {
      const metaRes = await fetchMicromMetaInsights({
        startDate: effectiveSinceDate.slice(0, 10),
      });

      const writeAds = await writeAdsToSheet(
        spreadsheetId,
        token,
        metaRes.adRows,
      );
      fingerprints.Ads = writeAds.fingerprint;
      stats.Ads = {
        rowCount: writeAds.writtenCount,
        minDate: metaRes.adRows[metaRes.adRows.length - 1]?.ngay,
        maxDate: metaRes.adRows[0]?.ngay,
      };

      sourcesSummary.meta = {
        success: true,
        insightsFetched: metaRes.adRows.length,
        adRowsWritten: writeAds.writtenCount,
      };
    } catch (mErr: unknown) {
      const msg = mErr instanceof Error ? mErr.message : String(mErr);
      errors.push(`Meta: ${msg}`);
      sourcesSummary.meta = { success: false, error: msg };
    }

    // Evaluate overall run outcome
    let isReconciled = errors.length === 0;
    let finalStatus: "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" = isReconciled
      ? "SUCCESS"
      : errors.length < 3
        ? "PARTIAL_SUCCESS"
        : "FAILED";

    // Read back verified post-write fingerprints from the sheet with strict error handling
    if (isReconciled) {
      try {
        const { readMicromSheetData } = await import("./sheet-reader");
        const { fingerprints: verifiedFps } =
          await readMicromSheetData(spreadsheetId);
        Object.assign(fingerprints, verifiedFps);
      } catch (readErr: unknown) {
        const msg =
          readErr instanceof Error ? readErr.message : String(readErr);
        errors.push(`Post-write verification failed: ${msg}`);
        isReconciled = false;
        finalStatus = "PARTIAL_SUCCESS";
      }
    }

    await prisma.micromSourceSyncRun.update({
      where: { id: run.id },
      data: {
        status: finalStatus,
        completedAt: new Date(),
        sources: sourcesSummary as object,
        perTabFingerprints: fingerprints as object,
        isReconciled,
        errorMessage: errors.length > 0 ? errors.join("; ") : null,
      },
    });

    return {
      runId: run.id,
      startedAt: run.startedAt.toISOString(),
      completedAt: new Date().toISOString(),
      status: finalStatus,
      isReconciled,
      sources: sourcesSummary,
      perTabFingerprints: fingerprints,
      stats,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (fatalErr: unknown) {
    if (runId) {
      const msg =
        fatalErr instanceof Error ? fatalErr.message : String(fatalErr);
      await prisma.micromSourceSyncRun
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
    throw fatalErr;
  } finally {
    await lockHandle.release();
  }
}
