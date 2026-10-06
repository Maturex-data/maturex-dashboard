import { type NextRequest, NextResponse } from "next/server";
import { isLinhShop } from "@/lib/fl/bo-import-config";
import {
  importCogs,
  makePreviewToken,
  prepareCogs,
} from "@/lib/fl/cogs-parser/import-service";
import { exportCogsPreviewToBuffer } from "@/lib/fl/cogs-parser/xlsx-exporter";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const user = await verifyAccessToken(
      req.cookies.get(ACCESS_COOKIE_NAME)?.value || "",
    );
    if (!user || user.role !== "admin")
      return NextResponse.json(
        { success: false, error: "Cần đăng nhập hợp lệ." },
        { status: 401 },
      );
    const formData = await req.formData();
    const file = formData.get("file");
    const shopCode = (formData.get("shopCode") as string) || "97DECOR";
    const boId = (formData.get("boId") as string) || "ms-linh";
    const action = (formData.get("action") as string) || "validate";

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          success: false,
          error: "Vui lòng chọn file Excel COGS-Equarus (.xlsx) hợp lệ.",
        },
        { status: 400 },
      );
    }

    if (boId !== "ms-linh" || (shopCode !== "ALL" && !isLinhShop(shopCode))) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Tính năng COGS Equarus hiện chỉ áp dụng cho BO Ms. Linh (97Decor và Timond).",
        },
        { status: 400 },
      );
    }

    if (
      !file.name.toLowerCase().endsWith(".xlsx") ||
      file.size > 20 * 1024 * 1024
    )
      throw new Error("Chỉ nhận XLSX tối đa 20 MB.");
    if (!["validate", "download", "import"].includes(action))
      throw new Error("Thao tác không hợp lệ.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (action === "import") {
      const approved: unknown = JSON.parse(
        String(formData.get("approvedKeys") || "[]"),
      );
      if (
        !Array.isArray(approved) ||
        !approved.every((k) => typeof k === "string")
      )
        throw new Error("Danh sách duyệt không hợp lệ.");
      const importResult = await importCogs(
        buffer,
        file.name,
        String(formData.get("previewToken") || ""),
        approved,
      );
      return NextResponse.json({ success: true, importResult });
    }
    const prepared = await prepareCogs(buffer, file.name);
    const result = prepared.mapped;
    const decisions = prepared.plan.decisions;
    const summary = {
      ...result.summary,
      alreadyInCogsCount: decisions.filter(
        (d) => d.kind === "CHANGED" || d.kind === "UNCHANGED",
      ).length,
      identicalCostCount: decisions.filter((d) => d.kind === "UNCHANGED")
        .length,
      diffCostCount: decisions.filter((d) => d.kind === "CHANGED").length,
      newCount: decisions.filter((d) => d.kind === "NEW").length,
      unchangedCount: decisions.filter((d) => d.kind === "UNCHANGED").length,
      changedCount: decisions.filter((d) => d.kind === "CHANGED").length,
      conflictCount:
        decisions.filter((d) => d.kind === "CONFLICT").length +
        result.summary.conflictCount,
      duplicateCount: prepared.plan.duplicateCount,
      blocked: prepared.blocked > 0,
      decisions,
      previewToken: makePreviewToken(prepared.snapshot, buffer),
    };

    result.summary.alreadyInCogsCount = summary.alreadyInCogsCount;
    result.summary.identicalCostCount = summary.identicalCostCount;
    result.summary.diffCostCount = summary.diffCostCount;
    if (action === "download") {
      const xlsxBuffer = exportCogsPreviewToBuffer(result, prepared.plan);
      const outputFilename = `linh-cogs-preview-${new Date().toISOString().slice(0, 10)}.xlsx`;

      return new NextResponse(new Uint8Array(xlsxBuffer), {
        status: 200,
        headers: {
          "Content-Type":
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "Content-Disposition": `attachment; filename="${outputFilename}"`,
        },
      });
    }

    // Default: validate action
    return NextResponse.json({
      success: true,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Không thể xử lý file COGS Equarus.",
      },
      { status: 400 },
    );
  }
}
