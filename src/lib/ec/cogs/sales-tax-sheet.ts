import { EXPECTED_SHEET_HEADERS } from "@/lib/ec/sheet-import/types";
import { record } from "./types";

export function cogsSalesTax(row: {
  supplier: string;
  rawPayload: unknown;
}): number | "" {
  if (row.supplier !== "Printify") return "";
  const value = record(row.rawPayload).ecSalesTax;
  return typeof value === "number" && Number.isFinite(value) ? value : "";
}

export async function ensureCogsSalesTaxHeader(
  request: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const r = await request("/values/COGS!A1:O1");
  if (!r.ok) throw Error(`COGS header read failed (${r.status}).`);
  const p = (await r.json()) as { values?: string[][] };
  const header = p.values?.[0] ?? [];
  if (
    !EXPECTED_SHEET_HEADERS.COGS.every(
      (value, index) => header[index]?.trim() === value,
    )
  )
    throw Error("COGS header mismatch; stopped to protect data.");
  if (header[12] && header[12] !== "PL recognition month")
    throw Error("COGS column M differs from PL recognition month.");
  if (header[13] && header[13] !== "Recognition status")
    throw Error("COGS column N differs from Recognition status.");
  if (header[14] === "Sales Tax") return;
  if (header[14]) throw Error("COGS column O is already in use.");
  const meta = await request(
    "?fields=sheets.properties(sheetId,title,gridProperties.columnCount)",
  );
  if (!meta.ok) throw Error("Cannot read COGS grid.");
  const metadata = (await meta.json()) as {
    sheets: Array<{
      properties: {
        sheetId: number;
        title: string;
        gridProperties: { columnCount: number };
      };
    }>;
  };
  const sheet = metadata.sheets.find(
    (s) => s.properties.title === "COGS",
  )?.properties;
  if (!sheet) throw Error("COGS tab missing.");
  if (sheet.gridProperties.columnCount < 15) {
    const resized = await request(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            appendDimension: {
              sheetId: sheet.sheetId,
              dimension: "COLUMNS",
              length: 15 - sheet.gridProperties.columnCount,
            },
          },
        ],
      }),
    });
    if (!resized.ok) throw Error("Cannot extend COGS grid.");
  }
  const result = await request("/values/COGS!O1?valueInputOption=RAW", {
    method: "PUT",
    body: JSON.stringify({ values: [["Sales Tax"]] }),
  });
  if (!result.ok) throw Error(`COGS header write failed (${result.status}).`);
}
