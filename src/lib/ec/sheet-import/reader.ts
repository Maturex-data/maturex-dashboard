import { getGoogleDriveAccess, REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";
import { prisma } from "@/lib/prisma";
import {
  GoogleAuthError,
  GooglePermissionError,
  GoogleRateLimitError,
  type SheetName,
  SheetValidationError,
  UpstreamSyncInProgressError,
} from "./types";

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
    throw new UpstreamSyncInProgressError(
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
  let accessToken: string;
  try {
    const access = await getGoogleDriveAccess();
    accessToken = access.accessToken;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new GoogleAuthError(
      `Không thể lấy mã truy cập Google Drive: ${msg}. Vui lòng kết nối lại tài khoản Google trong phần Cài đặt.`,
    );
  }

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

  let response: Response;
  try {
    response = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
  } catch (netErr) {
    throw new Error(
      `Lỗi kết nối mạng khi gọi Google Sheets API: ${netErr instanceof Error ? netErr.message : String(netErr)}`,
    );
  }

  // If token expired, force refresh once
  if (response.status === 401) {
    try {
      const refreshed = await getGoogleDriveAccess({ forceRefresh: true });
      accessToken = refreshed.accessToken;
      response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });
    } catch (refreshErr) {
      throw new GoogleAuthError(
        `Làm mới Google OAuth token thất bại: ${refreshErr instanceof Error ? refreshErr.message : String(refreshErr)}. Vui lòng kết nối lại Google Drive.`,
      );
    }
  }

  // Handle distinct Google HTTP status codes
  if (response.status === 401) {
    throw new GoogleAuthError(
      "Google OAuth token không hợp lệ hoặc đã bị thu hồi (401 Unauthorized). Vui lòng kết nối lại tài khoản Google trong phần Cài đặt.",
    );
  }
  if (response.status === 403) {
    throw new GooglePermissionError(
      `Không có quyền đọc Google Spreadsheet "${spreadsheetId}" (403 Forbidden). Hãy kiểm tra quyền chia sẻ bảng tính.`,
    );
  }
  if (response.status === 429) {
    throw new GoogleRateLimitError(
      "Google Sheets API bị giới hạn tần suất (429 Too Many Requests). Vui lòng đợi và thử lại sau.",
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Sheets API thất bại (${response.status}): ${errorText.slice(0, 300)}`,
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
      throw new SheetValidationError(
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
