import { NextResponse } from "next/server";
import { runMicromSheetToDbImport } from "@/lib/microm/sheet-importer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: {
      actor?: string;
      allowUnreconciledEdit?: boolean;
      acknowledgementReason?: string;
    } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body
    }

    const result = await runMicromSheetToDbImport({
      triggerType: "MANUAL",
      actor: body.actor || "admin",
      allowUnreconciledEdit: body.allowUnreconciledEdit,
      acknowledgementReason: body.acknowledgementReason,
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sheet import failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
