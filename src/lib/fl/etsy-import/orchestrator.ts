import { prisma } from "@/lib/prisma";
import {
  detectShopFromPath,
  ETSY_SHOPS,
  isCogsFileName,
} from "../etsy-constants";
import { importSource } from "./importers";
import { parseFile } from "./parser";
import { reconcileOrderItems } from "./reconcile";
import { type EtsyImportResult, MAX_FILES } from "./types";

export async function importEtsyFiles(
  shopCode: string,
  files: (File | { file: File; relativePath?: string })[],
) {
  if (files.length === 0) throw new Error("Chưa chọn file để import.");
  if (files.length > MAX_FILES)
    throw new Error(`Mỗi lần chỉ import tối đa ${MAX_FILES} file.`);

  // Pre-load all shops
  const allShops = await prisma.etsyShop.findMany();
  const shopMap = new Map(allShops.map((s) => [s.code.toUpperCase(), s]));

  const results: EtsyImportResult[] = [];

  for (const item of files) {
    const file = item instanceof File ? item : item.file;
    const relPath =
      item instanceof File
        ? item.webkitRelativePath || item.name
        : item.relativePath || file.name;

    let targetShopCode = shopCode;
    try {
      if (isCogsFileName(relPath) || isCogsFileName(file.name)) {
        targetShopCode = "97DECOR";
      } else if (!targetShopCode || targetShopCode === "AUTO") {
        const detected =
          detectShopFromPath(relPath) || detectShopFromPath(file.name);
        if (!detected) {
          throw new Error(
            `Không thể xác định shop từ đường dẫn file: "${relPath}". Vui lòng chọn shop cụ thể.`,
          );
        }
        targetShopCode = detected;
      }

      let shop = shopMap.get(targetShopCode.toUpperCase());
      if (!shop) {
        // Fallback or create if valid
        const def = ETSY_SHOPS.find((s) => s.code === targetShopCode);
        if (def) {
          shop = await prisma.etsyShop.upsert({
            where: { code: def.code },
            create: { code: def.code, name: def.name },
            update: {},
          });
          shopMap.set(shop.code.toUpperCase(), shop);
        } else {
          throw new Error(`Shop "${targetShopCode}" không hợp lệ.`);
        }
      }

      const source = await parseFile(file);
      const res = await importSource(source, shop.id);
      results.push({
        ...res,
        relativePath: relPath,
        shopCode: targetShopCode,
      });
    } catch (error) {
      results.push({
        fileName: file.name,
        relativePath: relPath,
        shopCode: targetShopCode,
        reportType: "UNKNOWN",
        sourceMonth: null,
        status: "FAILED",
        totalRows: 0,
        insertedRows: 0,
        skippedRows: 0,
        message:
          error instanceof Error ? error.message : "Không thể nhập file.",
      });
    }
  }

  await reconcileOrderItems();

  return {
    results,
    summary: {
      files: results.length,
      completed: results.filter((result) => result.status === "COMPLETED")
        .length,
      skipped: results.filter((result) => result.status === "SKIPPED").length,
      failed: results.filter((result) => result.status === "FAILED").length,
      insertedRows: results.reduce(
        (sum, result) => sum + result.insertedRows,
        0,
      ),
    },
  };
}
