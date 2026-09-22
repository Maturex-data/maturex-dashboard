import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { disconnectGoogleDrive } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin")
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  await disconnectGoogleDrive();
  return NextResponse.json({ success: true });
}
