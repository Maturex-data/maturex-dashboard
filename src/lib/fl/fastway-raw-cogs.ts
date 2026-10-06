import { createHash } from "node:crypto";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { RAW_COGS_HEADERS } from "@/lib/fl/cogs-parser/types";
import type { FastwayOrderItem } from "@/lib/fl/fastway-sync";
import { prisma } from "@/lib/prisma";

const BASE =
  "https://sheets.googleapis.com/v4/spreadsheets/1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do";
const cell = (v: unknown) => String(v ?? "").trim();
function money(v: unknown): string | number {
  if (v === undefined || v === null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n) || typeof v === "boolean")
    throw Error("Chi phí Fastway không hợp lệ.");
  return Number(n.toFixed(2));
}
export async function syncFastwayRawCogs(orders: FastwayOrderItem[]) {
  return prisma.$transaction(
    async (tx) => {
      const locks = await tx.$queryRaw<
        Array<{ locked: boolean }>
      >`SELECT pg_try_advisory_xact_lock(hashtext('ecombius-linh-raw-cogs')) AS locked`;
      if (!locks[0]?.locked) throw Error("Có tiến trình COGS khác đang chạy.");
      const { accessToken } = await getGoogleDriveAccess();
      async function request(path: string, init: RequestInit = {}) {
        const r = await fetch(BASE + path, {
          ...init,
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          signal: AbortSignal.timeout(20000),
        });
        if (!r.ok) throw Error(`Google Sheets HTTP ${r.status}`);
        return r.json();
      }
      const read = () =>
        request(
          "/values:batchGet?ranges=RAW.COGS!A2:N&ranges=RAW.Orders!A1:AK&valueRenderOption=FORMULA",
        );
      const before = await read();
      const all: unknown[][] = before.valueRanges[0].values ?? [],
        rows = all.slice(1);
      if (!RAW_COGS_HEADERS.every((h, i) => all[0]?.[i] === h))
        throw Error("Header RAW.COGS không khớp.");
      const orderRows: unknown[][] = before.valueRanges[1].values ?? [],
        h = (orderRows[0] ?? []).map(String),
        oi = h.indexOf("Order ID"),
        si = h.indexOf("Store");
      const existing = new Map<string, number>();
      for (let i = 0; i < rows.length; i++)
        if (cell(rows[i][3]).toUpperCase() === "FASTWAY") {
          const id = cell(rows[i][1]);
          if (!id) throw Error("Dòng Fastway cũ thiếu Supplier Order ID.");
          if (existing.has(id))
            throw Error(`Trùng Supplier Order ID trên COGS: ${id}`);
          existing.set(id, i);
        }
      const incoming = new Map<string, FastwayOrderItem>();
      for (const o of orders) {
        const id = cell(o.exOrderId);
        if (!id) throw Error("Fastway thiếu exOrderId; chưa ghi dữ liệu.");
        if (
          incoming.has(id) &&
          JSON.stringify(incoming.get(id)) !== JSON.stringify(o)
        )
          throw Error(`Fastway trả trùng mã khác dữ liệu: ${id}`);
        incoming.set(id, o);
      }
      const data: Array<{ range: string; values: (string | number)[][] }> = [];
      const expected = rows.map((r) =>
        Array.from({ length: 14 }, (_, i) => (r[i] ?? "") as string | number),
      );
      let insertedCount = 0,
        updatedCount = 0,
        skippedCount = orders.length - incoming.size,
        missingStoreCount = 0;
      for (const [id, o] of incoming) {
        const index = existing.get(id),
          old = index === undefined ? undefined : expected[index];
        const next = old ? [...old] : Array<string | number>(14).fill("");
        next[0] = "";
        next[1] = id;
        next[3] = "FASTWAY";
        const reference = cell(o.orderName).replace(/-replace$/i, "");
        const stores = new Set(
          oi >= 0 && si >= 0
            ? orderRows
                .slice(1)
                .filter((r) => cell(r[oi]) === reference)
                .map((r) => cell(r[si]))
                .filter(Boolean)
            : [],
        );
        if (stores.size === 1) next[2] = [...stores][0];
        if (!next[2]) missingStoreCount++;
        const date = cell(o.createdAt);
        if (!date || Number.isNaN(Date.parse(date)))
          throw Error(`Fastway ${id} thiếu ngày hợp lệ.`);
        next[4] = date;
        next[5] = cell(o.status);
        for (const [col, value] of [
          [8, o.shippingFee],
          [9, o.taxFee],
          [11, o.totalFee ?? o.orderPrice],
        ] as const) {
          const n = money(value);
          if (n !== "") next[col] = n;
        }
        if (next[11] === "") throw Error(`Fastway ${id} thiếu tổng chi phí.`);
        if (old?.every((v, i) => String(v) === String(next[i]))) {
          skippedCount++;
          continue;
        }
        const rowIndex = index ?? expected.length;
        if (old) {
          for (const col of [0, 1, 2, 3, 4, 5, 8, 9, 11]) {
            if (String(old[col]) !== String(next[col]))
              data.push({
                range: `RAW.COGS!${String.fromCharCode(65 + col)}${rowIndex + 3}`,
                values: [[next[col]]],
              });
          }
        } else
          data.push({
            range: `RAW.COGS!A${rowIndex + 3}:N${rowIndex + 3}`,
            values: [next],
          });
        if (index === undefined) {
          expected.push(next);
          insertedCount++;
        } else {
          expected[index] = next;
          updatedCount++;
        }
      }
      if (data.length) {
        const hash = (v: unknown) =>
          createHash("sha256").update(JSON.stringify(v)).digest("hex");
        if (hash(await read()) !== hash(before))
          throw Error("Sheet thay đổi; chạy lại sync.");
        const meta = await request(
          "?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))",
        );
        const target = meta.sheets.find(
          (s: { properties: { sheetId: number } }) =>
            s.properties.sheetId === 58221536,
        )?.properties;
        if (target?.title !== "RAW.COGS") throw Error("Sai tab COGS.");
        if (target.gridProperties.rowCount < expected.length + 2)
          await request(":batchUpdate", {
            method: "POST",
            body: JSON.stringify({
              requests: [
                {
                  updateSheetProperties: {
                    properties: {
                      sheetId: 58221536,
                      gridProperties: { rowCount: expected.length + 52 },
                    },
                    fields: "gridProperties.rowCount",
                  },
                },
              ],
            }),
          });
        if (hash(await read()) !== hash(before))
          throw Error("Sheet thay đổi trước khi ghi.");
        await request("/values:batchUpdate", {
          method: "POST",
          body: JSON.stringify({ valueInputOption: "RAW", data }),
        });
        const after = await read();
        const actual: unknown[][] = after.valueRanges[0].values?.slice(1) ?? [];
        if (
          actual.length !== expected.length ||
          expected.some((r, i) =>
            r.some((v, j) => String(v) !== String(actual[i]?.[j] ?? "")),
          )
        )
          throw Error(
            "Đã gửi ghi nhưng xác minh thất bại; kiểm tra Sheet trước khi chạy lại.",
          );
      }
      return {
        insertedCount,
        updatedCount,
        skippedCount,
        missingStoreCount,
        upserted: insertedCount + updatedCount,
      };
    },
    { timeout: 120000, maxWait: 5000 },
  );
}
