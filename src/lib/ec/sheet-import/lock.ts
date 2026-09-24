import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { LockStolenError } from "./types";

export const STALE_LOCK_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export interface LockAcquisitionResult {
  acquired: boolean;
  lockedBy?: string | null;
  lockedAt?: Date | null;
  heartbeatAt?: Date | null;
}

/**
 * Atomically acquires the DB-backed lock for sheet import.
 * If the existing lock is stale (> 5 minutes without heartbeat),
 * it reclaims the lock and marks the expired run as FAILED.
 */
export async function acquireSheetImportLock(
  runId: string,
): Promise<LockAcquisitionResult> {
  // Ensure the singleton row exists
  await prisma.$executeRaw`
    INSERT INTO ec_sheet_import_locks (id, is_locked)
    VALUES (1, false)
    ON CONFLICT (id) DO NOTHING
  `;

  // Atomic update: only succeeds if is_locked is false OR heartbeat is older than threshold
  const updatedCount = await prisma.$executeRaw`
    UPDATE ec_sheet_import_locks
    SET
      is_locked = true,
      locked_by = ${runId},
      locked_at = NOW(),
      heartbeat_at = NOW()
    WHERE id = 1
      AND (
        is_locked = false
        OR heartbeat_at IS NULL
        OR heartbeat_at < NOW() - INTERVAL '5 minutes'
      )
  `;

  if (updatedCount > 0) {
    // Reclaim cleanup: mark any other 'RUNNING' runs as timed out
    try {
      await prisma.ecSheetImportRun.updateMany({
        where: {
          id: { not: runId },
          status: "RUNNING",
          heartbeatAt: {
            lt: new Date(Date.now() - STALE_LOCK_THRESHOLD_MS),
          },
        },
        data: {
          status: "FAILED",
          completedAt: new Date(),
          errorCategory: "LOCK_STOLEN",
          errorMessage:
            "Tiến trình bị treo quá hạn (stale heartbeat > 5 phút). Khóa đã được giải phóng.",
        },
      });
    } catch {
      // Ignore background cleanup error
    }

    return { acquired: true };
  }

  // Failed to acquire lock: check current lock holder info
  const currentLock = await prisma.ecSheetImportLock.findUnique({
    where: { id: 1 },
  });

  return {
    acquired: false,
    lockedBy: currentLock?.lockedBy,
    lockedAt: currentLock?.lockedAt,
    heartbeatAt: currentLock?.heartbeatAt,
  };
}

/**
 * Updates heartbeat for the running job.
 */
export async function updateSheetImportHeartbeat(runId: string): Promise<void> {
  const now = new Date();
  await Promise.all([
    prisma.$executeRaw`
      UPDATE ec_sheet_import_locks
      SET heartbeat_at = NOW()
      WHERE id = 1 AND locked_by = ${runId}
    `,
    prisma.ecSheetImportRun
      .update({
        where: { id: runId },
        data: { heartbeatAt: now },
      })
      .catch(() => undefined),
  ]);
}

/**
 * Releases the import lock ONLY if it is still owned by runId.
 */
export async function releaseSheetImportLock(runId: string): Promise<void> {
  await prisma.$executeRaw`
    UPDATE ec_sheet_import_locks
    SET
      is_locked = false,
      locked_by = NULL,
      locked_at = NULL,
      heartbeat_at = NULL
    WHERE id = 1 AND locked_by = ${runId}
  `;
}

/**
 * Verifies lock ownership inside a transaction prior to publishing.
 */
export async function verifyLockOwnership(
  runId: string,
  tx: Prisma.TransactionClient,
): Promise<void> {
  const lock = await tx.ecSheetImportLock.findUnique({
    where: { id: 1 },
  });

  if (!lock || lock.lockedBy !== runId) {
    throw new LockStolenError(
      `Mất quyền sở hữu khóa (khóa hiện tại thuộc về: ${lock?.lockedBy ?? "không có"}). Hủy lưu snapshot.`,
    );
  }
}

/**
 * Check if import lock is currently active and healthy.
 */
export async function checkCurrentLockStatus(): Promise<{
  isActive: boolean;
  lockedBy: string | null;
  lockedAt: Date | null;
  heartbeatAt: Date | null;
  isStale: boolean;
}> {
  const lock = await prisma.ecSheetImportLock.findUnique({
    where: { id: 1 },
  });

  if (!lock || !lock.isLocked || !lock.heartbeatAt) {
    return {
      isActive: false,
      lockedBy: null,
      lockedAt: null,
      heartbeatAt: null,
      isStale: false,
    };
  }

  const isStale =
    Date.now() - lock.heartbeatAt.getTime() > STALE_LOCK_THRESHOLD_MS;
  return {
    isActive: !isStale,
    lockedBy: lock.lockedBy,
    lockedAt: lock.lockedAt,
    heartbeatAt: lock.heartbeatAt,
    isStale,
  };
}
