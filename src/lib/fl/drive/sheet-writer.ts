import { formatVietnamMonth } from "@/lib/date-time";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { flowaSheetsRequest } from "./sheets-client";
import {
  FLOWA_REPORT_SHEETS,
  type FlowaReportSheet,
  type FlowaSheetValue,
  record,
  statementRowKey,
  text,
} from "./types";

async function replaceFlowaSheetRows(
  accessToken: string,
  sheet: FlowaReportSheet,
  rows: FlowaSheetValue[][],
): Promise<void> {
  const { lastColumn } = FLOWA_REPORT_SHEETS[sheet];

  if (sheet === "Statement") {
    for (let i = 0; i < rows.length; i++) {
      rows[i][2] = i + 2;
    }
  }

  // Ensure grid size
  const spreadsheetResponse = await flowaSheetsRequest(
    accessToken,
    "?fields=sheets.properties(sheetId,title,gridProperties.rowCount)",
  );
  const spreadsheet = record(await spreadsheetResponse.json());
  const sheetMeta = Array.isArray(spreadsheet.sheets)
    ? spreadsheet.sheets
        .map(record)
        .find((item) => record(item.properties).title === sheet)
    : undefined;

  if (!sheetMeta) {
    throw new Error(`Sheet ${sheet} not found in destination spreadsheet.`);
  }

  const sheetId = Number(record(sheetMeta.properties).sheetId);
  const currentRowCount = Number(
    record(record(sheetMeta.properties).gridProperties).rowCount,
  );
  const requiredRowCount = Math.max(100, rows.length + 50);

  if (currentRowCount < requiredRowCount) {
    await flowaSheetsRequest(accessToken, ":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            updateSheetProperties: {
              properties: {
                sheetId,
                gridProperties: { rowCount: requiredRowCount },
              },
              fields: "gridProperties.rowCount",
            },
          },
        ],
      }),
    });
  }

  // Clear existing content from row 2
  await flowaSheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(`${sheet}!A2:${lastColumn}`)}:clear`,
    { method: "POST" },
  );

  // Batch write chunks
  const chunkSize = 1_000;
  const data = [];
  for (let offset = 0; offset < rows.length; offset += chunkSize) {
    data.push({
      range: `${sheet}!A${offset + 2}`,
      majorDimension: "ROWS",
      values: rows.slice(offset, offset + chunkSize),
    });
  }

  if (data.length) {
    await flowaSheetsRequest(accessToken, "/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
  }
}

export async function writeFlowaSheet(
  accessToken: string,
  sheet: FlowaReportSheet,
  values: FlowaSheetValue[][],
  from: Date,
  to: Date,
): Promise<void> {
  const { lastColumn } = FLOWA_REPORT_SHEETS[sheet];

  // Fetch existing rows
  const existingResponse = await flowaSheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(`${sheet}!A2:${lastColumn}`)}?valueRenderOption=FORMATTED_VALUE`,
  );
  const existingPayload = record(await existingResponse.json());
  const existing = Array.isArray(existingPayload.values)
    ? existingPayload.values.filter(Array.isArray)
    : [];

  const minMonth = formatVietnamMonth(from);
  const maxMonth = formatVietnamMonth(new Date(to.getTime() - 1));

  const incomingStatementKeys = new Set(
    sheet === "Statement" ? values.map(statementRowKey) : [],
  );

  // Preserve rows that are outside the target month range. A refund can be
  // classified to its original sale month, so replace a matching preserved row
  // rather than duplicating it when that month falls outside the sync range.
  const preserved = existing.filter((row) => {
    const month = text(row[0]);
    if (!month) return false;
    if (month >= minMonth && month <= maxMonth) return false;
    return (
      sheet !== "Statement" || !incomingStatementKeys.has(statementRowKey(row))
    );
  });

  // Re-index Source row for Statement
  const combined = [...preserved, ...values];

  if (sheet === "Statement") {
    // Re-index column C (Source row, index 2) sequentially starting at 2
    for (let i = 0; i < combined.length; i++) {
      combined[i][2] = i + 2;
    }
  }

  await replaceFlowaSheetRows(accessToken, sheet, combined);
}

export async function upsertFlowaImportedRows(
  sheet: FlowaReportSheet,
  incoming: FlowaSheetValue[][],
): Promise<void> {
  if (!incoming.length) return;

  const { accessToken } = await getGoogleDriveAccess();
  const { lastColumn } = FLOWA_REPORT_SHEETS[sheet];
  const response = await flowaSheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(`${sheet}!A2:${lastColumn}`)}?valueRenderOption=UNFORMATTED_VALUE`,
  );
  const payload = record(await response.json());
  const existing = Array.isArray(payload.values)
    ? payload.values
        .filter(Array.isArray)
        .map((row) => row as FlowaSheetValue[])
    : [];
  const incomingGroups = new Set(
    incoming.map((row) => `${text(row[0])}|${text(row[1])}`),
  );
  const preserved = existing.filter(
    (row) => !incomingGroups.has(`${text(row[0])}|${text(row[1])}`),
  );

  await replaceFlowaSheetRows(accessToken, sheet, [...preserved, ...incoming]);
}

export async function clearFlowaSheet(
  accessToken: string,
  sheet: FlowaReportSheet,
): Promise<{ cleared: number }> {
  const { lastColumn } = FLOWA_REPORT_SHEETS[sheet];
  const range = `${sheet}!A2:${lastColumn}`;
  const response = await flowaSheetsRequest(
    accessToken,
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
  );
  const payload = record(await response.json());
  const rows = Array.isArray(payload.values)
    ? payload.values.filter(Array.isArray)
    : [];

  if (rows.length > 0) {
    await flowaSheetsRequest(
      accessToken,
      `/values/${encodeURIComponent(range)}:clear`,
      { method: "POST" },
    );
  }

  return { cleared: rows.length };
}
