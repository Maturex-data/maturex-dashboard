import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { FLOWA_REPORT_SPREADSHEET_ID, record, text } from "./types";

export async function getFlowaDriveFileName(
  fileId = FLOWA_REPORT_SPREADSHEET_ID,
): Promise<string | null> {
  try {
    const { accessToken } = await getGoogleDriveAccess();
    const url = new URL(`https://www.googleapis.com/drive/v3/files/${fileId}`);
    url.searchParams.set("fields", "id,name");
    const response = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await response.json()) as { name?: string };
    return data.name || null;
  } catch {
    return null;
  }
}

export async function flowaSheetsRequest(
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${FLOWA_REPORT_SPREADSHEET_ID}${path}`,
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
