import { NextResponse } from "next/server";
import { checkCurrentLockStatus } from "@/lib/ec/sheet-import/lock";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [activeSnapshot, latestRuns, lockStatus] = await Promise.all([
      prisma.ecSheetActiveSnapshot.findUnique({
        where: { id: 1 },
        include: {
          activeRun: true,
        },
      }),
      prisma.ecSheetImportRun.findMany({
        take: 10,
        orderBy: { startedAt: "desc" },
      }),
      checkCurrentLockStatus(),
    ]);

    const latestRun = latestRuns[0] || null;

    // 1. Last time data actually changed and new snapshot was published
    const lastDataChangeAt =
      activeSnapshot?.activeRun?.completedAt ||
      activeSnapshot?.updatedAt ||
      null;

    // 2. Last time a sync job successfully verified the Google Sheet (including NO_CHANGE runs)
    const latestCompletedRun = latestRuns.find((r) => r.status === "COMPLETED");
    const lastCheckedAt =
      activeSnapshot?.lastCheckedAt ||
      latestCompletedRun?.completedAt ||
      lastDataChangeAt;

    // 3. Stale indicator: only true if no successful check/run occurred within 24 hours
    const isStale = lastCheckedAt
      ? Date.now() - new Date(lastCheckedAt).getTime() > 24 * 60 * 60 * 1000
      : true;

    return NextResponse.json({
      success: true,
      activeSnapshot,
      latestRuns,
      latestRun,
      lockStatus,
      isCurrentlyRunning: lockStatus.isActive,
      isStale,
      lastCheckedAt,
      lastDataChangeAt,
      lastSuccessfulSync: lastCheckedAt, // backwards compatibility
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể lấy thông tin snapshot.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
