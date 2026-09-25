import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getMicromTabRows } from "@/lib/microm/dashboard-queries";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tab =
      (searchParams.get("tab") as
        | "Orders"
        | "COGS"
        | "Ads"
        | "Shopify_Items") || "Orders";
    const month = searchParams.get("month") || undefined;
    const format = (searchParams.get("format") || "xlsx").toLowerCase();

    const data = await getMicromTabRows({
      tab,
      month,
      limit: 50000,
      maxLimit: 50000,
    });

    const rows = data.rows as Record<string, unknown>[];

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, tab);

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(worksheet);
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="microm_${tab.toLowerCase()}_${month || "all"}.csv"`,
        },
      });
    }

    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    return new NextResponse(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="microm_${tab.toLowerCase()}_${month || "all"}.xlsx"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Export failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
