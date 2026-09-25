import { getGoogleDriveAccess } from "@/lib/ec-drive";
import {
  MICROM_SPREADSHEET_ID,
  MICROM_TABS,
  type MicromTabName,
} from "./constants";
import { acquireMicromLock } from "./lock-manager";

export interface ClearTabResult {
  tab: MicromTabName;
  cleared: number;
  formulas: number;
}

export interface ClearSheetResult {
  totalCleared: number;
  totalFormulas: number;
  results: ClearTabResult[];
}

export interface ClearSheetOptions {
  sheets?: MicromTabName[];
  actor?: string;
}

async function sheetsRequest(
  spreadsheetId: string,
  accessToken: string,
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`;
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google Sheets API error (${response.status}): ${errorText || "Request failed"}`,
    );
  }

  return response;
}

/**
 * Clears data rows from row 2 downward for a single sheet tab while strictly preserving formulas
 */
export async function clearMicromTab(
  spreadsheetId: string,
  accessToken: string,
  tab: MicromTabName,
): Promise<ClearTabResult> {
  // Read all cells starting from row 2 up to column Z with raw FORMULA render option
  const range = `${tab}!A2:Z`;
  const response = await sheetsRequest(
    spreadsheetId,
    accessToken,
    `/values/${encodeURIComponent(range)}?valueRenderOption=FORMULA`,
  );

  const payload = (await response.json()) as { values?: unknown[][] };
  const rows = Array.isArray(payload.values)
    ? payload.values.filter(Array.isArray)
    : [];

  let cleared = 0;
  let formulas = 0;

  const values: unknown[][] = rows.map((row) =>
    row.map((value) => {
      if (typeof value === "string" && value.startsWith("=")) {
        formulas += 1;
        return value; // Keep formula untouched
      }
      if (value !== "" && value !== null && value !== undefined) {
        cleared += 1;
      }
      return ""; // Blank out raw data
    }),
  );

  if (values.length === 0) {
    return { tab, cleared: 0, formulas: 0 };
  }

  // If there are zero formulas anywhere in the sheet, a direct :clear range API call is instant and 100% clean
  if (formulas === 0) {
    await sheetsRequest(
      spreadsheetId,
      accessToken,
      `/values/${encodeURIComponent(range)}:clear`,
      { method: "POST" },
    );
    return { tab, cleared, formulas: 0 };
  }

  // If formulas exist, write back with USER_ENTERED in chunks so formulas are kept while non-formula cells are blanked
  const chunkSize = 1_000;
  for (let offset = 0; offset < values.length; offset += chunkSize) {
    await sheetsRequest(spreadsheetId, accessToken, "/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        valueInputOption: "USER_ENTERED",
        data: [
          {
            range: `${tab}!A${offset + 2}`,
            majorDimension: "ROWS",
            values: values.slice(offset, offset + chunkSize),
          },
        ],
      }),
    });
  }

  return { tab, cleared, formulas };
}

/**
 * Clears data from row 2 downward on target Microm sheets without altering formulas
 */
export async function clearMicromSheetData(
  options: ClearSheetOptions = {},
): Promise<ClearSheetResult> {
  const spreadsheetId = MICROM_SPREADSHEET_ID;
  const targetTabs = options.sheets || [
    MICROM_TABS.ORDERS,
    MICROM_TABS.COGS,
    MICROM_TABS.ADS,
    MICROM_TABS.SHOPIFY_ITEMS,
  ];

  const lock = await acquireMicromLock(options.actor || "clear_sheet_manual");

  try {
    const { accessToken } = await getGoogleDriveAccess();
    const results: ClearTabResult[] = [];

    // Process tabs sequentially to respect Google Sheets API rate limits
    for (const tab of targetTabs) {
      const res = await clearMicromTab(spreadsheetId, accessToken, tab);
      results.push(res);
    }

    const totalCleared = results.reduce((sum, r) => sum + r.cleared, 0);
    const totalFormulas = results.reduce((sum, r) => sum + r.formulas, 0);

    return {
      totalCleared,
      totalFormulas,
      results,
    };
  } finally {
    await lock.release();
  }
}
