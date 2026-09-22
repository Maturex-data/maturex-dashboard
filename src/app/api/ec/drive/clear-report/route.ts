import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/jwt-service";

const REPORT_SPREADSHEET_ID =
  process.env.EC_REPORT_SPREADSHEET_ID ||
  "19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8";

const REPORT_SHEETS = {
  Orders: "L",
  COGS: "K",
  Ads: "K",
  Payouts: "P",
} as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" || typeof value === "number"
    ? String(value)
    : "";
}

async function sheetsRequest(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        ...init?.headers,
      },
    },
  );
  if (!response.ok) {
    const payload = record(await response.json());
    throw new Error(
      `Google Sheets API ${response.status}: ${text(record(payload.error).message) || "Request failed."}`,
    );
  }
  return response;
}

async function clearSheet(
  accessToken: string,
  sheet: keyof typeof REPORT_SHEETS,
): Promise<{ cleared: number; formulas: number }> {
  const lastColumn = REPORT_SHEETS[sheet];
  const range = `${sheet}!A2:${lastColumn}`;
  const response = await sheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
  );
  const payload = record(await response.json());
  const rows = Array.isArray(payload.values)
    ? payload.values.filter(Array.isArray)
    : [];
  let cleared = 0;
  let formulas = 0;
  const values = rows.map((row) =>
    row.map((value) => {
      if (typeof value === "string" && value.startsWith("=")) {
        formulas += 1;
        return value;
      }
      if (value !== "") cleared += 1;
      return "";
    }),
  );

  if (!values.length) return { cleared, formulas };

  const chunkSize = 1_000;
  for (let offset = 0; offset < values.length; offset += chunkSize) {
    await sheetsRequest(accessToken, "/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${sheet}!A${offset + 2}`,
            majorDimension: "ROWS",
            values: values.slice(offset, offset + chunkSize),
          },
        ],
      }),
    });
  }
  return { cleared, formulas };
}

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ACCESS_COOKIE_NAME)?.value;
  const user = token ? await verifyAccessToken(token) : null;
  if (!user || user.role !== "admin") {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  try {
    const { accessToken } = await getGoogleDriveAccess();
    const results = await Promise.all(
      (Object.keys(REPORT_SHEETS) as (keyof typeof REPORT_SHEETS)[]).map(
        async (sheet) => ({ sheet, ...(await clearSheet(accessToken, sheet)) }),
      ),
    );
    const cleared = results.reduce(
      (total, result) => total + result.cleared,
      0,
    );
    const formulas = results.reduce(
      (total, result) => total + result.formulas,
      0,
    );
    return NextResponse.json({ cleared, formulas });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not clear report sheets.",
      },
      { status: 500 },
    );
  }
}
