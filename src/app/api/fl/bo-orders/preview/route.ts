import { type NextRequest, NextResponse } from "next/server";
import {
  canImportBoShop,
  getBoSheetDestination,
  getBoShopName,
} from "@/lib/fl/bo-import-config";
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

    if (!canImportBoShop(boId, shopCode)) {
      return NextResponse.json(
        {
          success: false,
          error: "Shop không thuộc phạm vi import của BO đã chọn.",
        },
        { status: 400 },
      );
    }

    const destination = getBoSheetDestination(boId);

    const buffer = Buffer.from(await file.arrayBuffer());
    const csvContent = buffer.toString("utf-8");

    const result = parseAndMapEtsyOrders(csvContent, file.name, file.size, {
      shopCode,
      storeValue: getBoShopName(shopCode),
    });

    if (action === "download") {
      const xlsxBuffer = exportOrdersPreviewToBuffer(result, boId);
      const outputFilename = `${boId}-${shopCode.toLowerCase()}-orders-preview-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
      const importResult = await upsertOrdersToGoogleSheet(
        result.rows,
        destination,
      );
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
