import "server-only";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { MICROM_SPREADSHEET_ID } from "@/lib/microm/constants";

export interface ReportMerge {
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
}
export interface MicromReportTable {
  id: number;
  name: string;
  label: string;
  rows: string[][];
  merges: ReportMerge[];
  frozenRows: number;
}
const sources = [
  { id: 715653195, label: "P&L dự tính Q4 2026" },
  { id: 1267891236, label: "Chi phí VN" },
  { id: 1234590601, label: "PL" },
];

export async function getMicromReportTables(): Promise<MicromReportTable[]> {
  const { accessToken } = await getGoogleDriveAccess();
  const headers = { Authorization: `Bearer ${accessToken}` };
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${MICROM_SPREADSHEET_ID}`;
  const metaResponse = await fetch(
    `${base}?fields=sheets(properties(sheetId,title,gridProperties.frozenRowCount),merges)`,
    { headers, cache: "no-store" },
  );
  if (!metaResponse.ok)
    throw new Error(
      `Không truy cập được báo cáo Microm (${metaResponse.status}).`,
    );
  const metadata = (await metaResponse.json()) as {
    sheets?: Array<{
      properties: {
        sheetId: number;
        title: string;
        gridProperties?: { frozenRowCount?: number };
      };
      merges?: ReportMerge[];
    }>;
  };
  const selected = sources.map((source) => {
    const sheet = metadata.sheets?.find(
      (sheet) => sheet.properties.sheetId === source.id,
    );
    if (!sheet)
      throw new Error(`Không tìm thấy tab ${source.label} (gid ${source.id}).`);
    return { source, sheet };
  });
  const url = new URL(`${base}/values:batchGet`);
  for (const { sheet } of selected)
    url.searchParams.append(
      "ranges",
      `'${sheet.properties.title.replaceAll("'", "''")}'!A:ZZ`,
    );
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  const response = await fetch(url, { headers, cache: "no-store" });
  if (!response.ok)
    throw new Error(
      `Không đọc được dữ liệu báo cáo Microm (${response.status}).`,
    );
  const payload = (await response.json()) as {
    valueRanges?: Array<{ values?: unknown[][] }>;
  };
  return selected.map(({ source, sheet }, index) => {
    const values = payload.valueRanges?.[index]?.values ?? [];
    const width = Math.max(
      0,
      ...values.map((row) => row.length),
      ...(sheet.merges ?? []).map((merge) => merge.endColumnIndex),
    );
    return {
      id: source.id,
      name: sheet.properties.title,
      label: source.label,
      frozenRows: sheet.properties.gridProperties?.frozenRowCount ?? 0,
      merges: sheet.merges ?? [],
      rows: values.map((row) =>
        Array.from({ length: width }, (_, index) => String(row[index] ?? "")),
      ),
    };
  });
}
