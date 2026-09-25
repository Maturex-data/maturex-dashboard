import { getGoogleDriveAccess } from "@/lib/ec-drive";
import {
  MICROM_SPREADSHEET_ID,
  MICROM_TABS,
  type MicromTabName,
  TAB_COLUMNS_MAP,
} from "./constants";
import { computeTabFingerprint } from "./sheet-writer";
import { MicromHeaderDriftError, type TabFingerprints } from "./types";

export interface SheetRawData {
  tab: MicromTabName;
  headers: string[];
  rows: unknown[][];
  fingerprint: string;
}

export async function readMicromSheetData(
  spreadsheetId = MICROM_SPREADSHEET_ID,
): Promise<{
  data: Record<MicromTabName, SheetRawData>;
  fingerprints: TabFingerprints;
}> {
  const access = await getGoogleDriveAccess();
  const token = access.accessToken;

  const tabs = [
    MICROM_TABS.ORDERS,
    MICROM_TABS.COGS,
    MICROM_TABS.ADS,
    MICROM_TABS.SHOPIFY_ITEMS,
  ];

  const result: Record<string, SheetRawData> = {};
  const fingerprints: TabFingerprints = {};

  for (const tab of tabs) {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(
      tab,
    )}!A1:Z?valueRenderOption=UNFORMATTED_VALUE`;

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Failed to read tab ${tab}: ${err}`);
    }

    const json = (await res.json()) as { values?: unknown[][] };
    const allRows = json.values || [];

    if (allRows.length === 0) {
      throw new Error(`Tab "${tab}" is completely empty.`);
    }

    const headers = (allRows[0] || []).map((c) => String(c ?? "").trim());
    const expected = TAB_COLUMNS_MAP[tab];

    if (headers.length < expected.length) {
      throw new MicromHeaderDriftError(tab, expected, headers);
    }

    for (let i = 0; i < expected.length; i++) {
      if (headers[i] !== expected[i].trim()) {
        throw new MicromHeaderDriftError(tab, expected, headers);
      }
    }

    const dataRows = allRows.slice(1);
    const fingerprint = computeTabFingerprint(dataRows);

    result[tab] = {
      tab,
      headers,
      rows: dataRows,
      fingerprint,
    };
    fingerprints[tab] = fingerprint;
  }

  return {
    data: result as Record<MicromTabName, SheetRawData>,
    fingerprints,
  };
}
