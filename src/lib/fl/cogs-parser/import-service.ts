import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { prisma } from "@/lib/prisma";
import { mapEquarusOrdersToCogs, normalizeStoreName } from "./cogs-mapper";
import { parseEquarusWorkbook } from "./equarus-parser";
import { COMPARED_COLUMNS, planCogs, snapshotHash } from "./import-plan";
import { RAW_COGS_HEADERS } from "./types";

const BASE =
  "https://sheets.googleapis.com/v4/spreadsheets/1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do";
const secret = () => {
  const key = process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY;
  if (!key) throw Error("Thiếu khóa ký preview.");
  return key;
};
function sign(value: string) {
  return createHmac("sha256", secret()).update(value).digest("hex");
}
export function makePreviewToken(snapshot: string, file: Buffer) {
  const data = JSON.stringify({
    snapshot,
    file: createHash("sha256").update(file).digest("hex"),
    expires: Date.now() + 30 * 60_000,
  });
  return `${Buffer.from(data).toString("base64url")}.${sign(data)}`;
}
export function checkPreviewToken(
  token: string,
  snapshot: string,
  file: Buffer,
) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature)
    throw Error("Cần kiểm tra preview trước khi ghi.");
  const data = Buffer.from(encoded, "base64url").toString();
  const actual = Buffer.from(signature);
  const expected = Buffer.from(sign(data));
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw Error("Preview không hợp lệ.");
  const p = JSON.parse(data);
  if (
    p.expires < Date.now() ||
    p.snapshot !== snapshot ||
    p.file !== createHash("sha256").update(file).digest("hex")
  )
    throw Error("File hoặc Sheet đã thay đổi; hãy tạo lại preview.");
}
export async function prepareCogs(file: Buffer, fileName: string) {
  const { accessToken } = await getGoogleDriveAccess();
  const request = async (path: string, init?: RequestInit) => {
    const res = await fetch(BASE + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) throw Error(`Google Sheet HTTP ${res.status}`);
    return res.json();
  };
  const read = async () => {
    const p = await request(
      "/values:batchGet?ranges=RAW.Orders!A1:AK&ranges=RAW.COGS!A2:N&valueRenderOption=FORMULA",
    );
    const orders = (p.valueRanges[0].values ?? []) as unknown[][];
    const all = (p.valueRanges[1].values ?? []) as unknown[][];
    if (!RAW_COGS_HEADERS.every((h, i) => all[0]?.[i] === h))
      throw Error("Header RAW.COGS thay đổi.");
    const header = orders[0]?.map(String) ?? [];
    if (!header.includes("Order ID") || !header.includes("Store"))
      throw Error("RAW.Orders thiếu Order ID/Store.");
    return { orders, cogs: all.slice(1) };
  };
  const state = await read();
  const lookup = new Map<string, Set<string>>();
  const oh = state.orders[0].map(String);
  for (const r of state.orders.slice(1)) {
    const id = String(r[oh.indexOf("Order ID")] ?? "").trim();
    const store = normalizeStoreName(String(r[oh.indexOf("Store")] ?? ""));
    if (id && store)
      lookup.set(id, new Set([...(lookup.get(id) ?? []), store]));
  }
  const parsed = parseEquarusWorkbook(file);
  if (!parsed.orderRows.length) throw Error("File không có đơn COGS.");
  const mapped = mapEquarusOrdersToCogs(
    parsed.orderRows,
    parsed.paymentSummaries,
    { fileName, fileSizeBytes: file.length, ordersLookup: lookup },
  );
  const plan = planCogs(mapped.rows, state.cogs);
  mapped.summary.alreadyInCogsCount = plan.decisions.filter(
    (d) => d.kind === "CHANGED" || d.kind === "UNCHANGED",
  ).length;
  mapped.summary.identicalCostCount = plan.decisions.filter(
    (d) => d.kind === "UNCHANGED",
  ).length;
  mapped.summary.diffCostCount = plan.decisions.filter(
    (d) => d.kind === "CHANGED",
  ).length;
  mapped.existingComparisons = plan.decisions
    .filter((d) => d.kind !== "CONFLICT")
    .map((d) => ({
      orderId: d.orderId,
      store: String(d.row[2]),
      sourceAmount: Number(d.row[11]),
      existingCost: d.sheetRow
        ? Number(state.cogs[d.sheetRow - 3]?.[11] ?? 0)
        : 0,
      difference: d.sheetRow
        ? Number(state.cogs[d.sheetRow - 3]?.[11] ?? 0) - Number(d.row[11])
        : 0,
      status:
        d.kind === "UNCHANGED"
          ? "IDENTICAL"
          : d.kind === "CHANGED"
            ? "DIFF_COST"
            : "NOT_IN_COGS",
    }));
  const snapshot = snapshotHash(state.orders, state.cogs);
  const blocked =
    mapped.summary.unmappedCount +
    mapped.summary.conflictCount +
    mapped.summary.outOfScopeCount +
    mapped.summary.mathDiscrepanciesCount +
    plan.decisions.filter((d) => d.kind === "CONFLICT").length;
  // Payment discrepancy remains a blocker until business policy is approved.
  const paymentBlocked = parsed.paymentSummaries.some(
    (p) => Math.abs(p.difference) >= 0.01,
  );
  return {
    mapped,
    plan,
    state,
    snapshot,
    read,
    request,
    blocked: blocked + (paymentBlocked ? 1 : 0),
  };
}
export async function importCogs(
  file: Buffer,
  name: string,
  token: string,
  _approved: string[],
) {
  return prisma.$transaction(
    async (tx) => {
      const locks = await tx.$queryRaw<
        Array<{ locked: boolean }>
      >`SELECT pg_try_advisory_xact_lock(hashtext('ecombius-linh-raw-cogs')) AS locked`;
      if (!locks[0]?.locked)
        throw Error("Một phiên import COGS đang chạy. Hãy thử lại sau.");
      const p = await prepareCogs(file, name);
      checkPreviewToken(token, p.snapshot, file);
      if (p.blocked)
        throw Error(
          "Preview có lỗi mapping/xung đột hoặc chênh lệch payment chưa được duyệt.",
        );
      return applyCogs(
        p,
        p.plan.decisions.filter((d) => d.kind === "CHANGED").map((d) => d.key),
      );
    },
    { timeout: 120_000, maxWait: 5000 },
  );
}

