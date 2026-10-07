import { type NextRequest, NextResponse } from "next/server";
import {
  canImportBoShop,
  getBoSheetDestination,
} from "@/lib/fl/bo-import-config";
import { parseAndMapEtsyStatement } from "@/lib/fl/statement-parser/statement-mapper";
import { exportStatementPreviewToBuffer } from "@/lib/fl/statement-parser/xlsx-exporter";

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

    const result = parseAndMapEtsyStatement(csvContent, file.name, file.size, {
      shopCode,
      storeValue: shopCode === "TIMOND" ? "Timond" : "97Decor",
    });

    if (action === "download") {
      const xlsxBuffer = exportStatementPreviewToBuffer(result, boId);
      const outputFilename = `${boId === "mr-nam" ? "nam" : "linh"}-${shopCode.toLowerCase()}-statement-preview-${new Date().toISOString().slice(0, 10)}.xlsx`;

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
      const { replaceStatementMonthInGoogleSheet } = await import(
        "@/lib/fl/statement-parser/statement-sheet-writer"
      );
      const importResult = await replaceStatementMonthInGoogleSheet(
        result.rows,
        result.summary.verifiedMonth,
        destination,
      );
      return NextResponse.json({
        success: true,
        summary: result.summary,
        importResult: {
          ...importResult,
          insertedCount: importResult.newCount,
          updatedCount: importResult.replacedCount,
        },
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
            : "Không thể xử lý file Statement.",
      },
      { status: 400 },
    );
  }
}
