import { createHash } from "node:crypto";
import { isLinhShop } from "@/lib/fl/bo-import-config";
import { normalizeStoreName } from "./cogs-mapper";
import { type MappedCogsRow, RAW_COGS_HEADERS } from "./types";

export const COMPARED_COLUMNS = [4, 5, 7, 8, 11] as const;
export interface CogsChange {
  column: string;
  before: string | number;
  after: string | number;
}
export interface CogsDecision {
  key: string;
  orderId: string;
  kind: "NEW" | "UNCHANGED" | "CHANGED" | "CONFLICT";
  row: (string | number)[];
  sheetRow?: number;
  changes: CogsChange[];
  message?: string;
}
export function cogsKey(row: unknown[]): string {
  const parts = [
    normalizeStoreName(String(row[2] ?? "")),
    String(row[3] ?? "")
      .trim()
      .toUpperCase(),
    String(row[0] ?? "").trim(),
  ];
  return parts.every(Boolean) ? JSON.stringify(parts) : "";
}
export function comparable(value: unknown, column: number): string {
  const text = String(value ?? "").trim();
  if (!text) return "";
  if ([7, 8, 11].includes(column)) {
    if (!/^-?\d+(?:\.\d*)?$/.test(text))
      throw new Error(`Chi phí không hợp lệ: ${text || "trống"}`);
    const [whole, fraction = ""] = text.split(".");
    return `${BigInt(whole).toString()}${whole.startsWith("-") && BigInt(whole) === BigInt(0) ? "-" : ""}.${fraction.replace(/0+$/, "")}`;
  }
  if (column === 4) {
    const match = text.match(/^(\d{4}-\d{2}-\d{2})(?:[ T]00:00:00(?:Z)?)?$/);
    if (
      !match ||
      Number.isNaN(Date.parse(match[1])) ||
      new Date(match[1]).toISOString().slice(0, 10) !== match[1]
    )
      throw new Error("Ngày nguồn không hợp lệ.");
    return match[1];
  }
  return text;
}
export function planCogs(
  rows: MappedCogsRow[],
  existing: unknown[][],
): { decisions: CogsDecision[]; duplicateCount: number } {
  const indexes = new Map<string, number[]>();
  existing.forEach((r, i) => {
    const key = cogsKey(r);
    if (key) indexes.set(key, [...(indexes.get(key) ?? []), i]);
  });
  const incoming = new Map<string, CogsDecision>();
  let duplicateCount = 0;
  for (const mapped of rows) {
    const row = RAW_COGS_HEADERS.map((h) => mapped[h] ?? "") as (
      | string
      | number
    )[];
    const key = cogsKey(row);
    const decision: CogsDecision = {
      key,
      orderId: String(row[0]),
      kind: "NEW",
      row,
      changes: [],
    };
    try {
      if (!String(row[2] ?? "").trim())
        throw Error(
          "Chưa có Store: không tìm thấy đơn trong RAW.Orders. Cần import Orders tương ứng trước.",
        );
      if (!key || !isLinhShop(normalizeStoreName(String(row[2]))))
        throw Error("Thiếu khóa hoặc Store ngoài phạm vi 97Decor và Timond.");
      COMPARED_COLUMNS.forEach((c) => {
        if (String(row[c] ?? "").trim() === "")
          throw Error("Thiếu dữ liệu nguồn bắt buộc.");
        comparable(row[c], c);
      });
      const previous = incoming.get(key);
      if (previous) {
        duplicateCount++;
        if (
          COMPARED_COLUMNS.some(
            (c) => comparable(previous.row[c], c) !== comparable(row[c], c),
          )
        ) {
          previous.kind = "CONFLICT";
          previous.message = "Dòng upload cùng khóa nhưng khác dữ liệu.";
        }
        continue;
      }
      const matches = indexes.get(key) ?? [];
      if (matches.length > 1) throw Error("Sheet có nhiều dòng cùng khóa.");
      if (matches.length === 1) {
        decision.sheetRow = matches[0] + 3;
        const old = existing[matches[0]];
        decision.changes = COMPARED_COLUMNS.filter(
          (c) => comparable(old[c], c) !== comparable(row[c], c),
        ).map((c) => ({
          column: RAW_COGS_HEADERS[c],
          before: (old[c] ?? "") as string | number,
          after: row[c],
        }));
        decision.kind = decision.changes.length ? "CHANGED" : "UNCHANGED";
      }
    } catch (error) {
      decision.kind = "CONFLICT";
      decision.message =
        error instanceof Error ? error.message : "Dữ liệu không hợp lệ";
    }
    incoming.set(key || `invalid:${incoming.size}`, decision);
  }
  return { decisions: [...incoming.values()], duplicateCount };
}
export function snapshotHash(orders: unknown[][], cogs: unknown[][]): string {
  return createHash("sha256")
    .update(JSON.stringify({ orders, cogs }))
    .digest("hex");
}
