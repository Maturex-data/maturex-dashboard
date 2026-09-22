import * as XLSX from "xlsx";
import {
  cleanText,
  detectReport,
  MAX_FILE_BYTES,
  monthStart,
  type ParsedSource,
  parseDate,
  type SourceRow,
  sha256,
} from "./types";

export async function parseFile(file: File): Promise<ParsedSource> {
  if (!/\.(csv|xlsx)$/i.test(file.name)) {
    throw new Error("Chỉ hỗ trợ file CSV hoặc XLSX.");
  }
  if (file.size > MAX_FILE_BYTES)
    throw new Error("File vượt quá giới hạn 20 MB.");

  const contents = await file.arrayBuffer();
  const workbook = XLSX.read(contents, { type: "array", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error("File không có worksheet.");

  const matrix = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const headers = (matrix[0] ?? []).map((header) => String(header).trim());
  const reportType = detectReport(headers);

  let rows: SourceRow[] = [];
  let firstDate: Date | null | undefined = null;

  if (reportType === "COGS") {
    // 2 header rows in Order Management
    for (let i = 2; i < matrix.length; i++) {
      const r = matrix[i] as unknown[];
      if (!r || !cleanText(r[7])) continue; // r[7] is Order ID
      const rowObj: SourceRow = {
        orderId: cleanText(r[7]),
        createDay: r[6],
        store: cleanText(r[9]),
        vendor: cleanText(r[26]) || "Amazon",
        orderAmount: r[35],
        orderStatus: cleanText(r[42]),
        paymentStatus: cleanText(r[43]),
        raw: r,
      };
      rows.push(rowObj);
      if (!firstDate && r[6]) {
        firstDate = parseDate(r[6]);
      }
    }
  } else if (reportType === "COGS_CLAIM") {
    // 2 header rows in Issue & Claim Management
    for (let i = 2; i < matrix.length; i++) {
      const r = matrix[i] as unknown[];
      if (!r || (!cleanText(r[1]) && !cleanText(r[3]))) continue;
      const rowObj: SourceRow = {
        ticketId: cleanText(r[1]),
        ticketDate: r[2],
        issuesOrderId: cleanText(r[3]),
        orderAmount: r[22],
        partnerShare: r[28],
        status: cleanText(r[31]),
        raw: r,
      };
      rows.push(rowObj);
      if (!firstDate && r[2]) {
        firstDate = parseDate(r[2]);
      }
    }
  } else {
    rows = XLSX.utils
      .sheet_to_json<SourceRow>(worksheet, { defval: null, raw: false })
      .filter((row) =>
        Object.values(row).some((value) => cleanText(value) !== null),
      );
    const dateColumn = reportType === "STATEMENTS" ? "Date" : "Sale Date";
    firstDate = rows.map((row) => parseDate(row[dateColumn])).find(Boolean);
  }

  if (!firstDate) {
    firstDate = new Date();
  }

  return {
    fileHash: sha256(contents),
    fileName: file.name,
    reportType,
    rows,
    sourceMonth: monthStart(firstDate),
  };
}
