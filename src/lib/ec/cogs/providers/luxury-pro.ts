import { formatVietnamDate } from "@/lib/date-time";
import {
  amount,
  type CogsRow,
  type DateRange,
  fetchWithTimeout,
  makeRow,
  type ProgressReporter,
  text,
  validDate,
} from "../types";

export function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"' && line[index + 1] === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      result.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  result.push(current.trim());
  return result;
}

export async function fetchLuxuryPro(
  range: DateRange,
  report?: ProgressReporter,
): Promise<CogsRow[]> {
  const sheetId =
    process.env.LUXURY_PRO_SHEET_ID ||
    "1zRpn7RyV2YIg20GwYKBQAORP_cRswRwbNjsoHaAY3Oc";
  const gid = process.env.LUXURY_PRO_SHEET_GID || "1578872519";
  const response = await fetchWithTimeout(
    `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
  );
  if (!response.ok)
    throw new Error(`Luxury Pro Google Sheet ${response.status}`);
  const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = parseCsvLine(lines[0]).map((header) =>
    header.toLowerCase().replace(/[^a-z0-9]+/g, "_"),
  );
  let lastValidDate: Date | null = null;
  const rows = lines
    .slice(1)
    .flatMap((line, index) => {
      const values = parseCsvLine(line);
      const row = Object.fromEntries(
        headers.map((header, headerIndex) => [
          header,
          values[headerIndex] || "",
        ]),
      );
      const rawDate = text(row.date || row.created_at || row.order_date);
      const explicitDate = validDate(rawDate);
      if (explicitDate) lastValidDate = explicitDate;

      // Luxury Pro merges the Date cell for detail rows, leaving the
      // continuation rows blank. A non-empty, non-date value (for example
      // 26ECC001) identifies a subtotal row and must not be counted as COGS.
      if (rawDate && !explicitDate) return [];

      const sourceDate = explicitDate ?? lastValidDate;
      if (!sourceDate) return [];
      const quantity = amount(row.quantity) || 1;
      const total = amount(row.price) * quantity + amount(row.other_fee);
      const payload = {
        ...row,
        _resolved_date: formatVietnamDate(sourceDate),
        _date_inherited: explicitDate === null,
      };
      return [
        makeRow(
          "Luxury Pro",
          text(row.tracking_number) || text(row.order_number) || `${index + 2}`,
          sourceDate,
          row.reference_order_id ||
            row.order_id ||
            row.shopify_order ||
            row.order_number ||
            row.order,
          row.supplier_order_id ||
            row.external_order_id ||
            row.tracking_number ||
            row.id,
          total,
          total,
          `${text(row.sku) || "no-sku"}:${index}`,
          payload,
        ),
      ];
    })
    .filter((row) => row.date >= range.from && row.date < range.to);
  await report?.({
    pagesProcessed: 1,
    totalPages: 1,
    rowsFetched: rows.length,
    checkpoint: { row: lines.length - 1 },
  });
  return rows;
}
