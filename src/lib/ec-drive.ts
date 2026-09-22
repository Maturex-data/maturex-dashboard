import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive openid email";
const PROVIDER = "GOOGLE_DRIVE";
const ROOT_FOLDER_NAME = "MatureX - EC Raw Data";

type StoredGoogleToken = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
};

function config(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} must be configured.`);
  return value;
}

function encryptionKey(): Buffer {
  const key = Buffer.from(
    config("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY"),
    "base64url",
  );
  if (key.length !== 32)
    throw new Error("GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY must be 32 bytes.");
  return key;
}

export function encryptGoogleToken(token: StoredGoogleToken): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(token), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}

function decryptGoogleToken(value: string): StoredGoogleToken {
  const buffer = Buffer.from(value, "base64url");
  const iv = buffer.subarray(0, 12);
  const authTag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return JSON.parse(
    Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
      "utf8",
    ),
  );
}

export function googleAuthorizationUrl(state: string): string {
  const redirectUri = googleCallbackUrl();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", config("GOOGLE_DRIVE_CLIENT_ID"));
  url.searchParams.set("redirect_uri", redirectUri.toString());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", DRIVE_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export function googleCallbackUrl(): URL {
  return new URL(config("GOOGLE_DRIVE_REDIRECT_URI"));
}

export async function exchangeGoogleCode(
  code: string,
): Promise<StoredGoogleToken> {
  const body = new URLSearchParams({
    code,
    client_id: config("GOOGLE_DRIVE_CLIENT_ID"),
    client_secret: config("GOOGLE_DRIVE_CLIENT_SECRET"),
    redirect_uri: config("GOOGLE_DRIVE_REDIRECT_URI"),
    grant_type: "authorization_code",
  });
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const payload = (await response.json()) as StoredGoogleToken & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        "Google token exchange failed.",
    );
  }
  return payload;
}

async function getGoogleEmail(accessToken: string): Promise<string | null> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v3/userinfo",
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!response.ok) return null;
  const payload = (await response.json()) as { email?: string };
  return payload.email ?? null;
}

async function driveRequest(
  accessToken: string,
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(input, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...init?.headers },
  });
  if (!response.ok)
    throw new Error(
      `Google Drive API failed (${response.status}): ${(await response.text()).slice(0, 500)}`,
    );
  return response;
}

async function ensureRootFolder(accessToken: string): Promise<string> {
  const lookup = new URL("https://www.googleapis.com/drive/v3/files");
  lookup.searchParams.set(
    "q",
    `name = '${ROOT_FOLDER_NAME}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  lookup.searchParams.set("fields", "files(id,name)");
  const found = (await (await driveRequest(accessToken, lookup)).json()) as {
    files?: Array<{ id: string }>;
  };
  if (found.files?.[0]?.id) return found.files[0].id;
  const created = await driveRequest(
    accessToken,
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: ROOT_FOLDER_NAME,
        mimeType: "application/vnd.google-apps.folder",
      }),
    },
  );
  return ((await created.json()) as { id: string }).id;
}

async function refreshGoogleAccessToken(token: StoredGoogleToken): Promise<{
  accessToken: string;
  expiresIn?: number;
  updatedToken: StoredGoogleToken;
}> {
  if (!token.refresh_token)
    throw new Error("Google Drive needs to be reconnected.");
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config("GOOGLE_DRIVE_CLIENT_ID"),
      client_secret: config("GOOGLE_DRIVE_CLIENT_SECRET"),
      refresh_token: token.refresh_token,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as StoredGoogleToken & {
    error?: string;
    error_description?: string;
  };
  if (!response.ok || !payload.access_token) {
    throw new Error(
      payload.error_description ||
        payload.error ||
        "Google Drive token refresh failed.",
    );
  }
  const updatedToken: StoredGoogleToken = {
    ...token,
    access_token: payload.access_token,
    expires_in: payload.expires_in,
    scope: payload.scope || token.scope,
    token_type: payload.token_type || token.token_type,
  };
  return {
    accessToken: payload.access_token,
    expiresIn: payload.expires_in,
    updatedToken,
  };
}

