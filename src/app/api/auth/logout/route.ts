import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ACCESS_COOKIE_NAME } from "@/lib/jwt-service";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_COOKIE_NAME);
  return NextResponse.json({ success: true }, { status: 200 });
}
