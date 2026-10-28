import { prisma } from "@/lib/prisma";
import { ETSY_SHOPS, normalizeShopCode, SHOPS_MAP } from "../etsy-constants";
import {
  type DashboardReport,
  hash,
  mapDashboardRows,
  type RawBoRow,
  REPORTS,
  sheetDate,
} from "./mapping";

/** Mirror verified BO Sheet rows to the database used by the ECOMBIUS dashboard. */
export async function syncBoRowsToDashboard(
  type: DashboardReport,
  rows: RawBoRow[],
  source: string,
) {
  const groups = new Map<string, RawBoRow[]>();
  for (const row of rows) {
    const code = SHOPS_MAP[normalizeShopCode(String(row.Store ?? ""))];
    if (!code) throw Error("Unknown Store in BO dashboard sync.");
    const date = sheetDate(row[REPORTS[type].date]);
    if (!date) throw Error("Invalid BO dashboard date.");
    const key = `${code}:${date.slice(0, 7)}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  let synced = 0;
  for (const [key, group] of groups) {
    const [code, month] = key.split(":");
    const catalog = ETSY_SHOPS.find((s) => s.code === code);
    if (!catalog) throw Error("Inactive dashboard shop.");
    await prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`ecombius-dashboard:${key}:${type}`}))`;
        const shop = await tx.etsyShop.upsert({
          where: { code },
          create: { code, name: catalog.name, active: true },
          update: { name: catalog.name },
        });
        const fingerprint = hash(JSON.stringify(group));
        const batch = await tx.etsyImportBatch.upsert({
          where: {
            shopId_reportType_fileHash: {
              shopId: shop.id,
              reportType: REPORTS[type].report,
              fileHash: fingerprint,
            },
          },
          create: {
            shopId: shop.id,
            reportType: REPORTS[type].report,
            fileHash: fingerprint,
            sourceFileName: source,
            sourceMonth: new Date(`${month}-01T00:00:00Z`),
            status: "PROCESSING",
          },
          update: { status: "PROCESSING", sourceFileName: source },
        });
        const mapped = mapDashboardRows(type, group, shop.id, batch.id);
        const table = REPORTS[type].table;
        const keys =
          type === "orders"
            ? ["shop_id", "order_id"]
            : ["shop_id", "source_key"];
        const columns = Object.keys(mapped[0]);
        const updates = columns.filter(
          (c) => !["id", "created_at", ...keys].includes(c),
        );
        for (let start = 0; start < mapped.length; start += 250) {
          const columnSql = columns.map((c) => `"${c}"`).join(",");
          // Table/column identifiers come exclusively from the fixed report contract above.
          await tx.$executeRawUnsafe(
            `INSERT INTO "${table}" (${columnSql}) SELECT ${columnSql} FROM json_populate_recordset(NULL::"${table}", $1::json) ON CONFLICT (${keys.map((c) => `"${c}"`).join(",")}) DO UPDATE SET ${updates.map((c) => `"${c}"=EXCLUDED."${c}"`).join(",")}`,
            JSON.stringify(mapped.slice(start, start + 250)),
          );
        }
        if (type === "statements") {
          const from = new Date(`${month}-01T00:00:00Z`);
          const until = new Date(
            Date.UTC(from.getUTCFullYear(), from.getUTCMonth() + 1, 1),
          );
          await tx.etsyStatement.deleteMany({
            where: {
              shopId: shop.id,
              importBatch: { sourceFileName: source },
              statementDate: { gte: from, lt: until },
              sourceKey: { notIn: mapped.map((row) => String(row.source_key)) },
            },
          });
        }
        if (type === "items")
          await tx.$executeRaw`UPDATE etsy_order_items i SET etsy_order_id=o.id, match_status='MATCHED' FROM etsy_orders o WHERE i.shop_id=${shop.id} AND o.shop_id=i.shop_id AND o.order_id=i.order_id AND i.import_batch_id=${batch.id}`;
        await tx.etsyImportBatch.update({
          where: { id: batch.id },
          data: {
            status: "COMPLETED",
            totalRows: group.length,
            completedAt: new Date(),
          },
        });
      },
      { timeout: 60000, maxWait: 10000 },
    );
    synced += group.length;
  }
  return { syncedRows: synced, shopMonths: [...groups.keys()] };
}
