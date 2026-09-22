import { formatVietnamDate, vietnamMonthRange } from "@/lib/date-time";
import { prisma } from "@/lib/prisma";
import { fetchLuxuryPro } from "./providers/luxury-pro";
import { fetchPgPrint } from "./providers/pgprint";
import { fetchPrintful } from "./providers/printful";
import { fetchPrintify } from "./providers/printify";
import {
  type CogsRow,
  type CogsSource,
  cogsHistoryRange,
  type DateRange,
  HISTORY_FROM,
  previousMonthRange,
  STALE_JOB_MS,
  WRITE_BATCH_SIZE,
} from "./types";

export const COGS_SOURCES = [
  ["PGPrint", fetchPgPrint],
  ["Printify", fetchPrintify],
  ["Printful", fetchPrintful],
  ["Luxury Pro", fetchLuxuryPro],
] as const;

export function sourceEntries(selectedSource?: CogsSource) {
  return selectedSource
    ? COGS_SOURCES.filter(([source]) => source === selectedSource)
    : [...COGS_SOURCES];
}

export async function persistRows(rows: CogsRow[]): Promise<{
  added: number;
  skipped: number;
}> {
  if (rows.length === 0) return { added: 0, skipped: 0 };
  const existing = await prisma.cogsRecord.findMany({
    where: { itemKey: { in: rows.map((row) => row.itemKey) } },
    select: { itemKey: true },
  });
  const existingKeys = new Set(existing.map((row) => row.itemKey));
  const newRows = rows.filter((row) => !existingKeys.has(row.itemKey));
  const existingRows = rows.filter((row) => existingKeys.has(row.itemKey));
  const inserted = await prisma.cogsRecord.createMany({
    data: newRows,
    skipDuplicates: true,
  });
  for (let index = 0; index < existingRows.length; index += WRITE_BATCH_SIZE) {
    const batch = existingRows.slice(index, index + WRITE_BATCH_SIZE);
    await Promise.all(
      batch.map((row) =>
        prisma.cogsRecord.update({
          where: { itemKey: row.itemKey },
          data: row,
        }),
      ),
    );
  }
  return { added: inserted.count, skipped: existingRows.length };
}

export async function fetchCogsFromSourceApis(
  range: DateRange,
): Promise<CogsRow[]> {
  const results = await Promise.all(
    COGS_SOURCES.map(async ([source, fetcher]) => ({
      source,
      rows: await fetcher(range),
    })),
  );
  return results.flatMap((result) => result.rows);
}

