import { COGS_COLUMNS } from "./constants";
import { computeTabFingerprint } from "./sheet-writer";

export const MERCHONE_EXTRA_HEADERS = [
  "Chi phí nguồn EUR",
  "Quốc gia/nhãn nguồn",
];
export async function readStoredMicromOrderRefs(
  spreadsheetId: string,
  token: string,
): Promise<{ name: string; id: string }[]> {
  const response = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Orders!A1:B?valueRenderOption=UNFORMATTED_VALUE`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    },
  );
  if (!response.ok)
    throw Error(
      `Cannot read stored Microm order mapping (${response.status}).`,
    );
  const payload = (await response.json()) as { values?: unknown[][] };
  if (
    payload.values?.[0]?.[0] !== "Order ID" ||
    payload.values?.[0]?.[1] !== "Shopify ID"
  )
    throw Error("Stored Microm Orders mapping header mismatch.");
  return payload.values
    .slice(1)
    .filter((row) => row[0] && row[1])
    .map((row) => ({ name: String(row[0]), id: String(row[1]) }));
}

export function planMerchOneImport(
  existing: unknown[][],
  incoming: (string | number)[][],
) {
  if (
    ![...COGS_COLUMNS, ...MERCHONE_EXTRA_HEADERS].every(
      (header, i) => existing[0]?.[i] === header,
    )
  )
    throw Error("Microm COGS headers differ from MerchOne contract.");
  const canonical = (id: unknown) =>
    String(id ?? "").replace(/^PP0(?=\d{8}$)/, "PPO");
  const keys = new Map<string, number>();
  for (let i = 1; i < existing.length; i++) {
    const id = canonical(existing[i][0]);
    if (!id.startsWith("PPO")) continue;
    if (keys.has(id)) throw Error(`Duplicate MerchOne ID on COGS: ${id}`);
    keys.set(id, i);
  }
  const finalRows = existing.map((row) => [...row]);
  const changes: { range: string; values: (string | number)[][] }[] = [];
  let added = 0,
    updated = 0,
    skipped = 0;
  const seen = new Set<string>();
  for (const incomingRow of incoming) {
    const row = [...incomingRow];
    const id = String(row[0]);
    if (row.length !== 15 || !/^PPO\d+$/.test(id) || seen.has(id))
      throw Error("Invalid/duplicate incoming MerchOne row.");
    seen.add(id);
    const index = keys.get(id) ?? finalRows.length;
    const previous = finalRows[index];
    if (
      previous &&
      String(previous[13]) === String(row[13]) &&
      previous[6] === row[6]
    ) {
      row[9] = (previous[9] as string | number) ?? "";
      row[10] = (previous[10] as string | number) ?? "";
    }
    if (
      row.every(
        (value, col) => String(value) === String(finalRows[index]?.[col] ?? ""),
      )
    ) {
      skipped++;
      continue;
    }
    if (keys.has(id)) updated++;
    else added++;
    finalRows[index] = row;
    changes.push({ range: `COGS!A${index + 1}:O${index + 1}`, values: [row] });
  }
  return { changes, finalRows, added, updated, skipped };
}

export async function writeMerchOneToSheet(
  spreadsheetId: string,
  token: string,
  incoming: (string | number)[][],
) {
  const base = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}`;
  const request = async (path: string, init?: RequestInit) => {
    const response = await fetch(base + path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30_000),
      cache: "no-store",
    });
    if (!response.ok)
      throw Error(`MerchOne COGS Sheets API ${response.status}.`);
    return response.json() as Promise<{ values?: unknown[][] }>;
  };
  const read = async () =>
    (await request("/values/COGS!A1:O?valueRenderOption=FORMULA")).values ?? [];
  const before = await read();
  const plan = planMerchOneImport(before, incoming);
  if (plan.changes.length) {
    if (JSON.stringify(await read()) !== JSON.stringify(before))
      throw Error("COGS changed while preparing MerchOne import; retry sync.");
    await request("/values:batchUpdate", {
      method: "POST",
      body: JSON.stringify({ valueInputOption: "RAW", data: plan.changes }),
    });
  }
  const after = await read();
  if (
    JSON.stringify(
      after.map((row) =>
        Array.from({ length: 15 }, (_, i) => String(row[i] ?? "")),
      ),
    ) !==
    JSON.stringify(
      plan.finalRows.map((row) =>
        Array.from({ length: 15 }, (_, i) => String(row[i] ?? "")),
      ),
    )
  )
    throw Error("MerchOne COGS readback mismatch.");
  return {
    added: plan.added,
    updated: plan.updated,
    skipped: plan.skipped,
    writtenCount: after.length - 1,
    fingerprint: computeTabFingerprint(after.slice(1)),
  };
}
