import { isVietnamMonth } from "@/lib/date-time";
import { buildEcBusinessReport } from "@/lib/ec-business-report-export";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const first = url.searchParams.get("first") || "";
    const second = url.searchParams.get("second") || "";
    const mode = url.searchParams.get("mode");
    if (!isVietnamMonth(first)) {
      return Response.json(
        { error: "Tháng xuất báo cáo không hợp lệ." },
        { status: 400 },
      );
    }
    if (mode !== "one" && mode !== "comparison") {
      return Response.json(
        { error: "Chế độ xuất báo cáo không hợp lệ." },
        { status: 400 },
      );
    }
    if (mode === "comparison" && !isVietnamMonth(second)) {
      return Response.json(
        { error: "Tháng so sánh không hợp lệ." },
        { status: 400 },
      );
    }

    const months = mode === "comparison" ? [first, second] : [first];
    const workbook = await buildEcBusinessReport(months);
    const fileName = `the-deerly-business-report-${months.join("-")}.xlsx`;
    const body = workbook.buffer.slice(
      workbook.byteOffset,
      workbook.byteOffset + workbook.byteLength,
    ) as ArrayBuffer;
    return new Response(body, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể xuất báo cáo kinh doanh.",
      },
      { status: 500 },
    );
  }
}
