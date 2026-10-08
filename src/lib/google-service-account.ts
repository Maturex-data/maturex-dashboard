import crypto from "node:crypto";

interface ServiceAccountCredentials {
  type: string;
  client_email: string;
  private_key: string;
}
let cached: { accessToken: string; expiresAt: number } | undefined;
let pending: Promise<string> | undefined;

export function serviceAccountEnabled(): boolean {
  return process.env.GOOGLE_AUTH_MODE === "service_account";
}

export function getServiceAccountEmail(): string {
  return credentials().client_email;
}

function credentials(): ServiceAccountCredentials {
  const value = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!value) throw new Error("Chưa cấu hình GOOGLE_SERVICE_ACCOUNT_JSON.");
  let parsed: ServiceAccountCredentials;
  try {
    parsed = JSON.parse(value) as ServiceAccountCredentials;
  } catch {
    throw new Error("GOOGLE_SERVICE_ACCOUNT_JSON không phải JSON hợp lệ.");
  }
  if (
    parsed.type !== "service_account" ||
    !parsed.client_email ||
    !parsed.private_key
  )
    throw new Error("Credential Service Account thiếu thông tin bắt buộc.");
  return parsed;
}

async function issueAccessToken(): Promise<string> {
  const credential = credentials();
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString("base64url");
  const unsigned = `${encode({ alg: "RS256", typ: "JWT" })}.${encode({
    iss: credential.client_email,
    scope:
      "https://www.googleapis.com/auth/drive https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = crypto
    .sign("RSA-SHA256", Buffer.from(unsigned), credential.private_key)
    .toString("base64url");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
  };
  if (!response.ok || !payload.access_token)
    throw new Error(
      `Không thể xác thực Service Account (${response.status}, ${payload.error ?? "unknown"}).`,
    );
  cached = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };
  return cached.accessToken;
}

export async function getServiceAccountAccessToken(
  forceRefresh = false,
): Promise<string> {
  if (!forceRefresh && cached && cached.expiresAt > Date.now() + 300_000)
    return cached.accessToken;
  if (!pending)
    pending = issueAccessToken().finally(() => {
      pending = undefined;
    });
  return pending;
}
