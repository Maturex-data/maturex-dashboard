import "server-only";

import { getGoogleDriveAccess, REPORT_SPREADSHEET_ID } from "@/lib/ec-drive";
import {
  EC_PROGRESS_SHEET_NAMES,
  type EcProgressSheetTable,
} from "@/lib/ec-progress-report-types";

type BatchGetResponse = {
  valueRanges?: Array<{
    range?: string;
    values?: unknown[][];
  }>;
};

export class EcProgressSheetError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "EcProgressSheetError";
  }
}

function normalizeRows(values: unknown[][] | undefined): string[][] {
  if (!values?.length) return [];

  const width = values.reduce(
    (maximum, row) => Math.max(maximum, row.length),
    0,
  );

  return values.map((row) =>
    Array.from({ length: width }, (_, index) => {
      const value = row[index];
      return value === null || value === undefined ? "" : String(value);
    }),
  );
}

function getSheetName(range: string | undefined): string {
  return (range ?? "").split("!")[0]?.replaceAll("'", "") ?? "";
}

async function readBatch(accessToken: string): Promise<Response> {
  const url = new URL(
    `https://sheets.googleapis.com/v4/spreadsheets/${REPORT_SPREADSHEET_ID}/values:batchGet`,
  );

  for (const name of EC_PROGRESS_SHEET_NAMES) {
    url.searchParams.append("ranges", `'${name}'!A:ZZ`);
  }
  url.searchParams.set("majorDimension", "ROWS");
  url.searchParams.set("valueRenderOption", "FORMATTED_VALUE");
  url.searchParams.set("dateTimeRenderOption", "FORMATTED_STRING");

  return fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
}

function errorForGoogleStatus(status: number): EcProgressSheetError {
  if (status === 401) {
    return new EcProgressSheetError(
      "Kết nối Google đã hết hiệu lực. Vui lòng kết nối lại Google Drive trong phần Cài đặt.",
      401,
    );
  }
  if (status === 403) {
    return new EcProgressSheetError(
      "Tài khoản Google hiện không có quyền xem bảng tính EC này. Hãy kiểm tra quyền chia sẻ spreadsheet.",
      403,
    );
  }
  if (status === 404) {
    return new EcProgressSheetError(
      "Không tìm thấy bảng tính EC. Hãy kiểm tra cấu hình spreadsheet trong phần Cài đặt.",
      404,
    );
  }
  if (status === 429) {
    return new EcProgressSheetError(
      "Google Sheets đang giới hạn yêu cầu. Vui lòng đợi một chút rồi thử lại.",
      429,
    );
  }
  if (status === 400) {
    return new EcProgressSheetError(
      "Không thể đọc hai tab tiến độ. Hãy kiểm tra tên tab trong Google Sheet có khớp chính xác không.",
      502,
    );
  }
  return new EcProgressSheetError(
    "Google Sheets chưa thể trả dữ liệu. Vui lòng thử lại sau.",
    502,
  );
}

/** Reads the two EC progress tabs as formatted values without writing to Sheets. */
export async function getEcProgressSheetTables(): Promise<{
  tables: EcProgressSheetTable[];
  lastUpdatedAt: string;
}> {
  let accessToken: string;
  try {
    ({ accessToken } = await getGoogleDriveAccess());
  } catch {
    throw new EcProgressSheetError(
      "Chưa thể kết nối Google Drive. Vui lòng kiểm tra kết nối Google trong phần Cài đặt.",
      503,
    );
  }

  let response: Response;
  try {
    response = await readBatch(accessToken);
    if (response.status === 401) {
      try {
        ({ accessToken } = await getGoogleDriveAccess({ forceRefresh: true }));
      } catch {
        throw errorForGoogleStatus(401);
      }
      response = await readBatch(accessToken);
    }
  } catch (error) {
    if (error instanceof EcProgressSheetError) throw error;
    throw new EcProgressSheetError(
      "Không kết nối được Google Sheets. Hãy kiểm tra mạng rồi thử lại.",
      503,
    );
  }

  if (!response.ok) throw errorForGoogleStatus(response.status);

  let payload: BatchGetResponse;
  try {
    payload = (await response.json()) as BatchGetResponse;
  } catch {
    throw new EcProgressSheetError(
      "Google Sheets trả về dữ liệu không đọc được. Vui lòng thử lại.",
      502,
    );
  }

  const tablesByName = new Map<string, string[][]>();
  for (const range of payload.valueRanges ?? []) {
    tablesByName.set(getSheetName(range.range), normalizeRows(range.values));
  }

  const missingSheet = EC_PROGRESS_SHEET_NAMES.find(
    (name) => !tablesByName.has(name),
  );
  if (missingSheet) {
    throw new EcProgressSheetError(
      `Google Sheets không trả về tab “${missingSheet}”. Hãy kiểm tra tên tab nguồn.`,
      502,
    );
  }

  const tables = EC_PROGRESS_SHEET_NAMES.map((name) => ({
    name,
    rows: tablesByName.get(name) ?? [],
  }));

  return {
    tables,
    lastUpdatedAt: new Date().toISOString(),
  };
}