export async function getGoogleDriveAccess(options?: {
  forceRefresh?: boolean;
}): Promise<{
  accessToken: string;
  rootFolderId: string;
}> {
  const connection = await prisma.ecDriveConnection.findUnique({
    where: { provider: PROVIDER },
  });
  if (!connection?.rootFolderId)
    throw new Error("Google Drive is not connected.");

  const token = decryptGoogleToken(connection.encryptedToken);

  // Use cached access token if it has at least 5 minutes before expiration
  const safetyBufferMs = 5 * 60 * 1000;
  const isStillValid =
    !options?.forceRefresh &&
    token.access_token &&
    connection.tokenExpiresAt &&
    connection.tokenExpiresAt.getTime() - Date.now() > safetyBufferMs;

  if (isStillValid) {
    return {
      accessToken: token.access_token,
      rootFolderId: connection.rootFolderId,
    };
  }

  const { accessToken, expiresIn, updatedToken } =
    await refreshGoogleAccessToken(token);
  const tokenExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000)
    : null;

  await prisma.ecDriveConnection.update({
    where: { provider: PROVIDER },
    data: {
      encryptedToken: encryptGoogleToken(updatedToken),
      tokenExpiresAt,
    },
  });

  return {
    accessToken,
    rootFolderId: connection.rootFolderId,
  };
}

export async function ensureGoogleDriveFolder(
  accessToken: string,
  name: string,
  parentId: string,
): Promise<string> {
  const lookup = new URL("https://www.googleapis.com/drive/v3/files");
  lookup.searchParams.set(
    "q",
    `name = '${name.replaceAll("'", "\\'")}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  lookup.searchParams.set("fields", "files(id)");
  const found = (await (await driveRequest(accessToken, lookup)).json()) as {
    files?: Array<{ id: string }>;
  };
  if (found.files?.[0]?.id) return found.files[0].id;
  const response = await driveRequest(
    accessToken,
    "https://www.googleapis.com/drive/v3/files",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        parents: [parentId],
        mimeType: "application/vnd.google-apps.folder",
      }),
    },
  );
  return ((await response.json()) as { id: string }).id;
}

export async function uploadGoogleDriveFile(
  accessToken: string,
  parentId: string,
  name: string,
  content: Uint8Array,
): Promise<{ id: string; url: string }> {
  const boundary = `maturex-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({
    name,
    parents: [parentId],
    mimeType:
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const binary = Uint8Array.from(content).buffer;
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n`,
    binary,
    `\r\n--${boundary}--`,
  ]);
  const response = await driveRequest(
    accessToken,
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
    {
      method: "POST",
      headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
      body,
    },
  );
  const file = (await response.json()) as { id: string; webViewLink?: string };
  return {
    id: file.id,
    url: file.webViewLink || `https://drive.google.com/open?id=${file.id}`,
  };
}

export async function saveGoogleConnection(
  code: string,
  connectedByUserId: string,
): Promise<void> {
  const token = await exchangeGoogleCode(code);
  const email = await getGoogleEmail(token.access_token);
  const rootFolderId = await ensureRootFolder(token.access_token);
  await prisma.ecDriveConnection.upsert({
    where: { provider: PROVIDER },
    create: {
      provider: PROVIDER,
      email,
      encryptedToken: encryptGoogleToken(token),
      rootFolderId,
      rootFolderName: ROOT_FOLDER_NAME,
      scope: token.scope,
      tokenExpiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      connectedByUserId,
    },
    update: {
      email,
      encryptedToken: encryptGoogleToken(token),
      rootFolderId,
      rootFolderName: ROOT_FOLDER_NAME,
      scope: token.scope,
      tokenExpiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : null,
      connectedByUserId,
      connectedAt: new Date(),
    },
  });
}

export const REPORT_SPREADSHEET_ID =
  process.env.EC_REPORT_SPREADSHEET_ID ||
  "19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8";

export async function getGoogleDriveFileName(
  fileId = REPORT_SPREADSHEET_ID,
): Promise<string | null> {
  try {
    const { accessToken } = await getGoogleDriveAccess();
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
    url.searchParams.set("fields", "id,name");
    const response = await driveRequest(accessToken, url);
    const data = (await response.json()) as { name?: string };
    return data.name || null;
  } catch {
    return null;
  }
}

export async function getGoogleDriveConnection() {
  return prisma.ecDriveConnection.findUnique({
    where: { provider: PROVIDER },
    select: {
      email: true,
      rootFolderId: true,
      rootFolderName: true,
      scope: true,
      tokenExpiresAt: true,
      connectedAt: true,
      updatedAt: true,
    },
  });
}

export async function disconnectGoogleDrive(): Promise<void> {
  const connection = await prisma.ecDriveConnection.findUnique({
    where: { provider: PROVIDER },
  });
  if (connection) {
    const token = decryptGoogleToken(connection.encryptedToken);
    if (token.refresh_token) {
      await fetch("https://oauth2.googleapis.com/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ token: token.refresh_token }),
      }).catch(() => undefined);
    }
  }
  await prisma.ecDriveConnection.deleteMany({ where: { provider: PROVIDER } });
}
