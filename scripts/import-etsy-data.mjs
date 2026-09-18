import { createHash, randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import postgres from "postgres";
import XLSX from "xlsx";

const DEFAULT_ROOT = "/Users/tatuanthanh/Downloads/FL DATA";
const cliArguments = process.argv.slice(2);
const dryRun = cliArguments.includes("--dry-run");
const rootArgument = cliArguments.find(
  (argument) => !argument.startsWith("--"),
);
const sourceRoot = path.resolve(
  rootArgument ?? process.env.ETSY_IMPORT_ROOT ?? DEFAULT_ROOT,
);

const SHOPS = {
  "97DECOR": { code: "97DECOR", name: "97Decor" },
  ARTISANHAND: { code: "ARTISANHAND", name: "Artisanhand" },
  ARTISANSHAND: { code: "ARTISANHAND", name: "Artisanhand" },
  EVERNEST: { code: "EVERNEST", name: "Evernest" },
  POCDY: { code: "POCDY", name: "Pocdy" },
  TIMOND: { code: "TIMOND", name: "Timond" },
};

const REPORT_DATE_COLUMN = {
  ORDERS: "Sale Date",
  ORDER_ITEMS: "Sale Date",
  STATEMENTS: "Date",
};

function normalize(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();
}

function text(value) {
  if (value === null || value === undefined) return null;
  const normalized = String(value).trim();
  return normalized === "" || normalized === "--" ? null : normalized;
}

function integer(value) {
  const normalized = text(value);
  if (normalized === null) return null;
  const parsed = Number.parseInt(normalized.replaceAll(",", ""), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function money(value) {
  const normalized = text(value);
  if (normalized === null) return null;

  const parenthesized = normalized.startsWith("(") && normalized.endsWith(")");
  const numeric = normalized.replaceAll(",", "").replace(/[^0-9.-]/g, "");
  if (numeric === "" || numeric === "-" || numeric === ".") return null;

  const parsed = Number(numeric);
  if (!Number.isFinite(parsed)) return null;
  return parenthesized ? -Math.abs(parsed) : parsed;
}

function date(value) {
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = text(value);
  if (normalized === null) return null;

  const iso = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso)
    return `${iso[1]}-${iso[2].padStart(2, "0")}-${iso[3].padStart(2, "0")}`;

  const us = normalized.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (!us) return null;

  const year = us[3].length === 2 ? Number(us[3]) + 2000 : Number(us[3]);
  return `${year}-${us[1].padStart(2, "0")}-${us[2].padStart(2, "0")}`;
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

function resolveShop(filePath) {
  for (const segment of filePath.split(path.sep).reverse()) {
    const shop = SHOPS[normalize(segment)];
    if (shop) return shop;
  }
  throw new Error(`Cannot determine Etsy shop from path: ${filePath}`);
}

function detectReport(headers) {
  const headerSet = new Set(headers);
  if (
    headerSet.has("Transaction ID") &&
    headerSet.has("Item Name") &&
    headerSet.has("Order ID")
  ) {
    return "ORDER_ITEMS";
  }
  if (headerSet.has("Sale Date") && headerSet.has("Order ID")) return "ORDERS";
  if (headerSet.has("Date") && headerSet.has("Type") && headerSet.has("Net"))
    return "STATEMENTS";
  throw new Error(`Unsupported Etsy report headers: ${headers.join(", ")}`);
}

async function listSourceFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listSourceFiles(entryPath)));
    else if (/\.(csv|xlsx)$/i.test(entry.name)) files.push(entryPath);
  }

  return files.sort((left, right) => left.localeCompare(right));
}

async function parseSourceFile(filePath) {
  const contents = await readFile(filePath);
  const workbook = XLSX.read(contents, { type: "buffer", cellDates: true });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  if (!worksheet) throw new Error(`Workbook has no sheets: ${filePath}`);

  const matrix = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: null,
    raw: false,
  });
  const headers = (matrix[0] ?? []).map((header) => String(header).trim());
  const reportType = detectReport(headers);
  const rows = XLSX.utils
    .sheet_to_json(worksheet, { defval: null, raw: false })
    .filter((row) => Object.values(row).some((value) => text(value) !== null));
  const sourceDate = rows
    .map((row) => date(row[REPORT_DATE_COLUMN[reportType]]))
    .find(Boolean);
  if (!sourceDate)
    throw new Error(`Cannot determine source month: ${filePath}`);

  return {
    fileHash: hash(contents),
    filePath,
    reportType,
    rows,
    shop: resolveShop(filePath),
    sourceMonth: `${sourceDate.slice(0, 7)}-01`,
  };
}

