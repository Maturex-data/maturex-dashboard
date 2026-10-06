import { type NextRequest, NextResponse } from "next/server";
import { isLinhShop } from "@/lib/fl/bo-import-config";
import { parseAndMapEtsyOrders } from "@/lib/fl/orders-parser/orders-mapper";
import { exportOrdersPreviewToBuffer } from "@/lib/fl/orders-parser/xlsx-exporter";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file");
    const shopCode = (formData.get("shopCode") as string) || "97DECOR";
    const boId = (formData.get("boId") as string) || "ms-linh";
    const action = (formData.get("action") as string) || "validate";

    if (!(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Vui lòng chọn một file CSV hợp lệ." },
        { status: 400 },
      );
    }

    if (boId !== "ms-linh" || !isLinhShop(shopCode)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tính năng preview Orders hiện chỉ áp dụng cho BO Ms. Linh (97Decor và Timond).",
        },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const csvContent = buffer.toString("utf-8");

    const result = parseAndMapEtsyOrders(csvContent, file.name, file.size, {
      shopCode,
      storeValue: shopCode === "TIMOND" ? "Timond" : "97Decor",
    });

    if (action === "download") {
      const xlsxBuffer = exportOrdersPreviewToBuffer(result);
      const outputFilename = `linh-${shopCode.toLowerCase()}-orders-preview-${new Date().toISOString().slice(0, 10)}.xlsx`;

      return new NextResponse(new Uint8Array(xlsxBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${outputFilename}"`,
        },
      });
    }

    if (action === "import") {
      const { upsertOrdersToGoogleSheet } = await import(
        "@/lib/fl/orders-parser/orders-sheet-writer"
      );
      const importResult = await upsertOrdersToGoogleSheet(result.rows);
      return NextResponse.json({
        success: true,
        summary: result.summary,
        importResult,
      });
    }

    // Default: validate action
    return NextResponse.json({
      success: true,
      summary: result.summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể xử lý file Orders.",
      },
      { status: 400 },
    );
  }
}
