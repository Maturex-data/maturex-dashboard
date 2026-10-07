import { createHash } from "node:crypto";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import {
  fetchPhucPrintifyOrders,
  validatePrintifyRange,
} from "@/lib/fl/printify/client";
import {
  mapPrintifyOrder,
  PHUC_PRINTIFY_COGS_HEADERS,
  type PrintifySyncOptions,
  type PrintifySyncResult,
} from "@/lib/fl/printify/types";
import { prisma } from "@/lib/prisma";

const snapshot = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export async function syncPhucPrintify(
  options?: PrintifySyncOptions,
): Promise<PrintifySyncResult> {
  validatePrintifyRange(options);
  const spreadsheetId = process.env.PHUC_COGS_SPREADSHEET_ID?.trim(),
    sheetId = Number(process.env.PHUC_COGS_SHEET_ID);
  if (
    !spreadsheetId ||
    !Number.isSafeInteger(sheetId) ||
    !process.env.PHUC_COGS_SHEET_ID
  )
    throw Error("Thiếu cấu hình Sheet COGS Team Phúc.");
  const { accessToken } = await getGoogleDriveAccess();
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const request = async (path: string, body?: unknown) => {
    const r = await fetch(base + path, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(25000),
    });
    if (!r.ok)
      throw Error(`Không truy cập được Sheet Team Phúc (HTTP ${r.status}).`);
    return r.json();
  };
  const read = async (): Promise<unknown[][]> => {
    const p = await request("/values/RAW.COGS!A1:X?valueRenderOption=FORMULA");
    const matrix = p.values ?? [];
    if (!PHUC_PRINTIFY_COGS_HEADERS.every((h, i) => matrix[2]?.[i] === h))
      throw Error("Header RAW.COGS Team Phúc khác cấu trúc 24 cột đã chốt.");
    return matrix;
  };
  // Check destination before fetching all provider orders.
  await read();
  const orders = await fetchPhucPrintifyOrders();
  const selected = orders.filter((order) => {
    const time = Date.parse(order.created_at.replace(" ", "T"));
    if (!Number.isFinite(time)) throw Error("Ngày đơn Printify không hợp lệ.");
    return (
      (!options?.fromDate || time >= Date.parse(options.fromDate)) &&
      (!options?.toDate || time <= Date.parse(options.toDate))
    );
  });
  const incoming = selected.map(mapPrintifyOrder);
  return prisma.$transaction(
    async (tx) => {
      const lockKey = `ecombius-printify-${spreadsheetId}-${sheetId}`;
      const locks = await tx.$queryRaw<
        { locked: boolean }[]
      >`SELECT pg_try_advisory_xact_lock(hashtext(${lockKey})) AS locked`;
      if (!locks[0]?.locked)
        throw Error("Một phiên đồng bộ Printify đang chạy. Vui lòng đợi.");
      const before = await read();
      const text = (value: unknown) => (value == null ? "" : String(value));
      const indexes = new Map<string, number>();
      before.slice(3).forEach((row, index) => {
        if (text(row[3]).trim().toUpperCase() !== "PRINTIFY") return;
        const id = text(row[1]).trim();
        if (!id || indexes.has(id))
          throw Error("RAW.COGS có mã Printify trống hoặc trùng.");
        indexes.set(id, index + 4);
      });
      let nextRow = Math.max(4, before.length + 1);
      const result: PrintifySyncResult = {
        totalFetched: orders.length,
        selectedCount: selected.length,
        insertedCount: 0,
        updatedCount: 0,
        skippedCount: 0,
      };
      const data: { range: string; values: (string | number)[][] }[] = [];
      const expected: { row: number; cells: (string | number)[] }[] = [];
      const updatedColumns = new Map<number, Set<number>>();
      for (const row of incoming) {
        const existing = indexes.get(text(row[1]));
        if (!existing) {
          data.push({
            range: `RAW.COGS!A${nextRow}:X${nextRow}`,
            values: [row],
          });
          expected.push({ row: nextRow, cells: row });
          nextRow++;
          result.insertedCount++;
          continue;
        }
        const cells = [...row];
        // Preserve mappings and unsupported historical fields; only write changed API cells.
        for (const column of [0, 2, 6, 10, 11])
          cells[column] = (before[existing - 1]?.[column] ?? "") as
            | string
            | number;
        const columns = new Set<number>();
        for (let column = 0; column < 24; column++) {
          if (text(cells[column]) === text(before[existing - 1]?.[column]))
            continue;
          if (cells[column] === "" && row[column] === "") continue;
          data.push({
            range: `RAW.COGS!${String.fromCharCode(65 + column)}${existing}`,
            values: [[cells[column]]],
          });
          columns.add(column);
        }
        if (columns.size) {
          updatedColumns.set(existing, columns);
          expected.push({
            row: existing,
            cells: cells.map((value, column) =>
              columns.has(column)
                ? value
                : ((before[existing - 1]?.[column] ?? "") as string | number),
            ),
          });
          result.updatedCount++;
        } else result.skippedCount++;
      }
      if (!data.length) return result;
      const meta = await request(
        "?fields=sheets.properties(sheetId,title,gridProperties.rowCount)",
      );
      const target = meta.sheets.find(
        (s: { properties: { sheetId: number } }) =>
          s.properties.sheetId === sheetId,
      )?.properties;
      if (target?.title !== "RAW.COGS")
        throw Error("Tab RAW.COGS không khớp gid cấu hình.");
      if (target.gridProperties.rowCount < nextRow - 1)
        await request(":batchUpdate", {
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId,
                  gridProperties: { rowCount: nextRow + 50 },
                },
                fields: "gridProperties.rowCount",
              },
            },
          ],
        });
      if (snapshot(await read()) !== snapshot(before))
        throw Error("Sheet đã thay đổi trong lúc đồng bộ. Hãy chạy lại.");
      // RAW preserves phone numbers, postal codes, leading zeros and literal user content.
      await request("/values:batchUpdate", { valueInputOption: "RAW", data });
      const after = await read();
      for (const entry of expected)
        if (
          !entry.cells.every(
            (value, column) =>
              text(value) === text(after[entry.row - 1]?.[column]),
          )
        )
          throw Error(
            "Đã gửi ghi nhưng xác minh chưa khớp; kiểm tra Sheet trước khi chạy lại.",
          );
      for (let i = 0; i < before.length; i++)
        for (let column = 0; column < 24; column++) {
          if (updatedColumns.get(i + 1)?.has(column)) continue;
          if (text(before[i]?.[column]) !== text(after[i]?.[column]))
            throw Error(
              "Phát hiện thay đổi ngoài phạm vi Printify. Kiểm tra Sheet.",
            );
        }
      return result;
    },
    { timeout: 120000, maxWait: 5000 },
  );
}
