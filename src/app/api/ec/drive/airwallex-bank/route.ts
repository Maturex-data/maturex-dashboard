import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { syncAirwallexBankToSheet } from "@/lib/airwallex-bank-sheet-sync";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }
  let selection: unknown;
  try {
    ({ selection } = (await request.json()) as { selection?: unknown });
  } catch {
    return NextResponse.json(
      { error: "Request body không hợp lệ." },
      { status: 400 },
    );
  }
  if (
    typeof selection !== "string" ||
    (selection !== "all" && !/^\d{4}-(0[1-9]|1[0-2])$/.test(selection))
  ) {
    return NextResponse.json(
      { error: "Phạm vi đồng bộ không hợp lệ." },
      { status: 400 },
    );
  }
  try {
    const result = await syncAirwallexBankToSheet(selection);
    return NextResponse.json({ success: true, selection, ...result });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Không thể đồng bộ Airwallex.",
      },
      { status: 500 },
    );
  }
}
