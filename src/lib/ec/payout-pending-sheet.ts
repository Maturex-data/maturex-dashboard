import { EXPECTED_SHEET_HEADERS } from "@/lib/ec/sheet-import/types";
import { fetchPendingPaymentTransactions } from "@/lib/shopify-payments-rest-sync";

export async function applyPendingAmounts(
  rows: Array<Array<string | number | null | undefined>>,
): Promise<void> {
  const pending = await fetchPendingPaymentTransactions();
  const amounts = new Map(
    pending.map((row) => {
      const net = Number(row.net);
      if (!Number.isFinite(net))
        throw Error("Invalid pending Net from Shopify.");
      return [String(row.id), net] as const;
    }),
  );
  for (const row of rows) row[16] = amounts.get(String(row[2])) ?? 0;
}

export async function ensurePayoutPendingHeader(
  request: (path: string, init?: RequestInit) => Promise<Response>,
): Promise<void> {
  const r = await request("/values/Payouts!A1:Q1");
  if (!r.ok) throw Error(`Payouts header read failed (${r.status}).`);
  const p = (await r.json()) as { values?: string[][] };
  const header = p.values?.[0] ?? [];
  if (
    !EXPECTED_SHEET_HEADERS.Payouts.every(
      (value, index) => header[index]?.trim() === value,
    )
  )
    throw Error("Payouts header mismatch; stopped to protect data.");
  if (header[16] === "Pending amount") return;
  if (header[16]) throw Error("Payouts column Q is already in use.");
  const meta = await request(
    "?fields=sheets.properties(sheetId,title,gridProperties.columnCount)",
  );
  if (!meta.ok) throw Error("Cannot read Payouts grid.");
  const metadata = (await meta.json()) as {
    sheets: Array<{
      properties: {
        sheetId: number;
        title: string;
        gridProperties: { columnCount: number };
      };
    }>;
  };
  const sheet = metadata.sheets.find(
    (s) => s.properties.title === "Payouts",
  )?.properties;
  if (!sheet) throw Error("Payouts tab missing.");
  if (sheet.gridProperties.columnCount < 17) {
    const resized = await request(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            appendDimension: {
              sheetId: sheet.sheetId,
              dimension: "COLUMNS",
              length: 17 - sheet.gridProperties.columnCount,
            },
          },
        ],
      }),
    });
    if (!resized.ok) throw Error("Cannot extend Payouts grid.");
  }
  const result = await request("/values/Payouts!Q1?valueInputOption=RAW", {
    method: "PUT",
    body: JSON.stringify({ values: [["Pending amount"]] }),
  });
  if (!result.ok)
    throw Error(`Payouts header write failed (${result.status}).`);
}
