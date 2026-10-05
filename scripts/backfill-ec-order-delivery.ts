import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ensureOrdersDeliveryHeaders,
  orderDeliveryValues,
} from "@/lib/ec/order-delivery-sheet";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { prisma } from "@/lib/prisma";
import { fetchShopifyOrdersFromApi } from "@/lib/shopify-raw-order-sync";

const spreadsheetId =
  process.env.EC_REPORT_SPREADSHEET_ID ||
  "19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8";
const apply = process.argv.includes("--apply");
let accessToken = "";
async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    },
  );
  if (!response.ok)
    throw new Error(`Sheets ${response.status}: ${await response.text()}`);
  return response;
}
async function readRows(): Promise<unknown[][]> {
  const payload = (await (
    await request(
      `/values/${encodeURIComponent("Orders!A2:V")}?valueRenderOption=UNFORMATTED_VALUE`,
    )
  ).json()) as { values?: unknown[][] };
  return payload.values || [];
}
function baseHash(rows: unknown[][]): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) => Array.from({ length: 13 }, (_, i) => row[i] ?? "")),
      ),
    )
    .digest("hex");
}
async function main(): Promise<void> {
  console.log("Reading Google OAuth connection...");
  accessToken = (await getGoogleDriveAccess()).accessToken;
  console.log("Reading Orders rows...");
  const original = await readRows();
  if (!original.length) throw new Error("Orders has no rows to backfill.");
  const dates = original.map((row) => String(row[3] || ""));
  if (dates.some((date) => !/^\d{4}-\d{2}-\d{2}$/.test(date)))
    throw new Error("Orders Date must use YYYY-MM-DD; no changes written.");
  dates.sort();
  const from = new Date(`${dates[0]}T00:00:00+07:00`);
  const to = new Date(
    new Date(`${dates[dates.length - 1]}T00:00:00+07:00`).getTime() +
      86_400_000,
  );
  console.log(
    `Fetching Shopify orders for ${dates[0]} through ${dates[dates.length - 1]} (${original.length} sheet rows)...`,
  );
  const orders = await fetchShopifyOrdersFromApi({ from, to }, (count) => {
    if (count % 500 === 0) console.log(`Fetched ${count} Shopify orders...`);
  });
  const byName = new Map(orders.map((order) => [order.name, order]));
  const values = original.map((row) => {
    const order = byName.get(String(row[2]));
    if (!order)
      throw new Error(
        "An Orders row has no matching Shopify order; no changes written.",
      );
    return orderDeliveryValues(order);
  });
  const report = {
    mode: apply ? "apply" : "preview",
    sheetRows: original.length,
    fetchedOrders: orders.length,
    deliveredRows: values.filter((row) => row[5].trim()).length,
    from: dates[0],
    through: dates[dates.length - 1],
  };
  console.log(JSON.stringify(report));
  if (!apply) return;
  const backup = join(tmpdir(), `ec-order-delivery-backup-${Date.now()}.json`);
  await writeFile(backup, JSON.stringify({ spreadsheetId, rows: original }), {
    mode: 0o600,
  });
  if (baseHash(await readRows()) !== baseHash(original))
    throw new Error("Orders changed while fetching Shopify. Retry backfill.");
  await ensureOrdersDeliveryHeaders(request);
  const data = [];
  for (let offset = 0; offset < values.length; offset += 1000) {
    data.push({
      range: `Orders!N${offset + 2}:V${Math.min(offset + 1000, values.length) + 1}`,
      values: values.slice(offset, offset + 1000),
    });
  }
  await request("/values:batchUpdate", {
    method: "POST",
    body: JSON.stringify({ valueInputOption: "RAW", data }),
  });
  const verified = await readRows();
  if (baseHash(verified) !== baseHash(original))
    throw new Error(
      "Orders A:M changed during backfill; inspect sheet before retry.",
    );
  if (
    JSON.stringify(
      verified.map((row) =>
        Array.from({ length: 9 }, (_, i) => row[i + 13] ?? ""),
      ),
    ) !== JSON.stringify(values)
  )
    throw new Error("Delivery readback differs from written values.");
  console.log(
    JSON.stringify({
      verified: true,
      unchangedAccountingColumns: true,
      backup,
    }),
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Backfill failed");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
