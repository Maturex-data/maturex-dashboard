import crypto from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { googleAuthorizationUrl, googleCallbackUrl } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

const OAUTH_STATE_COOKIE = "mx_ec_drive_oauth_state";

async function authorize() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return null;
  }

  const state = crypto.randomUUID();
  const callbackUrl = googleCallbackUrl();
  return {
    state,
    authorizationUrl: googleAuthorizationUrl(state),
    callbackOrigin: callbackUrl.origin,
    callbackPath: callbackUrl.pathname,
  };
}

function setStateCookie(response: NextResponse, state: string): NextResponse {
  response.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  });
  return response;
}

export async function POST() {
  const authorization = await authorize();
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return setStateCookie(
    NextResponse.json({
      authorizationUrl: authorization.authorizationUrl,
      callbackOrigin: authorization.callbackOrigin,
      callbackPath: authorization.callbackPath,
    }),
    authorization.state,
  );
}

export async function GET() {
  const authorization = await authorize();
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return setStateCookie(
    NextResponse.redirect(authorization.authorizationUrl),
    authorization.state,
  );
}
