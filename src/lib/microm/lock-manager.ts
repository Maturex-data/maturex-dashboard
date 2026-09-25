import { prisma } from "@/lib/prisma";

export class MicromLockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MicromLockError";
  }
}

export interface MicromLockHandle {
  release: () => Promise<void>;
}

/**
 * Atomically acquires the singleton Microm lock (id = 1) using PostgreSQL conditional update.
 * If the lock is held and heartbeat is fresh (< 15 min), throws MicromLockError.
 * Starts a 30s heartbeat timer while held, and provides an idempotent release() function.
 */
export async function acquireMicromLock(
  lockedBy: string,
): Promise<MicromLockHandle> {
  // Ensure the singleton row id=1 exists in database
  await prisma.$executeRaw`
    INSERT INTO microm_sheet_import_locks (id, is_locked, locked_by, locked_at, heartbeat_at)
    VALUES (1, false, NULL, NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
  `;

  // Atomic test-and-set: acquire only if not locked, or if heartbeat is older than 15 minutes (stale recovery)
  const rows = await prisma.$queryRaw<Array<{ id: number }>>`
    UPDATE microm_sheet_import_locks
    SET is_locked = true,
        locked_by = ${lockedBy},
        locked_at = NOW(),
        heartbeat_at = NOW()
    WHERE id = 1
      AND (is_locked = false OR heartbeat_at < NOW() - INTERVAL '15 minutes')
    RETURNING id;
  `;

  if (!rows || rows.length === 0) {
    const current = await prisma.micromSheetImportLock.findUnique({
      where: { id: 1 },
    });
    throw new MicromLockError(
      `Tác vụ Microm đang được xử lý bởi ${current?.lockedBy || "tiến trình khác"} từ lúc ${
        current?.lockedAt ? current.lockedAt.toISOString() : "không rõ"
      }. Vui lòng thử lại sau.`,
    );
  }

  // Maintain heartbeat every 30 seconds to prevent long-running jobs from being stolen
  const timer = setInterval(async () => {
    try {
      await prisma.$executeRaw`
        UPDATE microm_sheet_import_locks
        SET heartbeat_at = NOW()
        WHERE id = 1 AND is_locked = true AND locked_by = ${lockedBy};
      `;
    } catch (err) {
      console.error("Microm lock heartbeat update failed:", err);
    }
  }, 30000);

  let released = false;
  return {
    release: async () => {
      if (released) return;
      released = true;
      clearInterval(timer);
      try {
        await prisma.$executeRaw`
          UPDATE microm_sheet_import_locks
          SET is_locked = false,
              locked_by = NULL
          WHERE id = 1 AND locked_by = ${lockedBy};
        `;
      } catch (err) {
        console.error("Failed to release Microm lock:", err);
      }
    },
  };
}
