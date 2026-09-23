import { NextResponse } from "next/server";
import { getEcDashboardSummary } from "@/lib/ec/dashboard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const month = searchParams.get("month") || undefined;

    const summary = await getEcDashboardSummary(month);

    return NextResponse.json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể tải dữ liệu dashboard.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
