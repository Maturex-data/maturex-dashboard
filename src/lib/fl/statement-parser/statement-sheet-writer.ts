import { getGoogleDriveAccess } from "@/lib/ec-drive";
import {
  type BoSheetDestination,
  getBoSheetDestination,
} from "@/lib/fl/bo-import-config";
import { extractMonthFromDateString } from "./statement-mapper";
import type { MappedStatementRow } from "./types";
import { RAW_STATEMENT_HEADERS } from "./types";

export const ECOMBIUS_STATEMENT_SPREADSHEET_ID =
  "1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do";
export const STATEMENT_TAB_NAME = "RAW.Statement";
export const STATEMENT_SHEET_ID = 69264119;
export const STATEMENT_LAST_COLUMN = "J"; // 10 cột: A đến J

export interface StatementSheetImportResult {
  replacedCount: number;
  preservedCount: number;
  newCount: number;
  totalSheetRows: number;
  spreadsheetId: string;
  tabName: string;
  verifiedMonth: string;
}

/**
 * Ghi đè dữ liệu Statement cho shop 97Decor trong tháng được xác minh vào tab RAW.Statement.
 * Cơ chế chống mất dòng & bảo toàn dữ liệu:
 * 1. Đọc toàn bộ các dòng hiện có trên tab RAW.Statement (A2:J).
 * 2. Lọc bỏ các dòng cũ thỏa mãn: Store === "97decor" (hoặc "97Decor") VÀ tháng === verifiedMonth.
 * 3. Bảo toàn 100% dòng của các shop khác (vd: Timond) và các tháng khác của shop 97Decor.
 * 4. Nối toàn bộ 100% các dòng mới vào danh sách (không loại bỏ dòng trùng lặp hợp lệ).
 * 5. Cập nhật lại tab RAW.Statement bằng batchUpdate.
 */
export async function replaceStatementMonthInGoogleSheet(
  mappedRows: MappedStatementRow[],
  verifiedMonth: string,
  destination: BoSheetDestination = getBoSheetDestination("ms-linh"),
): Promise<StatementSheetImportResult> {
  if (!mappedRows.length) {
    return {
      replacedCount: 0,
      preservedCount: 0,
      newCount: 0,
      totalSheetRows: 0,
      spreadsheetId: destination.spreadsheetId,
      tabName: STATEMENT_TAB_NAME,
      verifiedMonth,
    };
  }

  const { accessToken } = await getGoogleDriveAccess();

  // 1. Đọc dữ liệu hiện có trong tab RAW.Statement (từ hàng 2 đến J)
  const range = `${STATEMENT_TAB_NAME}!A2:${STATEMENT_LAST_COLUMN}`;
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const existingRes = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!existingRes.ok) {
    const errorJson = (await existingRes.json().catch(() => ({}))) as {
      error?: { message?: string };
    };
    throw new Error(
      `Không thể đọc Google Sheet: ${errorJson.error?.message || existingRes.statusText}`,
    );
  }

  const existingPayload = (await existingRes.json()) as {
    values?: (string | number | null)[][];
  };
  const existingRows = Array.isArray(existingPayload.values)
    ? existingPayload.values
    : [];

  // 2. Phân loại dòng cũ: giữ lại shop khác / tháng khác, chỉ lọc bỏ đúng 97Decor + verifiedMonth
  let replacedCount = 0;
  const preservedRows: (string | number | null)[][] = [];

  for (const row of existingRows) {
    const dateVal = String(row[0] ?? "").trim();
    const storeVal = String(row[9] ?? "")
      .trim()
      .toLowerCase();
    const rowMonth = extractMonthFromDateString(dateVal);

    const targetStore = String(mappedRows[0]?.Store ?? "")
      .trim()
      .toLowerCase()
      .replace(/\s/g, "");
    const isTargetShop = storeVal.replace(/\s/g, "") === targetStore;
    const isTargetMonth = rowMonth === verifiedMonth;

    if (isTargetShop && isTargetMonth) {
      replacedCount += 1;
    } else {
      preservedRows.push(row);
    }
  }

  // 3. Chuẩn bị tập dữ liệu mới: các dòng được bảo toàn + toàn bộ dòng mới
  const formattedNewRows: (string | number | null)[][] = mappedRows.map((r) =>
    RAW_STATEMENT_HEADERS.map((h) => {
      const val = r[h];
      return val === null || val === undefined ? "" : val;
    }),
  );

  const nextSheetRows = [...preservedRows, ...formattedNewRows];

  // 4. Đảm bảo số hàng trong Sheet đủ chứa dữ liệu
  const spreadsheetMetaRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}?fields=sheets.properties(sheetId,title,gridProperties.rowCount)`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (spreadsheetMetaRes.ok) {
    const spreadsheetMeta = (await spreadsheetMetaRes.json()) as {
      sheets?: Array<{
        properties?: {
          sheetId?: number;
          title?: string;
          gridProperties?: { rowCount?: number };
        };
      }>;
    };
    const currentSheetMeta = spreadsheetMeta.sheets?.find(
      (s) => s.properties?.title === STATEMENT_TAB_NAME,
    );

    if (currentSheetMeta?.properties) {
      const currentRowCount =
        currentSheetMeta.properties.gridProperties?.rowCount || 100;
      const requiredRowCount = nextSheetRows.length + 50;

      if (currentRowCount < requiredRowCount) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}:batchUpdate`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              requests: [
                {
                  updateSheetProperties: {
                    properties: {
                      sheetId: currentSheetMeta.properties.sheetId,
                      gridProperties: { rowCount: requiredRowCount },
                    },
                    fields: "gridProperties.rowCount",
                  },
                },
              ],
            }),
          },
        );
      }
    }
  }

  // 5. Ghi dữ liệu theo batch (mỗi batch 1,000 dòng)
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < nextSheetRows.length; i += CHUNK_SIZE) {
    const chunk = nextSheetRows.slice(i, i + CHUNK_SIZE);
    const startRow = i + 2;
    const endRow = startRow + chunk.length - 1;
    const writeRange = `${STATEMENT_TAB_NAME}!A${startRow}:${STATEMENT_LAST_COLUMN}${endRow}`;

    const updateUrl = `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}/values/${encodeURIComponent(writeRange)}?valueInputOption=USER_ENTERED`;

    const updateRes = await fetch(updateUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        range: writeRange,
        majorDimension: "ROWS",
        values: chunk,
      }),
    });

    if (!updateRes.ok) {
      const errPayload = (await updateRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(
        `Không thể ghi dữ liệu chunk ${startRow}-${endRow} vào Google Sheet: ${errPayload.error?.message || updateRes.statusText}`,
      );
    }
  }

  // 6. Nếu tổng số dòng mới ít hơn số dòng cũ ban đầu, xóa các ô thừa phía dưới
  if (nextSheetRows.length < existingRows.length) {
    const clearStartRow = nextSheetRows.length + 2;
    const clearEndRow = existingRows.length + 1;
    const clearRange = `${STATEMENT_TAB_NAME}!A${clearStartRow}:${STATEMENT_LAST_COLUMN}${clearEndRow}`;
    const clearUrl = `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}/values/${encodeURIComponent(clearRange)}:clear`;

    await fetch(clearUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  return {
    replacedCount,
    preservedCount: preservedRows.length,
    newCount: formattedNewRows.length,
    totalSheetRows: nextSheetRows.length,
    spreadsheetId: destination.spreadsheetId,
    tabName: STATEMENT_TAB_NAME,
    verifiedMonth,
  };
}
