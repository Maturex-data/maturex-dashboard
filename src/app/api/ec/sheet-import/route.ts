import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { executeSheetImport } from "@/lib/ec/sheet-import";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
    const user = token ? await verifyAccessToken(token) : null;

    if (!user || user.role !== "admin") {
      return NextResponse.json(
        { error: "Bạn không có quyền thực hiện đồng bộ từ Google Sheet." },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      spreadsheetId?: string;
    };

    const result = await executeSheetImport({
      actor: user.email || user.name || "Admin",
      spreadsheetId: body.spreadsheetId,
    });

    return NextResponse.json({
      success: true,
      message: `Đồng bộ thành công ${result.insertedRows.toLocaleString()} dòng từ Google Sheet!`,
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Đồng bộ từ Google Sheet thất bại.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
