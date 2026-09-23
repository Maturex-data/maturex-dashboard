import { getGoogleDriveAccess, REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";
import { prisma } from "@/lib/prisma";
import type { SheetName } from "./types";

export interface RawSheetsData {
  spreadsheetId: string;
  sheets: Record<SheetName, { headers: unknown[]; rows: unknown[][] }>;
}

export async function checkActiveEcDriveSync(): Promise<void> {
  const activeSync = await prisma.ecDriveSyncRun.findFirst({
    where: { status: { in: ["RUNNING", "QUEUED"] } },
    select: { id: true, status: true, source: true, startedAt: true },
  });

  if (activeSync) {
    throw new Error(
      `Một tác vụ EC Drive Sync (${activeSync.source}) đang ở trạng thái ${activeSync.status}. Vui lòng đợi tác vụ hoàn thành trước khi import để tránh sai lệch dữ liệu.`,
    );
  }
}

export async function fetchRawSheetsData(
  spreadsheetId = REPORT_SPREADSHEET_ID,
): Promise<RawSheetsData> {
  // 1. Guard against concurrent /ec-drive-sync runs
  await checkActiveEcDriveSync();

  // 2. Obtain OAuth access token
  let { accessToken } = await getGoogleDriveAccess();

  // 3. Batch get the 4 ranges
  const ranges = ["Orders!A:M", "COGS!A:L", "Ads!A:K", "Payouts!A:P"];

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchGet`,
  );
  for (const r of ranges) {
    url.searchParams.append("ranges", r);
  }
  url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  let response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  // If token expired, force refresh and retry once
  if (response.status === 401) {
    const refreshed = await getGoogleDriveAccess({ forceRefresh: true });
    accessToken = refreshed.accessToken;
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Không thể đọc dữ liệu Google Sheets (${response.status}): ${errorText.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    valueRanges?: Array<{
      range: string;
      values?: unknown[][];
    }>;
  };

  const valueRanges = data.valueRanges || [];

  function extractSheet(sheetName: SheetName, rangeIndex: number) {
    const vr = valueRanges[rangeIndex];
    const allRows = vr?.values || [];
    if (allRows.length === 0) {
      throw new Error(
        `Sheet "${sheetName}" trống hoặc không tìm thấy dữ liệu.`,
      );
    }
    const headers = allRows[0] || [];
    const rows = allRows.slice(1);
    return { headers, rows };
  }

  return {
    spreadsheetId,
    sheets: {
      Orders: extractSheet("Orders", 0),
      COGS: extractSheet("COGS", 1),
      Ads: extractSheet("Ads", 2),
      Payouts: extractSheet("Payouts", 3),
    },
  };
}