export async function syncCogs(
  selectedSource?: CogsSource,
  range = previousMonthRange(),
): Promise<{
  added: number;
  skipped: number;
  sources: Record<string, number>;
  from: string;
  until: string;
}> {
  const entries = sourceEntries(selectedSource);
  const run = await prisma.cogsSyncRun.create({
    data: {
      status: "RUNNING",
      syncType: "LATEST",
      rangeFrom: range.from,
      rangeTo: range.to,
      sourceRuns: {
        create: entries.map(([source]) => ({
          source,
          status: "RUNNING",
          startedAt: new Date(),
        })),
      },
    },
  });
  try {
    const results = await Promise.allSettled(
      entries.map(async ([source, fetcher]) => {
        const sourceKey = { runId_source: { runId: run.id, source } };
        try {
          const rows = await fetcher(range, async (progress) => {
            const now = new Date();
            await Promise.all([
              prisma.cogsSyncRun.update({
                where: { id: run.id },
                data: { heartbeatAt: now },
              }),
              prisma.cogsSyncSourceRun.update({
                where: sourceKey,
                data: { ...progress, heartbeatAt: now },
              }),
            ]);
          });
          const counts = await persistRows(rows);
          await prisma.cogsSyncSourceRun.update({
            where: sourceKey,
            data: {
              status: "COMPLETED",
              completedAt: new Date(),
              heartbeatAt: new Date(),
              rowsFetched: rows.length,
              addedCount: counts.added,
              skippedCount: counts.skipped,
            },
          });
          return { source, rows, ...counts };
        } catch (error) {
          await prisma.cogsSyncSourceRun.update({
            where: sourceKey,
            data: {
              status: "FAILED",
              completedAt: new Date(),
              heartbeatAt: new Date(),
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            },
          });
          throw error;
        }
      }),
    );
    const sources: Record<string, number> = {};
    let added = 0;
    let skipped = 0;
    results.forEach((result, index) => {
      const name = entries[index][0];
      if (result.status === "fulfilled") {
        sources[name] = result.value.rows.length;
        added += result.value.added;
        skipped += result.value.skipped;
      } else {
        sources[`${name}_error`] = 1;
      }
    });
    const failed = results.filter((result) => result.status === "rejected");
    await prisma.cogsSyncRun.update({
      where: { id: run.id },
      data: {
        status: failed.length > 0 ? "PARTIAL_FAILED" : "COMPLETED",
        completedAt: new Date(),
        addedCount: added,
        skippedCount: skipped,
        sourceResults: sources,
        errorMessage:
          failed.length > 0 ? `${failed.length} source(s) failed.` : null,
      },
    });
    return {
      added,
      skipped,
      sources,
      from: formatVietnamDate(range.from),
      until: formatVietnamDate(new Date(range.to.getTime() - 1)),
    };
  } catch (error) {
    await prisma.cogsSyncRun.update({
      where: { id: run.id },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function createCogsSyncJob(
  range = cogsHistoryRange(),
  syncType: "HISTORY" | "LATEST" = "HISTORY",
): Promise<{ id: string; reused: boolean }> {
  const staleBefore = new Date(Date.now() - STALE_JOB_MS);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext('maturex-cogs-sync'))",
    );
    const staleRuns = await tx.cogsSyncRun.findMany({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        OR: [
          { heartbeatAt: { lt: staleBefore } },
          { startedAt: { lt: staleBefore } },
        ],
      },
      select: { id: true },
    });
    if (staleRuns.length > 0) {
      const ids = staleRuns.map((run) => run.id);
      await tx.cogsSyncSourceRun.updateMany({
        where: { runId: { in: ids }, status: { in: ["QUEUED", "RUNNING"] } },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "Job became stale before completion.",
        },
      });
      await tx.cogsSyncRun.updateMany({
        where: { id: { in: ids } },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorMessage: "No heartbeat for 15 minutes.",
        },
      });
    }
    const active = await tx.cogsSyncRun.findFirst({
      where: {
        status: { in: ["QUEUED", "RUNNING"] },
        heartbeatAt: { gte: staleBefore },
      },
      orderBy: { startedAt: "desc" },
    });
    if (active) return { id: active.id, reused: true };
    const run = await tx.cogsSyncRun.create({
      data: {
        status: "QUEUED",
        syncType,
        rangeFrom: range.from,
        rangeTo: range.to,
        sourceRuns: {
          create: COGS_SOURCES.map(([source]) => ({ source })),
        },
      },
    });
    return { id: run.id, reused: false };
  });
}

