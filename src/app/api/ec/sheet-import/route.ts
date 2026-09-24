import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { executeSheetImport, ImportError } from "@/lib/ec/sheet-import";
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
        {
          success: false,
          error: "Bạn không có quyền thực hiện đồng bộ từ Google Sheet.",
          category: "AUTH_UNAUTHORIZED",
        },
        { status: 401 },
      );
    }

    const body = (await request.json().catch(() => ({}))) as {
      spreadsheetId?: string;
      forceRefresh?: boolean;
    };

    const result = await executeSheetImport({
      triggerType: "MANUAL",
      actor: user.email || user.name || "Admin",
      spreadsheetId: body.spreadsheetId,
      forceRefresh: Boolean(body.forceRefresh),
    });

    return NextResponse.json({
      success: true,
      message: result.message,
      isNoChange: Boolean(result.isNoChange),
      data: result,
    });
  } catch (error) {
    const category =
      error instanceof ImportError ? error.category : "SYSTEM_ERROR";
    const status = error instanceof ImportError ? error.status : 500;
    const message =
      error instanceof Error
        ? error.message
        : "Đồng bộ từ Google Sheet thất bại.";

    return NextResponse.json(
      {
        success: false,
        error: message,
        category,
        code: category,
      },
      { status },
    );
  }
}
