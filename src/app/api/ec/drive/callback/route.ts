import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleCallbackUrl, saveGoogleConnection } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

const OAUTH_STATE_COOKIE = "mx_ec_drive_oauth_state";

async function completeCallback(url: URL): Promise<{
  error: string | null;
  status: number;
}> {
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (
    error ||
    !code ||
    !user ||
    user.role !== "admin" ||
    (expectedState && state && state !== expectedState)
  ) {
    return {
      error: error || "Google OAuth could not be verified.",
      status: 400,
    };
  }

  try {
    await saveGoogleConnection(code, user.sub);
  } catch (oauthError) {
    return {
      error:
        oauthError instanceof Error
          ? oauthError.message
          : "Google Drive connection failed.",
      status: 500,
    };
  }

  return { error: null, status: 200 };
}

export async function GET(request: Request) {
  const redirectUrl = new URL("/ec-drive-sync", request.url);
  const result = await completeCallback(new URL(request.url));
  if (result.error) redirectUrl.searchParams.set("drive_error", result.error);
  else redirectUrl.searchParams.set("drive_connected", "1");
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}

export async function POST(request: Request) {
  const payload = (await request.json()) as { callbackUrl?: string };
  let callbackUrl: URL;
  try {
    callbackUrl = new URL(payload.callbackUrl || "");
  } catch {
    return NextResponse.json(
      { error: "URL callback không hợp lệ." },
      { status: 400 },
    );
  }

  const expected = googleCallbackUrl();
  if (
    callbackUrl.origin !== expected.origin ||
    callbackUrl.pathname !== expected.pathname
  ) {
    return NextResponse.json(
      { error: "URL callback không khớp cấu hình Google OAuth." },
      { status: 400 },
    );
  }

  const result = await completeCallback(callbackUrl);
  const response = NextResponse.json(
    result.error ? { error: result.error } : { connected: true },
    { status: result.status },
  );
  response.cookies.delete(OAUTH_STATE_COOKIE);
  return response;
}
