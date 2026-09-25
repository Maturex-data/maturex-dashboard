import { NextResponse } from "next/server";
import type { MicromTabName } from "@/lib/microm/constants";
import { clearMicromSheetData } from "@/lib/microm/sheet-clearer";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    let body: {
      sheets?: MicromTabName[];
      actor?: string;
    } = {};

    try {
      body = await request.json();
    } catch {
      // Empty body is acceptable
    }

    const result = await clearMicromSheetData({
      sheets: body.sheets,
      actor: body.actor || "admin_manual",
    });

    return NextResponse.json({
      success: true,
      message: `Đã xóa an toàn ${result.totalCleared} ô dữ liệu trên ${result.results.length} tab (giữ nguyên ${result.totalFormulas} ô công thức).`,
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể dọn dẹp các tab dữ liệu trên Google Sheet.";
    return NextResponse.json(
      {
        success: false,
        error: message,
      },
      { status: 500 },
    );
  }
}
