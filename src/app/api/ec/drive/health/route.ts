import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  getGoogleDriveAccess,
  getGoogleDriveConnection,
  REPORT_SPREADSHEET_ID,
} from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

type HealthState =
  | "disconnected"
  | "connected"
  | "reauthorization_required"
  | "account_mismatch"
  | "target_unavailable"
  | "unavailable";

function isReauthorizationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid_grant|needs to be reconnected/i.test(message);
}

async function probeDrive(accessToken: string): Promise<Response> {
  return fetch("https://www.googleapis.com/drive/v3/about?fields=user", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

async function probeTargetSpreadsheet(accessToken: string): Promise<Response> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}`,
  );
  url.searchParams.set("fields", "spreadsheetId,properties.title");
  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = sessionToken ? await verifyAccessToken(sessionToken) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const connection = await getGoogleDriveConnection();
  if (!connection) {
    return NextResponse.json({ state: "disconnected" satisfies HealthState });
  }

  try {
    let { accessToken } = await getGoogleDriveAccess();
    let response = await probeDrive(accessToken);
    if (response.status === 401) {
      ({ accessToken } = await getGoogleDriveAccess({ forceRefresh: true }));
      response = await probeDrive(accessToken);
    }

    if (response.status === 401) {
      return NextResponse.json({
        state: "reauthorization_required" satisfies HealthState,
      });
    }
    if (response.status === 403) {
      return NextResponse.json({
        state: "reauthorization_required" satisfies HealthState,
      });
    }
    if (!response.ok) {
      return NextResponse.json({ state: "unavailable" satisfies HealthState });
    }

    const payload = (await response.json()) as {
      user?: { emailAddress?: string };
    };
    const accountEmail = payload.user?.emailAddress ?? null;
    if (
      accountEmail &&
      connection.email &&
      accountEmail.toLowerCase() !== connection.email.toLowerCase()
    ) {
      return NextResponse.json({
        state: "account_mismatch" satisfies HealthState,
        accountEmail,
      });
    }

    const targetResponse = await probeTargetSpreadsheet(accessToken);
    if (targetResponse.status === 401) {
      return NextResponse.json({
        state: "reauthorization_required" satisfies HealthState,
      });
    }
    if (targetResponse.status === 403 || targetResponse.status === 404) {
      return NextResponse.json({
        state: "target_unavailable" satisfies HealthState,
      });
    }
    if (!targetResponse.ok) {
      return NextResponse.json({ state: "unavailable" satisfies HealthState });
    }

    const permissionsResponse = await fetch(
      `https://www.googleapis.com/drive/v3/files/${REPORT_SPREADSHEET_ID}?fields=capabilities(canEdit,canModifyContent)`,
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
      },
    );
    if (!permissionsResponse.ok)
      return NextResponse.json({
        state: "target_unavailable" satisfies HealthState,
      });
    const permissions = (await permissionsResponse.json()) as {
      capabilities?: { canEdit?: boolean; canModifyContent?: boolean };
    };
    if (
      permissions.capabilities?.canEdit !== true ||
      permissions.capabilities?.canModifyContent !== true
    )
      return NextResponse.json({
        state: "target_unavailable" satisfies HealthState,
      });

    return NextResponse.json({
      state: "connected" satisfies HealthState,
      accountEmail,
    });
  } catch (error) {
    return NextResponse.json({
      state: isReauthorizationError(error)
        ? ("reauthorization_required" satisfies HealthState)
        : ("unavailable" satisfies HealthState),
    });
  }
}
