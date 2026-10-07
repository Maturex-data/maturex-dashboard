import { type NextRequest, NextResponse } from "next/server";
import { canImportBoShop } from "@/lib/fl/bo-import-config";
import { parseEquarusWorkbook } from "@/lib/fl/cogs-parser/equarus-parser";
import { parseAndMapEtsyItems } from "@/lib/fl/items-parser/items-mapper";
import { parseCsv } from "@/lib/fl/orders-parser/csv-parser";
import { parseAndMapEtsyOrders } from "@/lib/fl/orders-parser/orders-mapper";
import {
  extractMonthFromDateString,
  parseAndMapEtsyStatement,
} from "@/lib/fl/statement-parser/statement-mapper";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";
export async function POST(req: NextRequest) {
  try {
    const user = await verifyAccessToken(
      req.cookies.get(ACCESS_COOKIE_NAME)?.value || "",
    );
    if (!user || user.role !== "admin")
      return NextResponse.json({ error: "Cần đăng nhập." }, { status: 401 });
    const form = await req.formData(),
      file = form.get("file");
    if (!(file instanceof File) || file.size > 20 * 1024 * 1024)
      throw Error("Chỉ nhận file tối đa 20 MB.");
    const boId = String(form.get("boId") || "ms-linh");
    if (boId !== "ms-linh" && boId !== "mr-nam")
      throw Error("BO không hỗ trợ import thư mục.");
    const buffer = Buffer.from(await file.arrayBuffer());
    if (file.name.toLowerCase().endsWith(".xlsx")) {
      const p = parseEquarusWorkbook(buffer);
      return NextResponse.json({
        kind: "cogs",
        shop: "ALL",
        month: "",
        rows: p.orderRows.length,
      });
    }
    if (!file.name.toLowerCase().endsWith(".csv"))
      throw Error("File không hỗ trợ.");
    const text = buffer.toString("utf8"),
      h = parseCsv(text)[0] ?? [];
    const kind =
      h.includes("Transaction ID") && h.includes("Item Name")
        ? "items"
        : h.includes("Order ID") && h.includes("Order Total")
          ? "orders"
          : h.includes("Fees & Taxes") && h.includes("Tax Details")
            ? "statement"
            : null;
    if (!kind) throw Error("Không nhận diện được header file.");
    const path = String(form.get("path") || file.name).toLowerCase();
    const shops = [
      ...(path.includes("97decor") ||
      path.includes("97_decor") ||
      path.includes("97 decor")
        ? ["97DECOR"]
        : []),
      ...(path.includes("timond") ? ["TIMOND"] : []),
    ];
    const override = String(form.get("shop") || "");
    const shop = ["97DECOR", "TIMOND"].includes(override)
      ? override
      : shops.length === 1
        ? shops[0]
        : "";
    if (!shop)
      return NextResponse.json({
        kind,
        shop: "",
        month: "",
        rows: 0,
        needsShop: true,
      });
    if (!canImportBoShop(boId, shop))
      throw Error("Shop không thuộc phạm vi import của BO đã chọn.");
    const options = {
      shopCode: shop,
      storeValue: shop === "TIMOND" ? "Timond" : "97Decor",
    };
    const p =
      kind === "orders"
        ? parseAndMapEtsyOrders(text, file.name, file.size, options)
        : kind === "items"
          ? parseAndMapEtsyItems(text, file.name, file.size, options)
          : parseAndMapEtsyStatement(text, file.name, file.size, options);
    if (p.summary.errorRowsCount > 0 || !p.rows.length)
      return NextResponse.json({
        kind,
        shop,
        error: `File có ${p.summary.errorRowsCount} lỗi hoặc không có dòng hợp lệ; cần sửa trước khi import.`,
      });
    return NextResponse.json({
      kind,
      shop,
      orderIds:
        kind === "orders"
          ? p.rows.map((r) =>
              String((r as Record<string, unknown>)["Order ID"]),
            )
          : [],
      month:
        "verifiedMonth" in p.summary
          ? (p.summary.verifiedMonth ?? "")
          : (extractMonthFromDateString(
              parseCsv(text)[1]?.[h.indexOf("Sale Date")] ?? "",
            ) ?? ""),
      rows: p.rows.length,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Không phân tích được file." },
      { status: 400 },
    );
  }
}
