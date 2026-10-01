"use server";

import { revalidatePath } from "next/cache";
import {
  type FastwaySyncOptions,
  syncFastwayOrdersToCogs,
} from "@/lib/fastway-sync";
import { isPocdyPath } from "@/lib/fl/etsy-constants";
import { importFilesToFlowaSheet } from "@/lib/flowa-sheet-import";

export type EtsyImportResponse = Awaited<
  ReturnType<typeof importFilesToFlowaSheet>
>;

export interface EtsyActionResult {
  success: boolean;
  error?: string;
  data?: EtsyImportResponse;
}

export async function importEtsyAction(
  formData: FormData,
): Promise<EtsyActionResult> {
  try {
    const shopCode = formData.get("shopCode");
    const files = formData
      .getAll("files")
      .filter((value): value is File => value instanceof File);

    const relativePathsJson = formData.get("relativePaths");
    const relativePaths: string[] =
      typeof relativePathsJson === "string"
        ? JSON.parse(relativePathsJson)
        : [];

    if (typeof shopCode !== "string" || !shopCode) {
      return {
        success: false,
        error: "Vui lòng chọn shop Etsy hoặc chọn Tự động nhận diện.",
      };
    }

    if (isPocdyPath(shopCode)) {
      return {
        success: false,
        error:
          'Shop "Pocdy" (POCDY) không còn được hỗ trợ. Không thể nhập dữ liệu.',
      };
    }

    if (files.length === 0) {
      return {
        success: false,
        error: "Vui lòng chọn ít nhất một tệp CSV hoặc thư mục.",
      };
    }

    for (let idx = 0; idx < files.length; idx++) {
      const file = files[idx];
      const relPath =
        relativePaths[idx] || file.webkitRelativePath || file.name;
      if (isPocdyPath(relPath) || isPocdyPath(file.name)) {
        return {
          success: false,
          error: `Tệp "${file.name}" thuộc shop "Pocdy" (POCDY) không còn được hỗ trợ. Không thể nhập dữ liệu.`,
        };
      }
    }

    const items = files.map((file, idx) => ({
      file,
      relativePath: relativePaths[idx] || file.webkitRelativePath || file.name,
    }));

    const result = await importFilesToFlowaSheet(shopCode, items);

    // Import writes directly to the Flowa source sheets, not Prisma.
    revalidatePath("/ecombius/import");
    revalidatePath("/ecombius/drive-sync");

    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "Etsy import thất bại.";
    return {
      success: false,
      error: message,
    };
  }
}

export async function syncFastwayAction(options?: FastwaySyncOptions): Promise<{
  success: boolean;
  error?: string;
  data?: { totalFetched: number; upserted: number };
}> {
  try {
    const result = await syncFastwayOrdersToCogs(options);
    revalidatePath("/ecombius");
    revalidatePath("/ecombius/import");
    revalidatePath("/ecombius/drive-sync");
    return {
      success: true,
      data: result,
    };
  } catch (error: unknown) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Đồng bộ Fastway thất bại.",
    };
  }
}
