import { NextResponse } from "next/server";
import { getMicromTabRows } from "@/lib/microm/dashboard-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab = searchParams.get("tab") as
      | "Orders"
      | "COGS"
      | "Ads"
      | "Shopify_Items";
    const month = searchParams.get("month") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Number(searchParams.get("page") || "1");
    const limit = Number(searchParams.get("limit") || "50");
    const sortBy = searchParams.get("sortBy") || undefined;
    const sortOrder =
      (searchParams.get("sortOrder") as "asc" | "desc") || "desc";

    if (!tab || !["Orders", "COGS", "Ads", "Shopify_Items"].includes(tab)) {
      return NextResponse.json(
        { success: false, error: "Invalid tab name" },
        { status: 400 },
      );
    }

    const data = await getMicromTabRows({
      tab,
      month,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
