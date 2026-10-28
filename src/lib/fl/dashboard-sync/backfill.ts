import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { getBoSheetDestination } from "../bo-import-config";
import { getStatementHeaders } from "../statement-parser/types";
import { syncBoRowsToDashboard } from "./import";
import {
  type DashboardReport,
  type RawBoRow,
  REPORTS,
  sheetDate,
} from "./mapping";

/** Legacy USER_ENTERED uploads interpreted Etsy MM/DD dates using a D/M Sheet locale. */
export function recoverLegacyEtsyDate(value: unknown, locale: string): unknown {
  if (typeof value !== "number" || !["vi_VN", "en_GB"].includes(locale))
    return value;
  const parsed = sheetDate(value);
  if (!parsed) throw Error("Invalid legacy Etsy date.");
  const [year, month, day] = parsed.split("-");
  if (Number(day) > 12)
    throw Error("Legacy numeric date requires source-file reconciliation.");
  return `${year}-${day}-${month}`;
}
export async function backfillBoDashboard(
  options: { boIds?: string[]; reports?: DashboardReport[] } = {},
) {
  const { accessToken } = await getGoogleDriveAccess();
  const results = [];
  for (const bo of options.boIds ?? ["mr-phuc", "ms-linh", "mr-nam"]) {
    const destination = getBoSheetDestination(bo);
    const base = `https://sheets.googleapis.com/v4/spreadsheets/${destination.spreadsheetId}`;
    const request = async (path: string) => {
      const response = await fetch(base + path, {
        headers: { Authorization: `Bearer ${accessToken}` },
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw Error(`BO Sheet ${bo} HTTP ${response.status}`);
      return response.json();
    };
    const meta = await request("?fields=properties.locale");
    const url = new URL(`${base}/values:batchGet`);
    for (const tab of ["RAW.Orders", "RAW.Items", "RAW.Statement"])
      url.searchParams.append("ranges", `${tab}!A1:AK`);
    url.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
    const payload = (await request(url.href.slice(base.length))) as {
      valueRanges: Array<{ values?: unknown[][] }>;
    };
    for (const [index, type] of (
      ["orders", "items", "statements"] as DashboardReport[]
    ).entries()) {
      if (options.reports && !options.reports.includes(type)) continue;
      const matrix = payload.valueRanges[index]?.values ?? [];
      const expected =
        type === "statements"
          ? getStatementHeaders(destination.extendedStatement)
          : REPORTS[type].headers;
      if (!expected.every((value, i) => matrix[0]?.[i] === value))
        throw Error(`BO ${bo} ${type} header mismatch.`);
      let recovered = 0;
      const rows: RawBoRow[] = matrix
        .slice(1)
        .filter((row) => row.some((v) => v !== "" && v != null))
        .map((row) => {
          const out: RawBoRow = {};
          for (const [ci, h] of expected.entries()) {
            let value: unknown = row[ci] ?? "";
            if (
              type !== "statements" &&
              ["Sale Date", "Date Paid", "Date Shipped"].includes(h) &&
              typeof value === "number"
            ) {
              value = recoverLegacyEtsyDate(value, meta.properties.locale);
              recovered++;
            }
            out[h] = value;
          }
          return out;
        });
      const result = await syncBoRowsToDashboard(
        type,
        rows,
        `BO Google Sheet ${destination.spreadsheetId}`,
      );
      results.push({
        bo,
        type,
        rows: rows.length,
        recoveredDateCells: recovered,
        ...result,
      });
    }
  }
  return results;
}
