"use server";

import { revalidatePath } from "next/cache";
import { importEtsyFiles } from "@/lib/etsy-import";

export type EtsyImportResponse = Awaited<ReturnType<typeof importEtsyFiles>>;

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

    if (typeof shopCode !== "string" || !shopCode) {
      return {
        success: false,
        error: "Vui lòng chọn shop Etsy.",
      };
    }

    if (files.length === 0) {
      return {
        success: false,
        error: "Vui lòng chọn ít nhất một tệp CSV hoặc ZIP.",
      };
    }

    const result = await importEtsyFiles(shopCode, files);

    // Revalidate dashboard and flowa routes
    revalidatePath("/flowa");
    revalidatePath("/flowa/import");
    revalidatePath("/dashboard");

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
