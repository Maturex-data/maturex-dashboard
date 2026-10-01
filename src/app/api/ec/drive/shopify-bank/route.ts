import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  void request;
  return NextResponse.json(
    {
      error:
        "Shopify được đồng bộ vào RAW sàn; RAW ngân hàng chỉ nhận Airwallex.",
    },
    { status: 410 },
  );
}
