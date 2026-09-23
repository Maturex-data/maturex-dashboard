import { NextResponse } from "next/server";
import { getSheetRows } from "@/lib/ec/dashboard";

export const runtime = "nodejs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sheet = searchParams.get("sheet") as
      | "orders"
      | "cogs"
      | "ads"
      | "payouts";

    if (!sheet || !["orders", "cogs", "ads", "payouts"].includes(sheet)) {
      return NextResponse.json(
        {
          error:
            "Sheet không hợp lệ. Chọn một trong: orders, cogs, ads, payouts.",
        },
        { status: 400 },
      );
    }

    const month = searchParams.get("month") || undefined;
    const page = Number.parseInt(searchParams.get("page") || "1", 10);
    const limit = Number.parseInt(searchParams.get("limit") || "50", 10);
    const sort = searchParams.get("sort") || undefined;
    const dir = (searchParams.get("dir") as "asc" | "desc") || undefined;
    const search = searchParams.get("search") || undefined;
    const supplier = searchParams.get("supplier") || undefined;
    const type = searchParams.get("type") || undefined;
    const account = searchParams.get("account") || undefined;

    const data = await getSheetRows({
      sheet,
      month,
      page,
      limit,
      sort,
      dir,
      search,
      supplier,
      type,
      account,
    });

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Không thể tải danh sách dữ liệu.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
