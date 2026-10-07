"use server";
import { cookies } from "next/headers";
import { syncPhucPrintify } from "@/lib/fl/printify/sheet-sync";
import type {
  PrintifySyncOptions,
  PrintifySyncResult,
} from "@/lib/fl/printify/types";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";
export async function syncPhucPrintifyAction(
  options?: PrintifySyncOptions,
): Promise<{ success: boolean; error?: string; data?: PrintifySyncResult }> {
  try {
    const cookieStore = await cookies();
    const user = await verifyAccessToken(
      cookieStore.get(ACCESS_COOKIE_NAME)?.value ?? "",
    );
    if (!user || user.role !== "admin")
      throw Error("Cần đăng nhập hợp lệ để đồng bộ.");
    return { success: true, data: await syncPhucPrintify(options) };
  } catch (error) {
    return {
      success: false,
      error:
        error instanceof Error ? error.message : "Đồng bộ Printify thất bại.",
    };
  }
}
