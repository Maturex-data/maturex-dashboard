import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleAuthorizationUrl } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

const OAUTH_STATE_COOKIE = "mx_ec_drive_oauth_state";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const state = crypto.randomUUID();
  const response = NextResponse.redirect(googleAuthorizationUrl(state));
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}
