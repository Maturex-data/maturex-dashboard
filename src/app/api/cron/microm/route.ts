import { NextResponse } from "next/server";
import { runMicromSheetToDbImport } from "@/lib/microm/sheet-importer";
import { runMicromProviderToSheetSync } from "@/lib/microm/sync-provider-to-sheet";

export const dynamic = "force-dynamic";

function verifyBearerToken(request: Request): boolean {
  const authHeader = request.headers.get("Authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return false;
  }

  if (!authHeader) {
    return false;
  }

  const token = authHeader.replace(/^Bearer\s+/i, "").trim();
  return token === cronSecret.trim();
}

export async function GET(request: Request) {
  return handleCron(request);
}

export async function POST(request: Request) {
  return handleCron(request);
}

async function handleCron(request: Request) {
  if (!verifyBearerToken(request)) {
    return NextResponse.json(
      {
        success: false,
        error: "Unauthorized: Invalid or missing bearer token.",
      },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const stage = url.searchParams.get("stage") || "all";
  const sinceDate = url.searchParams.get("sinceDate") || undefined;
  const isFullBackfill = url.searchParams.get("fullBackfill") === "true";
  const startTime = Date.now();

  try {
    let providerResult: unknown = null;

    // Stage 1: Provider-to-Sheet (if requested or by default)
    if (stage === "all" || stage === "provider-to-sheet") {
      const pResult = await runMicromProviderToSheetSync({
        triggerType: "SCHEDULED",
        actor: "cron_orchestrator",
        sinceDate,
        isFullBackfill,
      });
      providerResult = pResult;

      if (!pResult.isReconciled || pResult.status !== "SUCCESS") {
        return NextResponse.json(
          {
            success: false,
            stage: "PROVIDER_TO_SHEET",
            message:
              "Provider-to-Sheet sync did not reconcile completely. Sheet-to-DB stage was halted to protect data integrity.",
            providerResult: pResult,
            durationMs: Date.now() - startTime,
          },
          { status: 502 },
        );
      }

      if (stage === "provider-to-sheet") {
        return NextResponse.json({
          success: true,
          stage: "PROVIDER_TO_SHEET",
          message: "Provider-to-Sheet sync completed successfully.",
          providerResult: pResult,
          durationMs: Date.now() - startTime,
        });
      }
    }

    // Stage 2: Sheet-to-DB (if requested or by default)
    if (stage === "all" || stage === "sheet-to-db") {
      const importResult = await runMicromSheetToDbImport({
        triggerType: "SCHEDULED",
        actor: "cron_orchestrator",
      });

      if (importResult.status !== "SUCCESS") {
        return NextResponse.json(
          {
            success: false,
            stage: "SHEET_TO_DB",
            message: "Sheet-to-DB import failed.",
            providerResult,
            importResult,
            durationMs: Date.now() - startTime,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        success: true,
        stage: "COMPLETED",
        message: "Microm pipeline finished successfully.",
        providerResult,
        importResult,
        durationMs: Date.now() - startTime,
      });
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Pipeline failed";
    return NextResponse.json(
      {
        success: false,
        error: message,
        durationMs: Date.now() - startTime,
      },
      { status: 500 },
    );
  }
}
