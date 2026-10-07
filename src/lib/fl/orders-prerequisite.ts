import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { normalizeStoreName } from "@/lib/fl/cogs-parser/cogs-mapper";

/** Read current Orders on every validation and immediately before an Items write. */
export async function requireImportedOrders(
  rows: readonly { "Order ID": string; Store: string }[],
  spreadsheetId = "1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do",
): Promise<void> {
  if (!rows.length) return;
  const { accessToken } = await getGoogleDriveAccess();
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/RAW.Orders!A1:AK?valueRenderOption=UNFORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    },
  );
  if (!res.ok)
    throw new Error(`Không đọc được RAW.Orders (HTTP ${res.status}).`);
  const payload = (await res.json()) as { values?: unknown[][] };
  const matrix = payload.values ?? [];
  const header = (matrix[0] ?? []).map(String);
  const idCol = header.indexOf("Order ID"),
    storeCol = header.indexOf("Store");
  if (idCol < 0 || storeCol < 0)
    throw new Error("RAW.Orders thiếu header Order ID/Store.");
  const lookup = new Map<string, Set<string>>();
  for (const r of matrix.slice(1)) {
    const id = String(r[idCol] ?? "").trim();
    if (id)
      lookup.set(
        id,
        new Set([
          ...(lookup.get(id) ?? []),
          normalizeStoreName(String(r[storeCol] ?? "")),
        ]),
      );
  }
  const issues = new Set<string>();
  for (const row of rows) {
    const id = row["Order ID"].trim(),
      store = normalizeStoreName(row.Store);
    const found = lookup.get(id);
    if (!id || !found?.size)
      issues.add(`${id || "(trống)"} (${store}): chưa có Orders`);
    else if (found.size !== 1 || !found.has(store))
      issues.add(
        `${id}: Store Orders ${[...found].join(", ")} khác Items ${store}`,
      );
  }
  if (issues.size)
    throw new Error(
      `Cần import/sửa Orders trước. ${issues.size} đơn chưa hợp lệ: ${[...issues].join("; ")}.`,
    );
}
