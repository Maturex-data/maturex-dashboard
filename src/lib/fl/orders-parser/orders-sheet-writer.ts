import { getGoogleDriveAccess } from "@/lib/ec-drive";
import type { MappedOrderRow } from "@/lib/fl/orders-parser/types";
import { RAW_ORDERS_HEADERS } from "@/lib/fl/orders-parser/types";

export const ECOMBIUS_ORDERS_SPREADSHEET_ID =
  "1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do";
export const ORDERS_TAB_NAME = "RAW.Orders";
export const ORDERS_SHEET_ID = 839747432;
export const ORDERS_LAST_COLUMN = "AK"; // 37 cột: A đến AK

export interface SheetImportResult {
  insertedCount: number;
  updatedCount: number;
  totalSheetRows: number;
  spreadsheetId: string;
  tabName: string;
}

/**
 * Ghi hoặc cập nhật danh sách đơn hàng đã map vào tab RAW.Orders của Google Sheet.
 * Sử dụng cơ chế Upsert theo Order ID (Cột B):
 * - Nếu Order ID đã tồn tại: cập nhật dòng đó.
 * - Nếu Order ID chưa tồn tại: nối thêm vào cuối tab.
 * - Bảo toàn 100% dữ liệu của các shop khác (Evernest, etc.) trong cùng tab.
 */
export async function upsertOrdersToGoogleSheet(
  mappedRows: MappedOrderRow[],
): Promise<SheetImportResult> {
  if (!mappedRows.length) {
    return {
      insertedCount: 0,
      updatedCount: 0,
      totalSheetRows: 0,
      spreadsheetId: ECOMBIUS_ORDERS_SPREADSHEET_ID,
      tabName: ORDERS_TAB_NAME,
    };
  }

  const { accessToken } = await getGoogleDriveAccess();

  // 1. Đọc dữ liệu hiện có trong tab RAW.Orders (từ hàng 2 đến AK)
  const range = `${ORDERS_TAB_NAME}!A2:${ORDERS_LAST_COLUMN}`;
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ECOMBIUS_ORDERS_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

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

  // Tạo map tra cứu Order ID hiện có (Cột B, index 1) -> số thứ tự dòng trong existingRows (0-indexed)
  const existingOrderIdMap = new Map<string, number>();
  existingRows.forEach((row, idx) => {
    const orderId = String(row[1] ?? "").trim();
    if (orderId) {
      existingOrderIdMap.set(orderId, idx);
    }
  });

  let updatedCount = 0;
  let insertedCount = 0;

  // Clone mảng existingRows để cập nhật/thêm
  const nextSheetRows: (string | number | null)[][] = existingRows.map((r) => [
    ...r,
  ]);

  for (const item of mappedRows) {
    const orderId = String(item["Order ID"] ?? "").trim();
    // Chuyển MappedOrderRow thành mảng 37 phần tử
    const rowCells = RAW_ORDERS_HEADERS.map((h) => {
      const val = item[h];
      return val === null || val === undefined ? "" : val;
    });

    const existingIdx = orderId ? existingOrderIdMap.get(orderId) : undefined;
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
    `https://sheets.googleapis.com/v4/spreadsheets/${ECOMBIUS_ORDERS_SPREADSHEET_ID}?fields=sheets.properties(sheetId,title,gridProperties.rowCount)`,
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
      (s) => s.properties?.title === ORDERS_TAB_NAME,
    );

    if (currentSheetMeta?.properties) {
      const currentRowCount =
        currentSheetMeta.properties.gridProperties?.rowCount || 100;
      const requiredRowCount = nextSheetRows.length + 50;

      if (currentRowCount < requiredRowCount) {
        await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${ECOMBIUS_ORDERS_SPREADSHEET_ID}:batchUpdate`,
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
                      sheetId: ORDERS_SHEET_ID,
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

  // 3. Xóa dữ liệu cũ từ A2:AK và ghi đè danh sách đã gộp mới
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${ECOMBIUS_ORDERS_SPREADSHEET_ID}/values/${encodeURIComponent(`${ORDERS_TAB_NAME}!A2:${ORDERS_LAST_COLUMN}`)}:clear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );

  // Ghi theo chunk 1.000 dòng để tránh payload size limit của Google API
  const chunkSize = 1_000;
  const writeData = [];
  for (let offset = 0; offset < nextSheetRows.length; offset += chunkSize) {
    writeData.push({
      range: `${ORDERS_TAB_NAME}!A${offset + 2}`,
      majorDimension: "ROWS",
      values: nextSheetRows.slice(offset, offset + chunkSize),
    });
  }

  if (writeData.length > 0) {
    const writeRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${ECOMBIUS_ORDERS_SPREADSHEET_ID}/values:batchUpdate`,
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
    spreadsheetId: ECOMBIUS_ORDERS_SPREADSHEET_ID,
    tabName: ORDERS_TAB_NAME,
  };
}