export async function executeSourceRun(
  runId: string,
  source: CogsSource,
  range: DateRange,
): Promise<void> {
  const entry = COGS_SOURCES.find(([name]) => name === source);
  if (!entry) throw new Error(`Unknown COGS source: ${source}`);
  const sourceKey = { runId_source: { runId, source } };
  await prisma.cogsSyncSourceRun.update({
    where: sourceKey,
    data: {
      status: "RUNNING",
      startedAt: new Date(),
      completedAt: null,
      errorMessage: null,
    },
  });
  try {
    const rows = await entry[1](range, async (progress) => {
      const now = new Date();
      await Promise.all([
        prisma.cogsSyncRun.update({
          where: { id: runId },
          data: { heartbeatAt: now },
        }),
        prisma.cogsSyncSourceRun.update({
          where: sourceKey,
          data: { ...progress, heartbeatAt: now },
        }),
      ]);
    });
    const counts = await persistRows(rows);
    await prisma.cogsSyncSourceRun.update({
      where: sourceKey,
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        heartbeatAt: new Date(),
        rowsFetched: rows.length,
        addedCount: counts.added,
        skippedCount: counts.skipped,
      },
    });
  } catch (error) {
    await prisma.cogsSyncSourceRun.update({
      where: sourceKey,
      data: {
        status: "FAILED",
        completedAt: new Date(),
        heartbeatAt: new Date(),
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}

export async function executeCogsSyncJob(
  runId: string,
  retryFailedOnly = false,
): Promise<void> {
  const run = await prisma.cogsSyncRun.findUnique({
    where: { id: runId },
    include: { sourceRuns: true },
  });
  if (!run) throw new Error("COGS sync job not found.");
  if (
    ["QUEUED", "RUNNING"].includes(run.status) &&
    run.heartbeatAt.getTime() < Date.now() - STALE_JOB_MS
  ) {
    await prisma.cogsSyncRun.update({
      where: { id: runId },
      data: {
        status: "FAILED",
        completedAt: new Date(),
        errorMessage: "No heartbeat for 15 minutes.",
      },
    });
    return;
  }
  const sourceRuns = retryFailedOnly
    ? run.sourceRuns.filter((sourceRun) =>
        ["FAILED", "QUEUED"].includes(sourceRun.status),
      )
    : run.sourceRuns.filter((sourceRun) => sourceRun.status !== "COMPLETED");
  if (sourceRuns.length === 0) return;
  await prisma.cogsSyncRun.update({
    where: { id: runId },
    data: {
      status: "RUNNING",
      completedAt: null,
      heartbeatAt: new Date(),
      errorMessage: null,
    },
  });
  const range = {
    from: run.rangeFrom || HISTORY_FROM,
    to: run.rangeTo || new Date(),
  };
  await Promise.allSettled(
    sourceRuns.map((sourceRun) =>
      executeSourceRun(runId, sourceRun.source as CogsSource, range),
    ),
  );
  const completed = await prisma.cogsSyncSourceRun.findMany({
    where: { runId },
  });
  const failed = completed.filter((sourceRun) => sourceRun.status === "FAILED");
  const added = completed.reduce(
    (sum, sourceRun) => sum + sourceRun.addedCount,
    0,
  );
  const skipped = completed.reduce(
    (sum, sourceRun) => sum + sourceRun.skippedCount,
    0,
  );
  await prisma.cogsSyncRun.update({
    where: { id: runId },
    data: {
      status: failed.length > 0 ? "PARTIAL_FAILED" : "COMPLETED",
      completedAt: new Date(),
      heartbeatAt: new Date(),
      addedCount: added,
      skippedCount: skipped,
      sourceResults: Object.fromEntries(
        completed.map((sourceRun) => [
          sourceRun.source,
          {
            status: sourceRun.status,
            rows: sourceRun.rowsFetched,
            added: sourceRun.addedCount,
            skipped: sourceRun.skippedCount,
          },
        ]),
      ),
      errorMessage:
        failed.length > 0 ? `${failed.length} source(s) failed.` : null,
    },
  });
}

export async function retryCogsSyncJob(runId: string): Promise<boolean> {
  const failed = await prisma.cogsSyncSourceRun.count({
    where: { runId, status: "FAILED" },
  });
  if (failed === 0) return false;
  await prisma.cogsSyncSourceRun.updateMany({
    where: { runId, status: "FAILED" },
    data: { status: "QUEUED", completedAt: null, errorMessage: null },
  });
  await prisma.cogsSyncRun.update({
    where: { id: runId },
    data: {
      status: "QUEUED",
      completedAt: null,
      heartbeatAt: new Date(),
      errorMessage: null,
    },
  });
  return true;
}

export async function getCogsSyncJob(id?: string) {
  return prisma.cogsSyncRun.findFirst({
    where: id ? { id } : { syncType: "HISTORY" },
    orderBy: { startedAt: "desc" },
    include: { sourceRuns: { orderBy: { source: "asc" } } },
  });
}

export async function listCogs(month?: string) {
  const validMonth = month && /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  const range = validMonth ? vietnamMonthRange(month) : undefined;
  const from = range?.from || HISTORY_FROM;
  const to = range?.to || new Date();
  return prisma.cogsRecord.findMany({
    where: { date: { gte: from, lt: to } },
    orderBy: [{ date: "desc" }, { supplier: "asc" }],
    select: {
      id: true,
      supplier: true,
      date: true,
      referenceOrderId: true,
      supplierOrderId: true,
      totalCost: true,
      estimatedCost: true,
    },
  });
}
