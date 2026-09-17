import { jwtVerify, SignJWT } from "jose";

let cachedSecret: Uint8Array | null = null;

function getJwtSecret(): Uint8Array {
  if (cachedSecret) return cachedSecret;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.warn(
        "[WARN] JWT_SECRET environment variable is not set. Please configure it in production.",
      );
    }
    cachedSecret = new TextEncoder().encode(
      "maturex_dashboard_jwt_secret_key_default_internal_session_key",
    );
    return cachedSecret;
  }
  cachedSecret = new TextEncoder().encode(secret);
  return cachedSecret;
}

export interface AuthUserPayload {
  sub: string; // userId / email
  email: string;
  name: string;
  role: string;
}

export const ACCESS_COOKIE_NAME = "mx_access_token";
export const ACCESS_TOKEN_EXPIRATION =
  process.env.JWT_ACCESS_EXPIRATION || "7d";
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function signAccessToken(
  payload: AuthUserPayload,
): Promise<string> {
  return new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TOKEN_EXPIRATION)
    .sign(getJwtSecret());
}

export async function verifyAccessToken(
  token: string,
): Promise<AuthUserPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (!payload.sub || typeof payload.email !== "string") {
      return null;
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: String(payload.name || "Admin MatureX"),
      role: String(payload.role || "admin"),
    };
  } catch {
    return null;
  }
}

/**
 * Server-side helper to get authenticated user from incoming cookies.
 * Supports passing either an access token string or Next.js cookies() ReadonlyRequestCookies.
 */
export async function getSessionUser(
  cookieStore?: { get: (name: string) => { value: string } | undefined } | null,
): Promise<AuthUserPayload | null> {
  if (!cookieStore) return null;
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}
