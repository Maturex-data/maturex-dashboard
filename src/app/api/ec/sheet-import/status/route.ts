import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET() {
  try {
    const activeSnapshot = await prisma.ecSheetActiveSnapshot.findUnique({
      where: { id: 1 },
      include: {
        activeRun: true,
      },
    });

    const latestRuns = await prisma.ecSheetImportRun.findMany({
      take: 5,
      orderBy: { startedAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      activeSnapshot,
      latestRuns,
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
