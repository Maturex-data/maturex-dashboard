"use server";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import {
  type FastwaySyncOptions,
  syncFastwayOrdersToCogs,
} from "@/lib/fastway-sync";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export async function syncFastwayAction(options?: FastwaySyncOptions): Promise<{
  success: boolean;
  error?: string;
  data?: {
    totalFetched: number;
    upserted: number;
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    missingStoreCount: number;
  };
}> {
  try {
    const cookieStore = await cookies();
    const user = await verifyAccessToken(
      cookieStore.get(ACCESS_COOKIE_NAME)?.value || "",
    );
    if (!user || user.role !== "admin")
      throw new Error("Cần đăng nhập hợp lệ để đồng bộ Fastway.");
    if (options?.fromDate || options?.toDate) {
      if (!options.fromDate || !options.toDate)
        throw new Error("Cần đủ ngày bắt đầu và kết thúc.");
      const from = new Date(options.fromDate).getTime();
      const to = new Date(options.toDate).getTime();
      if (!Number.isFinite(from) || !Number.isFinite(to) || from > to)
        throw new Error("Khoảng ngày Fastway không hợp lệ.");
    }
    const result = await syncFastwayOrdersToCogs(options);
    revalidatePath("/ecombius");
    revalidatePath("/ecombius/bo-import");
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
