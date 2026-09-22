import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import {
  clearFlowaSheet,
  type FlowaReportSheet,
  isFlowaReportSheet,
} from "@/lib/fl-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const payload = (await request.json()) as { sources?: string[] };
  const sheets = [
    ...new Set(payload.sources?.filter(isFlowaReportSheet) ?? []),
  ] as FlowaReportSheet[];

  if (!sheets.length) {
    return NextResponse.json(
      { error: "At least one sheet must be selected to clear." },
      { status: 400 },
    );
  }

  try {
    const { accessToken } = await getGoogleDriveAccess();
    const results: Record<string, { cleared: number }> = {};

    for (const sheet of sheets) {
      results[sheet] = await clearFlowaSheet(accessToken, sheet);
    }

    return NextResponse.json({ success: true, results });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to clear Flowa sheet.",
      },
      { status: 500 },
    );
  }
}
