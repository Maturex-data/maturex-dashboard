import { createHash } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ensureOrdersDeliveryHeaders } from "@/lib/ec/order-delivery-sheet";
import { getGoogleDriveAccess } from "@/lib/ec-drive";
import { MICROM_SPREADSHEET_ID, ORDERS_COLUMNS } from "@/lib/microm/constants";
import { acquireMicromLock } from "@/lib/microm/lock-manager";
import { fetchMicromOrderDelivery } from "@/lib/microm/shopify-delivery";
import { prisma } from "@/lib/prisma";

const apply = process.argv.includes("--apply");
let accessToken = "";
async function request(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${MICROM_SPREADSHEET_ID}${path}`,
    {
      ...init,
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok)
    throw new Error(
      `Microm Sheets HTTP ${response.status}: ${await response.text()}`,
    );
  return response;
}
async function readRows(): Promise<unknown[][]> {
  const payload = (await (
    await request(
      `/values/${encodeURIComponent("Orders!A2:W")}?valueRenderOption=UNFORMATTED_VALUE`,
    )
  ).json()) as { values?: unknown[][] };
  return payload.values || [];
}
function accountingHash(rows: unknown[][]): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        rows.map((row) =>
          Array.from(
            { length: ORDERS_COLUMNS.length },
            (_, index) => row[index] ?? "",
          ),
        ),
      ),
    )
    .digest("hex");
}
async function main(): Promise<void> {
  const lock = await acquireMicromLock("microm_order_delivery_backfill");
  try {
    accessToken = (await getGoogleDriveAccess()).accessToken;
    const original = await readRows();
    if (!original.length)
      throw new Error("Microm Orders has no rows to backfill.");
    const ids = original.map((row) => String(row[1] || "").trim());
    if (ids.some((id) => !/^\d+$/.test(id)))
      throw new Error(
        "Microm Orders contains an invalid Shopify ID; no changes written.",
      );
    const mapping = await fetchMicromOrderDelivery(ids);
    const values = ids.map((id) => {
      const value = mapping.get(id);
      if (!value)
        throw new Error("Microm Shopify order not found; no changes written.");
      return value;
    });
    console.log(
      JSON.stringify({
        mode: apply ? "apply" : "preview",
        spreadsheetId: MICROM_SPREADSHEET_ID,
        rows: original.length,
        trackedRows: values.filter((row) => row[2].trim()).length,
        deliveredRows: values.filter((row) => row[5].trim()).length,
        shippedRows: values.filter((row) => row[6].trim()).length,
      }),
    );
    if (!apply) return;
    const backup = join(
      tmpdir(),
      `microm-order-delivery-backup-${Date.now()}.json`,
    );
    await writeFile(
      backup,
      JSON.stringify({ spreadsheetId: MICROM_SPREADSHEET_ID, rows: original }),
      { mode: 0o600 },
    );
    if (accountingHash(await readRows()) !== accountingHash(original))
      throw new Error(
        "Microm Orders changed during Shopify fetch; retry backfill.",
      );
    await ensureOrdersDeliveryHeaders(request, ORDERS_COLUMNS);
    const data = [];
    for (let offset = 0; offset < values.length; offset += 1000)
      data.push({
        range: `Orders!O${offset + 2}:W${Math.min(offset + 1000, values.length) + 1}`,
        values: values.slice(offset, offset + 1000),
      });
    await request("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data }),
    });
    const verified = await readRows();
    if (accountingHash(verified) !== accountingHash(original))
      throw new Error(
        "Microm accounting columns changed during backfill; inspect sheet.",
      );
    if (
      JSON.stringify(
        verified.map((row) =>
          Array.from({ length: 9 }, (_, index) => row[index + 14] ?? ""),
        ),
      ) !== JSON.stringify(values)
    )
      throw new Error("Microm delivery readback mismatch.");
    console.log(
      JSON.stringify({
        verified: true,
        unchangedAccountingColumns: true,
        backup,
      }),
    );
  } finally {
    await lock.release();
  }
}
main()
  .catch((error) => {
    console.error(
      error instanceof Error ? error.message : "Microm backfill failed",
    );
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
