import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { saveGoogleConnection } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

const OAUTH_STATE_COOKIE = "mx_ec_drive_oauth_state";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  const redirectUrl = new URL("/ec-drive-sync", request.url);

  if (
    error ||
    !code ||
    !state ||
    state !== expectedState ||
    !user ||
    user.role !== "admin"
  ) {
    redirectUrl.searchParams.set(
      "drive_error",
      error || "Google OAuth could not be verified.",
    );
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete(OAUTH_STATE_COOKIE);
    return response;
  }

  try {
    await saveGoogleConnection(code, user.sub);
    redirectUrl.searchParams.set("drive_connected", "1");
  } catch (oauthError) {
    redirectUrl.searchParams.set(
      "drive_error",
      oauthError instanceof Error
        ? oauthError.message
        : "Google Drive connection failed.",
    );
  }
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