function mapOrder(row, shopId, batchId) {
  return {
    id: randomUUID(),
    shop_id: shopId,
    import_batch_id: batchId,
    order_id: text(row["Order ID"]),
    sale_date: date(row["Sale Date"]),
    buyer_user_id: text(row["Buyer User ID"]),
    full_name: text(row["Full Name"]),
    first_name: text(row["First Name"]),
    last_name: text(row["Last Name"]),
    number_of_items: integer(row["Number of Items"]),
    payment_method: text(row["Payment Method"]),
    date_shipped: date(row["Date Shipped"]),
    street_1: text(row["Street 1"]),
    street_2: text(row["Street 2"]),
    ship_city: text(row["Ship City"]),
    ship_state: text(row["Ship State"]),
    ship_zipcode: text(row["Ship Zipcode"]),
    ship_country: text(row["Ship Country"]),
    currency: text(row.Currency),
    order_value: money(row["Order Value"]),
    coupon_code: text(row["Coupon Code"]),
    coupon_details: text(row["Coupon Details"]),
    discount_amount: money(row["Discount Amount"]),
    shipping_discount: money(row["Shipping Discount"]),
    shipping: money(row.Shipping),
    sales_tax: money(row["Sales Tax"]),
    order_total: money(row["Order Total"]),
    status: text(row.Status),
    card_processing_fees: money(row["Card Processing Fees"]),
    order_net: money(row["Order Net"]),
    adjusted_order_total: money(row["Adjusted Order Total"]),
    adjusted_card_processing_fees: money(row["Adjusted Card Processing Fees"]),
    adjusted_net_order_amount: money(row["Adjusted Net Order Amount"]),
    buyer: text(row.Buyer),
    order_type: text(row["Order Type"]),
    payment_type: text(row["Payment Type"]),
    in_person_discount: money(row["InPerson Discount"]),
    in_person_location: text(row["InPerson Location"]),
    sku: text(row.SKU),
    raw_payload: row,
  };
}

function mapOrderItem(row, shopId, batchId, sourceKey, etsyOrderId) {
  return {
    id: randomUUID(),
    shop_id: shopId,
    import_batch_id: batchId,
    etsy_order_id: etsyOrderId,
    order_id: text(row["Order ID"]),
    source_key: sourceKey,
    transaction_id: text(row["Transaction ID"]),
    listing_id: text(row["Listing ID"]),
    sale_date: date(row["Sale Date"]),
    item_name: text(row["Item Name"]),
    buyer: text(row.Buyer),
    quantity: integer(row.Quantity),
    price: money(row.Price),
    coupon_code: text(row["Coupon Code"]),
    coupon_details: text(row["Coupon Details"]),
    discount_amount: money(row["Discount Amount"]),
    shipping_discount: money(row["Shipping Discount"]),
    order_shipping: money(row["Order Shipping"]),
    order_sales_tax: money(row["Order Sales Tax"]),
    item_total: money(row["Item Total"]),
    currency: text(row.Currency),
    date_paid: date(row["Date Paid"]),
    date_shipped: date(row["Date Shipped"]),
    ship_name: text(row["Ship Name"]),
    ship_address_1: text(row["Ship Address1"]),
    ship_address_2: text(row["Ship Address2"]),
    ship_city: text(row["Ship City"]),
    ship_state: text(row["Ship State"]),
    ship_zipcode: text(row["Ship Zipcode"]),
    ship_country: text(row["Ship Country"]),
    variations: text(row.Variations),
    order_type: text(row["Order Type"]),
    listings_type: text(row["Listings Type"]),
    payment_type: text(row["Payment Type"]),
    in_person_discount: money(row["InPerson Discount"]),
    in_person_location: text(row["InPerson Location"]),
    vat_paid_by_buyer: money(row["VAT Paid by Buyer"]),
    sku: text(row.SKU),
    match_status: etsyOrderId ? "MATCHED" : "UNMATCHED",
    raw_payload: row,
  };
}

function statementSignature(row) {
  return JSON.stringify([
    date(row.Date),
    text(row.Type),
    text(row.Title),
    text(row.Info),
    text(row.Currency),
    money(row.Amount),
    money(row["Fees & Taxes"]),
    money(row.Net),
    text(row["Tax Details"]),
  ]);
}

