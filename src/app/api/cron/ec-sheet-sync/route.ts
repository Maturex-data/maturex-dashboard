import { NextResponse } from "next/server";
import { executeSheetImport, ImportError } from "@/lib/ec/sheet-import";

export const runtime = "nodejs";
export const maxDuration = 300;

function verifyCronAuth(request: Request): boolean {
  const cronSecret = process.env.CRON_SECRET?.trim();
  if (!cronSecret) {
    // If CRON_SECRET is not configured on the server, deny all scheduled requests for safety
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const xCronSecret = request.headers.get("x-cron-secret");

  if (authHeader && authHeader === `Bearer ${cronSecret}`) {
    return true;
  }

  if (xCronSecret && xCronSecret === cronSecret) {
    return true;
  }

  return false;
}

async function handleScheduledSync(request: Request) {
  if (!verifyCronAuth(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Invalid or missing cron secret.",
      },
      { status: 401 },
    );
  }

  try {
    // Always use default production spreadsheet ID, never accept arbitrary ID from scheduler
    const result = await executeSheetImport({
      triggerType: "CRON",
      actor: "System Cron",
    });

    return NextResponse.json({
      success: true,
      runId: result.runId,
      outcome: result.status,
      isNoChange: Boolean(result.isNoChange),
      totalRows: result.totalRows,
      insertedRows: result.insertedRows,
      elapsedMs: result.elapsedMs,
      startedAt: result.startedAt,
      completedAt: result.completedAt,
      message: result.message,
    });
  } catch (error) {
    const errorCategory =
      error instanceof ImportError ? error.category : "SYSTEM_ERROR";
    const statusCode = error instanceof ImportError ? error.status : 500;
    const message =
      error instanceof Error ? error.message : "Đồng bộ định kỳ thất bại.";

    return NextResponse.json(
      {
        success: false,
        outcome: "FAILED",
        errorCategory,
        error: message,
      },
      { status: statusCode },
    );
  }
}

// Vercel Cron sends GET requests; external callers or webhooks may send GET or POST
export async function GET(request: Request) {
  return handleScheduledSync(request);
}

export async function POST(request: Request) {
  return handleScheduledSync(request);
}
