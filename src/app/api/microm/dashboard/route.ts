import { NextResponse } from "next/server";
import { getMicromDashboardSummary } from "@/lib/microm/dashboard-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;
    const summary = await getMicromDashboardSummary(month);
    return NextResponse.json({ success: true, data: summary });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
