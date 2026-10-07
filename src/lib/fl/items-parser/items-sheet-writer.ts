import { getGoogleDriveAccess } from "@/lib/ec-drive";
import {
  type BoSheetDestination,
  getBoSheetDestination,
} from "@/lib/fl/bo-import-config";
import { requireImportedOrders } from "@/lib/fl/orders-prerequisite";
import type { MappedItemRow } from "./types";
import { RAW_ITEMS_HEADERS } from "./types";

export const ECOMBIUS_ITEMS_SPREADSHEET_ID =
  "1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do";
export const ITEMS_TAB_NAME = "RAW.Items";
export const ITEMS_SHEET_ID = 136409036;
export const ITEMS_LAST_COLUMN = "AH"; // 34 cột: A đến AH

export interface ItemSheetImportResult {
  insertedCount: number;
  updatedCount: number;
  totalSheetRows: number;
  spreadsheetId: string;
  tabName: string;
}

/**
 * Ghi hoặc cập nhật danh sách Items đã map vào tab RAW.Items của Google Sheet.
 * Sử dụng cơ chế Upsert theo Transaction ID (Cột N, index 13):
 * - Nếu Transaction ID đã tồn tại: cập nhật dòng đó.
 * - Nếu Transaction ID chưa tồn tại: nối thêm vào cuối tab.
 * - Bảo toàn 100% dữ liệu của các shop khác trong cùng tab.
 */
export async function upsertItemsToGoogleSheet(
  mappedRows: MappedItemRow[],
  destination: BoSheetDestination = getBoSheetDestination("ms-linh"),
): Promise<ItemSheetImportResult> {
  if (!mappedRows.length) {
    return {
      insertedCount: 0,
      updatedCount: 0,
      totalSheetRows: 0,
      spreadsheetId: destination.spreadsheetId,
      tabName: ITEMS_TAB_NAME,
    };
  }

  await requireImportedOrders(mappedRows, destination.spreadsheetId);
  const { accessToken } = await getGoogleDriveAccess();

  // 1. Đọc dữ liệu hiện có trong tab RAW.Items (từ hàng 2 đến AH)
  const range = `${ITEMS_TAB_NAME}!A2:${ITEMS_LAST_COLUMN}`;
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

  // Tạo map tra cứu Transaction ID hiện có (Cột N, index 13) -> số thứ tự dòng trong existingRows (0-indexed)
  const existingTxIdMap = new Map<string, number>();
  existingRows.forEach((row, idx) => {
    const txId = String(row[13] ?? "").trim();
    if (txId) {
      existingTxIdMap.set(txId, idx);
    }
  });

  let updatedCount = 0;
  let insertedCount = 0;

  // Clone mảng existingRows để cập nhật/thêm
  const nextSheetRows: (string | number | null)[][] = existingRows.map((r) => [
    ...r,
  ]);

  for (const item of mappedRows) {
    const txId = String(item["Transaction ID"] ?? "").trim();
    // Chuyển MappedItemRow thành mảng 34 phần tử
    const rowCells = RAW_ITEMS_HEADERS.map((h) => {
      const val = item[h];
      return val === null || val === undefined ? "" : val;
    });

    const existingIdx = txId ? existingTxIdMap.get(txId) : undefined;
    if (existingIdx !== undefined) {
      // Cập nhật dòng hiện có
      nextSheetRows[existingIdx] = rowCells;
      updatedCount += 1;
    } else {
      // Thêm mới dòng vào cuối
      nextSheetRows.push(rowCells);
      insertedCount += 1;
    }
  }

  // 2. Đảm bảo gridProperties.rowCount trên Sheet đủ lớn
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
      (s) => s.properties?.title === ITEMS_TAB_NAME,
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
                      sheetId: destination.itemsSheetId,
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

  // 3. Xóa dữ liệu cũ từ A2:AH và ghi đè danh sách đã gộp mới
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}/values/${encodeURIComponent(`${ITEMS_TAB_NAME}!A2:${ITEMS_LAST_COLUMN}`)}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  // Ghi theo chunk 1.000 dòng để tránh giới hạn kích thước payload
  const chunkSize = 1_000;
  const writeData = [];
  for (let offset = 0; offset < nextSheetRows.length; offset += chunkSize) {
    writeData.push({
      range: `${ITEMS_TAB_NAME}!A${offset + 2}`,
      majorDimension: "ROWS",
      values: nextSheetRows.slice(offset, offset + chunkSize),
    });
  }

  if (writeData.length > 0) {
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}/values:batchUpdate`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          valueInputOption: "USER_ENTERED",
          data: writeData,
        }),
      },
    );

    if (!writeRes.ok) {
      const writeErr = (await writeRes.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      throw new Error(
        `Không thể ghi dữ liệu vào Google Sheet: ${writeErr.error?.message || writeRes.statusText}`,
      );
    }
  }

  return {
    insertedCount,
    updatedCount,
    totalSheetRows: nextSheetRows.length,
    spreadsheetId: destination.spreadsheetId,
    tabName: ITEMS_TAB_NAME,
  };
}