export async function applyCogs(
  p: Awaited<ReturnType<typeof prepareCogs>>,
  approved: string[],
) {
  if (p.blocked)
    throw Error("Preview còn lỗi hoặc chênh lệch payment chưa được duyệt.");
  const changed = new Set(
    p.plan.decisions.filter((d) => d.kind === "CHANGED").map((d) => d.key),
  );
  if (approved.some((k) => !changed.has(k)))
    throw Error("Danh sách duyệt không hợp lệ.");
  const data: Array<{ range: string; values: (string | number)[][] }> = [];
  let insertedCount = 0,
    updatedCount = 0,
    skippedCount =
      p.plan.duplicateCount + (p.mapped.summary.skippedOrdersCount ?? 0);
  let nextRow = p.state.cogs.length + 3;
  for (const d of p.plan.decisions) {
    if (d.kind === "NEW") {
      data.push({
        range: `RAW.COGS!A${nextRow}:N${nextRow}`,
        values: [d.row],
      });
      nextRow++;
      insertedCount++;
    } else if (d.kind === "CHANGED" && approved.includes(d.key)) {
      for (const col of COMPARED_COLUMNS)
        data.push({
          range: `RAW.COGS!${String.fromCharCode(65 + col)}${d.sheetRow}`,
          values: [[d.row[col]]],
        });
      updatedCount++;
    } else skippedCount++;
  }
  if (!data.length)
    return {
      insertedCount,
      updatedCount,
      skippedCount,
      conflictCount: 0,
      totalSheetRows: p.state.cogs.length,
      message: p.plan.decisions.some((d) => d.kind === "CHANGED")
        ? "Không có cập nhật được duyệt."
        : "Dữ liệu đã có, không cần cập nhật.",
    };
  const fresh = await p.read();
  if (snapshotHash(fresh.orders, fresh.cogs) !== p.snapshot)
    throw Error("Sheet đã thay đổi; hãy tạo lại preview.");
  if (insertedCount) {
    const metadata = await p.request(
      "?fields=sheets.properties(sheetId,title,gridProperties.rowCount)",
    );
    const target = metadata.sheets.find(
      (s: { properties: { sheetId: number } }) =>
        s.properties.sheetId === 58221536,
    )?.properties;
    if (!target || target.title !== "RAW.COGS")
      throw Error("Tab COGS đích không đúng gid.");
    if (target.gridProperties.rowCount < nextRow - 1)
      await p.request(":batchUpdate", {
        method: "POST",
        body: JSON.stringify({
          requests: [
            {
              updateSheetProperties: {
                properties: {
                  sheetId: 58221536,
                  gridProperties: { rowCount: nextRow + 50 },
                },
                fields: "gridProperties.rowCount",
              },
            },
          ],
        }),
      });
    const beforeWrite = await p.read();
    if (snapshotHash(beforeWrite.orders, beforeWrite.cogs) !== p.snapshot)
      throw Error("Sheet đã thay đổi; hãy tạo lại preview.");
  }
  await p.request("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
  const after = await p.read();
  for (const d of p.plan.decisions.filter(
    (d) =>
      d.kind === "NEW" || (d.kind === "CHANGED" && approved.includes(d.key)),
  )) {
    const matches = planCogs(
      [
        Object.fromEntries(
          RAW_COGS_HEADERS.map((h, i) => [h, d.row[i]]),
        ) as (typeof p.mapped.rows)[number],
      ],
      after.cogs,
    ).decisions;
    if (matches[0]?.kind !== "UNCHANGED")
      throw Error(
        "Đã gửi ghi nhưng xác minh thất bại. Tạo lại preview trước khi thử lại.",
      );
  }
  // Verify all existing cells outside approved source columns remain intact.
  const updatedRows = new Set(
    p.plan.decisions
      .filter((d) => d.kind === "CHANGED" && approved.includes(d.key))
      .map((d) => (d.sheetRow ?? 0) - 3),
  );
  for (let i = 0; i < p.state.cogs.length; i++)
    for (let c = 0; c < 14; c++) {
      if (
        updatedRows.has(i) &&
        (COMPARED_COLUMNS as readonly number[]).includes(c)
      )
        continue;
      if (
        String(p.state.cogs[i]?.[c] ?? "") !== String(after.cogs[i]?.[c] ?? "")
      )
        throw Error(
          "Đã gửi ghi nhưng phát hiện thay đổi ngoài phạm vi. Kiểm tra Sheet trước khi thử lại.",
        );
    }
  return {
    insertedCount,
    updatedCount,
    skippedCount,
    conflictCount: 0,
    totalSheetRows: after.cogs.length,
  };
}
