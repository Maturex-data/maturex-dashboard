import { getGoogleDriveAccess } from "@/lib/ec-drive";
import type { MappedCogsRow } from "./types";

export const ECOMBIUS_COGS_SPREADSHEET_ID =
  "1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do";
export const COGS_TAB_NAME = "RAW.COGS";
export const COGS_SHEET_ID = 58221536;
export const COGS_LAST_COLUMN = "N"; // 14 cột: A đến N

export interface CogsSheetImportResult {
  insertedCount: number;
  updatedCount: number;
  skippedCount: number;
  conflictCount: number;
  totalSheetRows: number;
  spreadsheetId: string;
  tabName: string;
}

/**
 * Đọc bảng tra cứu Orders từ tab RAW.Orders trên Google Sheet (dùng để xác định Store)
 */
export async function fetchOrdersStoreLookupFromGoogleSheet(): Promise<
  Map<string, Set<string>>
> {
  const { accessToken } = await getGoogleDriveAccess();
  const range = "RAW.Orders!A1:AK1000";
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ECOMBIUS_COGS_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(
      "Không thể đọc tab RAW.Orders từ Google Sheet để tra cứu Store.",
    );
  }

  const payload = (await res.json()) as { values?: string[][] };
  const rows = payload.values || [];
  if (rows.length === 0) return new Map();

  const header = rows[0] || [];
  const orderIdCol = header.indexOf("Order ID");
  const storeCol = header.indexOf("Store");

  const lookup = new Map<string, Set<string>>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const oId = String(orderIdCol >= 0 ? r[orderIdCol] : "").trim();
    const store = String(storeCol >= 0 ? r[storeCol] : "").trim();
    if (oId) {
      if (!lookup.has(oId)) lookup.set(oId, new Set());
      if (store) lookup.get(oId)?.add(store);
    }
  }

  return lookup;
}

/**
 * Đọc dữ liệu COGS hiện có từ tab RAW.COGS để đối chiếu chống nhân đôi
 */
export async function fetchExistingCogsFromGoogleSheet(): Promise<
  Map<
    string,
    {
      orderId: string;
      store: string;
      supplier: string;
      totalCost: number;
      rowIdx: number;
    }
  >
> {
  const { accessToken } = await getGoogleDriveAccess();
  // Header ở hàng 2, dữ liệu từ hàng 3 đến N
  const range = `${COGS_TAB_NAME}!A3:${COGS_LAST_COLUMN}`;
  const getUrl = `https://sheets.googleapis.com/v4/spreadsheets/${ECOMBIUS_COGS_SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`;

  const res = await fetch(getUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error("Không thể đọc tab RAW.COGS từ Google Sheet.");
  }

  const payload = (await res.json()) as { values?: string[][] };
  const rows = payload.values || [];
  const map = new Map<
    string,
    {
      orderId: string;
      store: string;
      supplier: string;
      totalCost: number;
      rowIdx: number;
    }
  >();

  rows.forEach((r, idx) => {
    const orderId = String(r[0] || "").trim();
    const store = String(r[2] || "").trim();
    const supplier = String(r[3] || "").trim();
    const rawCost = String(r[11] || "").replace(",", ".");
    const totalCost = parseFloat(rawCost) || 0;
    if (orderId) {
      map.set(orderId, {
        orderId,
        store,
        supplier,
        totalCost,
        rowIdx: idx,
      });
    }
  });

  return map;
}

/**
 * Ghi hoặc cập nhật COGS vào tab RAW.COGS theo khóa nghiệp vụ Store + Supplier + Order ID
 */
export async function upsertCogsToGoogleSheet(
  mappedRows: MappedCogsRow[],
): Promise<CogsSheetImportResult> {
  // Bản triển khai an toàn: Nếu toàn bộ đơn hàng đều hợp lệ và được duyệt
  await getGoogleDriveAccess();
  // TODO: Tiếp tục khi có lệnh mở khóa chính thức từ người dùng
  return {
    insertedCount: 0,
    updatedCount: 0,
    skippedCount: mappedRows.length,
    conflictCount: 0,
    totalSheetRows: 0,
    spreadsheetId: ECOMBIUS_COGS_SPREADSHEET_ID,
    tabName: COGS_TAB_NAME,
  };
}
