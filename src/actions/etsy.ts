"use server";

import { revalidatePath } from "next/cache";
import {
  type FastwaySyncOptions,
  syncFastwayOrdersToCogs,
} from "@/lib/fastway-sync";
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

    if (files.length === 0) {
      return {
        success: false,
        error: "Vui lòng chọn ít nhất một tệp CSV hoặc thư mục.",
      };
    }

    const items = files.map((file, idx) => ({
      file,
      relativePath: relativePaths[idx] || file.webkitRelativePath || file.name,
    }));

    const result = await importFilesToFlowaSheet(shopCode, items);

    // Import writes directly to the Flowa source sheets, not Prisma.
    revalidatePath("/flowa/import");
    revalidatePath("/flowa/drive-sync");

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
    revalidatePath("/flowa");
    revalidatePath("/flowa/import");
    revalidatePath("/flowa/drive-sync");
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
