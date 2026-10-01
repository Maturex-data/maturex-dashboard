import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  EcProgressSheetError,
  getEcProgressSheetTables,
} from "@/lib/ec-progress-sheet";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;

  if (!user) {
    return NextResponse.json(
      { error: "Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const data = await getEcProgressSheetTables();
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = error instanceof EcProgressSheetError ? error.status : 500;
    const message =
      error instanceof EcProgressSheetError
        ? error.message
        : "Không tải được dữ liệu tiến độ. Vui lòng thử lại.";

    return NextResponse.json(
      { error: message },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