function extractOrderId(row) {
  const searchable = `${text(row.Info) ?? ""} ${text(row.Title) ?? ""}`;
  return searchable.match(/Order\s*#?\s*(\d+)/i)?.[1] ?? null;
}

function mapStatement(row, shopId, batchId, sourceKey) {
  return {
    id: randomUUID(),
    shop_id: shopId,
    import_batch_id: batchId,
    source_key: sourceKey,
    statement_date: date(row.Date),
    type: text(row.Type),
    title: text(row.Title),
    info: text(row.Info),
    currency: text(row.Currency),
    amount: money(row.Amount),
    fees_and_taxes: money(row["Fees & Taxes"]),
    net: money(row.Net),
    tax_details: text(row["Tax Details"]),
    extracted_order_id: extractOrderId(row),
    raw_payload: row,
  };
}

function chunks(values, size = 250) {
  return Array.from({ length: Math.ceil(values.length / size) }, (_, index) =>
    values.slice(index * size, (index + 1) * size),
  );
}

async function upsertRecords(sql, table, records, conflictColumns) {
  if (records.length === 0) return { inserted: 0, updated: 0 };

  const insertColumns = Object.keys(records[0]);
  const updateRecord = Object.fromEntries(
    Object.entries(records[0]).filter(
      ([key]) => key !== "id" && !conflictColumns.includes(key),
    ),
  );
  const updateColumns = Object.keys(updateRecord);
  const conflict = conflictColumns.map((column) => `"${column}"`).join(", ");
  const assignments = updateColumns
    .map((column) => `"${column}" = EXCLUDED."${column}"`)
    .join(", ");
  let inserted = 0;
  let updated = 0;

  for (const batch of chunks(records)) {
    const result = await sql`
      INSERT INTO ${sql(table)} ${sql(batch, ...insertColumns)}
      ON CONFLICT (${sql.unsafe(conflict)}) DO UPDATE
      SET ${sql.unsafe(assignments)}, "updated_at" = NOW()
      RETURNING (xmax = 0) AS inserted
    `;
    const batchInserted = result.filter((row) => row.inserted === true).length;
    inserted += batchInserted;
    updated += result.length - batchInserted;
  }

  return { inserted, updated };
}

async function getShop(sql, shop) {
  const rows = await sql`
    INSERT INTO etsy_shops (id, code, name)
    VALUES (${randomUUID()}, ${shop.code}, ${shop.name})
    ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, updated_at = NOW()
    RETURNING id
  `;
  return rows[0].id;
}

async function beginBatch(sql, source, shopId) {
  const existing = await sql`
    SELECT id, status, started_at
    FROM etsy_import_batches
    WHERE shop_id = ${shopId}
      AND report_type = ${source.reportType}
      AND file_hash = ${source.fileHash}
    LIMIT 1
  `;

  if (existing[0]?.status === "COMPLETED") return null;
  if (existing[0]) {
    const startedAt = new Date(existing[0].started_at).getTime();
    const isActive =
      existing[0].status === "PROCESSING" &&
      Date.now() - startedAt < 30 * 60 * 1000;
    if (isActive) return null;

    await sql`
      UPDATE etsy_import_batches
      SET status = 'PROCESSING', total_rows = ${source.rows.length}, inserted_rows = 0,
          updated_rows = 0, skipped_rows = 0, failed_rows = 0, error_details = NULL,
          started_at = NOW(), completed_at = NULL
      WHERE id = ${existing[0].id}
    `;
    return existing[0].id;
  }

  const id = randomUUID();
  const inserted = await sql`
    INSERT INTO etsy_import_batches (
      id, shop_id, report_type, source_file_name, source_month, file_hash, total_rows
    ) VALUES (
      ${id}, ${shopId}, ${source.reportType}, ${path.basename(source.filePath)},
      ${source.sourceMonth}, ${source.fileHash}, ${source.rows.length}
    )
    ON CONFLICT (shop_id, report_type, file_hash) DO NOTHING
    RETURNING id
  `;
  return inserted[0]?.id ?? null;
}

async function importOrders(sql, source, shopId, batchId) {
  let skipped = 0;
  const records = [];

  for (const row of source.rows) {
    const record = mapOrder(row, shopId, batchId);
    if (!record.order_id || !record.sale_date) {
      skipped += 1;
      continue;
    }
    records.push(record);
  }

  return {
    ...(await upsertRecords(sql, "etsy_orders", records, [
      "shop_id",
      "order_id",
    ])),
    skipped,
  };
}

async function importOrderItems(sql, source, shopId, batchId) {
  let skipped = 0;
  const occurrences = new Map();
  const records = [];

  for (const row of source.rows) {
    const orderId = text(row["Order ID"]);
    const saleDate = date(row["Sale Date"]);
    if (!orderId || !saleDate) {
      skipped += 1;
      continue;
    }

    const baseKey = text(row["Transaction ID"]) ?? hash(JSON.stringify(row));
    const occurrence = (occurrences.get(baseKey) ?? 0) + 1;
    occurrences.set(baseKey, occurrence);
    const sourceKey = hash(`${baseKey}:${occurrence}`);
    const order = await sql`
      SELECT id FROM etsy_orders WHERE shop_id = ${shopId} AND order_id = ${orderId} LIMIT 1
    `;
    const record = mapOrderItem(
      row,
      shopId,
      batchId,
      sourceKey,
      order[0]?.id ?? null,
    );
    records.push(record);
  }

  return {
    ...(await upsertRecords(sql, "etsy_order_items", records, [
      "shop_id",
      "source_key",
    ])),
    skipped,
  };
}

async function importStatements(sql, source, shopId, batchId) {
  let skipped = 0;
  const occurrences = new Map();
  const records = [];

  for (const row of source.rows) {
    const signature = statementSignature(row);
    const occurrence = (occurrences.get(signature) ?? 0) + 1;
    occurrences.set(signature, occurrence);
    const record = mapStatement(
      row,
      shopId,
      batchId,
      hash(`${signature}:${occurrence}`),
    );
    if (!record.statement_date || !record.type) {
      skipped += 1;
      continue;
    }
    records.push(record);
  }

  return {
    ...(await upsertRecords(sql, "etsy_statements", records, [
      "shop_id",
      "source_key",
    ])),
    skipped,
  };
}

async function importSource(sql, source) {
  const shopId = await getShop(sql, source.shop);
  const batchId = await beginBatch(sql, source, shopId);
  if (!batchId)
    return {
      ...source,
      inserted: 0,
      skipped: source.rows.length,
      updated: 0,
      status: "SKIPPED_FILE",
    };

  try {
    const counts = await sql.begin(async (transaction) => {
      if (source.reportType === "ORDERS")
        return importOrders(transaction, source, shopId, batchId);
      if (source.reportType === "ORDER_ITEMS")
        return importOrderItems(transaction, source, shopId, batchId);
      return importStatements(transaction, source, shopId, batchId);
    });

    await sql`
      UPDATE etsy_import_batches
      SET status = 'COMPLETED', inserted_rows = ${counts.inserted}, updated_rows = ${counts.updated},
          skipped_rows = ${counts.skipped}, completed_at = NOW()
      WHERE id = ${batchId}
    `;
    return { ...source, ...counts, status: "COMPLETED" };
  } catch (error) {
    await sql`
      UPDATE etsy_import_batches
      SET status = 'FAILED', failed_rows = ${source.rows.length},
          error_details = ${sql.json({ message: error instanceof Error ? error.message : String(error) })},
          completed_at = NOW()
      WHERE id = ${batchId}
    `;
    throw error;
  }
}

async function reconcileOrderItems(sql) {
  const matched = await sql`
    UPDATE etsy_order_items AS item
    SET etsy_order_id = orders.id, match_status = 'MATCHED', updated_at = NOW()
    FROM etsy_orders AS orders
    WHERE item.shop_id = orders.shop_id
      AND item.order_id = orders.order_id
      AND (item.etsy_order_id IS NULL OR item.match_status <> 'MATCHED')
    RETURNING item.id
  `;
  return matched.length;
}

function summarize(results) {
  return results.map((result) => ({
    file: path.relative(sourceRoot, result.filePath),
    shop: result.shop.code,
    reportType: result.reportType,
    month: result.sourceMonth.slice(0, 7),
    rows: result.rows.length,
    status: result.status,
    inserted: result.inserted ?? 0,
    updated: result.updated ?? 0,
    skipped: result.skipped ?? 0,
  }));
}

async function main() {
  const files = await listSourceFiles(sourceRoot);
  if (files.length === 0)
    throw new Error(`No CSV or XLSX files found in ${sourceRoot}`);

  const sources = [];
  for (const filePath of files) sources.push(await parseSourceFile(filePath));

  if (dryRun) {
    console.table(
      summarize(sources.map((source) => ({ ...source, status: "DRY_RUN" }))),
    );
    console.log(
      `Validated ${sources.length} files and ${sources.reduce((sum, source) => sum + source.rows.length, 0)} rows.`,
    );
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl)
    throw new Error("DATABASE_URL is required unless --dry-run is used.");

  const sql = postgres(databaseUrl, { max: 5, prepare: false });
  try {
    const results = [];
    for (const source of sources) results.push(await importSource(sql, source));
    const reconciledItems = await reconcileOrderItems(sql);
    console.table(summarize(results));
    console.log(`Processed ${results.length} Etsy files.`);
    console.log(`Reconciled ${reconciledItems} order items.`);
  } finally {
    await sql.end();
  }
}

await main();
