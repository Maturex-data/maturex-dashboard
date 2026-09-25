import { NextResponse } from "next/server";
import { runMicromProviderToSheetSync } from "@/lib/microm/sync-provider-to-sheet";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: { actor?: string; sinceDate?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body
    }

    const result = await runMicromProviderToSheetSync({
      triggerType: "MANUAL",
      actor: body.actor || "admin",
      sinceDate: body.sinceDate,
    });

    const isSuccess = result.status === "SUCCESS" && result.isReconciled;
    return NextResponse.json(
      {
        success: isSuccess,
        data: result,
        error: isSuccess
          ? undefined
          : result.errors?.join("; ") ||
            "Provider sync did not reconcile completely with Google Sheet",
      },
      { status: isSuccess ? 200 : 207 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Provider sync failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
