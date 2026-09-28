import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";
import { syncShopifyPayoutMonthToSheet } from "@/lib/shopify-payout-sheet-sync";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let month: unknown;
  try {
    ({ month } = (await request.json()) as { month?: unknown });
  } catch {
    return NextResponse.json(
      { error: "Request body không hợp lệ." },
      { status: 400 },
    );
  }
  if (typeof month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json(
      { error: "Vui lòng chọn tháng hợp lệ." },
      { status: 400 },
    );
  }

  try {
    const rowsWritten = await syncShopifyPayoutMonthToSheet(month);
    return NextResponse.json({ success: true, month, rowsWritten });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đồng bộ Shopify payouts lên Google Sheet.",
      },
      { status: 500 },
    );
  }
}
