import "server-only";

import { getGoogleDriveAccess, REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";

export type EcBusinessReportSheetTable = {
  name: string;
  rows: string[][];
  error?: string;
};

type SpreadsheetMetadataResponse = {
  sheets?: Array<{
    properties?: {
      title?: string;
    };
  }>;
};

type BatchGetResponse = {
  valueRanges?: Array<{
    range?: string;
    values?: unknown[][];
  }>;
};

function cellValue(value: unknown): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function normalizeRows(values: unknown[][] | undefined): string[][] {
  if (!values?.length) return [];

  const width = values.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0,
  );
  return values.map((row) =>
    Array.from({ length: width }, (_, index) => cellValue(row[index])),
  );
}

function rangeSheetName(range: string | undefined): string {
  return (range ?? "").split("!")[0]?.replaceAll("'", "") ?? "";
}

function getCurrentMonthNumber(): number {
  return Number(
    new Intl.DateTimeFormat("en-US", {
      month: "numeric",
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date()),
  );
}

function selectDailySheetName(sheetNames: string[]): string {
  const dailySheets = sheetNames.flatMap((name) => {
    const match = /^P&L ngày T(\d{1,2})$/.exec(name);
    if (!match) return [];
    const month = Number(match[1]);
    return month >= 1 && month <= 12 ? [{ name, month }] : [];
  });

  const currentMonth = getCurrentMonthNumber();
  const currentSheet = dailySheets.find(({ month }) => month === currentMonth);
  if (currentSheet) return currentSheet.name;

  const mostRecentAvailable = dailySheets
    .filter(({ month }) => month <= currentMonth)
    .sort((left, right) => right.month - left.month)[0];

  const selectedSheet =
    mostRecentAvailable ??
    dailySheets.sort((left, right) => right.month - left.month)[0];

  if (!selectedSheet) {
    throw new Error(
      "Không tìm thấy tab P&L ngày theo tháng (ví dụ: “P&L ngày T10”) trong Google Sheet.",
    );
  }

  return selectedSheet.name;
}

/** Reads displayed Google Sheet values so the accounting view matches its source. */
export async function getEcBusinessReportSheetTables(): Promise<
  EcBusinessReportSheetTable[]
> {
  const { accessToken } = await getGoogleDriveAccess();
  const metadataUrl = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}`,
  );
  metadataUrl.searchParams.set("fields", "sheets(properties(title))");

  const metadataResponse = await fetch(metadataUrl, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const metadata =
    (await metadataResponse.json()) as SpreadsheetMetadataResponse & {
      error?: { message?: string };
    };

  if (!metadataResponse.ok) {
    throw new Error(
      metadata.error?.message ||
        `Google Sheets metadata failed (${metadataResponse.status}).`,
    );
  }

  const dailySheetName = selectDailySheetName(
    (metadata.sheets ?? [])
      .map((sheet) => sheet.properties?.title)
      .filter((title): title is string => Boolean(title)),
  );
  const sheetNames = ["PL", "Rewards", dailySheetName];

  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}/values:batchGet`,
  );
  for (const name of sheetNames) {
    url.searchParams.append("ranges", `'${name}'!A:ZZ`);
  }
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  const payload = (await response.json()) as BatchGetResponse & {
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(
      payload.error?.message ||
        `Google Sheets API failed (${response.status}).`,
    );
  }

  const tablesByName = new Map(
    (payload.valueRanges ?? []).map((range) => [
      rangeSheetName(range.range),
      normalizeRows(range.values),
    ]),
  );

  return sheetNames.map((name) => ({
    name,
    rows: tablesByName.get(name) ?? [],
  }));
}
