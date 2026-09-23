import "server-only";

import { getGoogleDriveAccess, REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";

export const EC_BUSINESS_REPORT_SHEETS = ["PL", "Rewards", "P&L ngày"] as const;

export type EcBusinessReportSheetName =
  (typeof EC_BUSINESS_REPORT_SHEETS)[number];

export type EcBusinessReportSheetTable = {
  name: EcBusinessReportSheetName;
  rows: string[][];
  error?: string;
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

/** Reads displayed Google Sheet values so the accounting view matches its source. */
export async function getEcBusinessReportSheetTables(): Promise<
  EcBusinessReportSheetTable[]
> {
  const { accessToken } = await getGoogleDriveAccess();
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}/values:batchGet`,
  );
  for (const name of EC_BUSINESS_REPORT_SHEETS) {
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

  return EC_BUSINESS_REPORT_SHEETS.map((name) => ({
    name,
    rows: tablesByName.get(name) ?? [],
  }));
}
