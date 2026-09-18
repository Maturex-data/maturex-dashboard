# Flowa Etsy Data Storage Design

## Understanding Summary

- `FL DATA` contains reports exported directly from Etsy shops, not Jodoo or Fastway data.
- The current dataset covers July and August 2026.
- The main report types are sold orders, sold order items, and account statements.
- Canonical shops are `97DECOR`, `TIMOND`, `ARTISANHAND`, `Pocdy`, and `Evernest`.
- `Timond`/`TIMOND` and `Artisanshand`/`ARTISANHAND` are aliases of the same shops.
- Data must remain traceable to its original file while also supporting filtering by shop and month.
- Customer and address data is restricted to administrative users.

## Current Dataset

The reviewed files contain:

- 284 order or order-item rows.
- 2,718 statement rows.
- 281 statement sale rows plus fees, taxes, refunds, deposits, marketing charges, and other transaction types.
- Mostly USD data, with a small number of GBP statement rows.
- Duplicate order IDs across order and item reports, which are expected and must not be treated as duplicate business records.

## Assumptions

- Etsy Order ID is unique only within a shop.
- A shop can have orders without a corresponding item report for the same month.
- Statement rows do not always reference an order.
- Source files remain available outside the database for manual reconciliation.
- The import process may be run repeatedly for the same month and must be idempotent.
- Monetary values are stored exactly as reported; derived values must be explicitly marked if added later.

## Selected Approach

Use normalized tables by record type, with shop and import metadata. Do not create a separate table for each shop.

### `etsy_shops`

Stores canonical shop identity and display metadata.

Key fields:

- `id`
- `code` (unique)
- `name`
- `active`
- `created_at`
- `updated_at`

Initial canonical codes:

- `97DECOR`
- `TIMOND`
- `ARTISANHAND`
- `POCDY`
- `EVERNEST`

### `etsy_import_batches`

Tracks every imported source file and makes imports auditable.

Key fields:

- `id`
- `shop_id`
- `report_type`
- `source_file_name`
- `source_month`
- `file_hash`
- `status`
- `total_rows`
- `inserted_rows`
- `updated_rows`
- `skipped_rows`
- `failed_rows`
- `error_details`
- `started_at`
- `completed_at`

`file_hash` should be indexed and unique with `shop_id` and `report_type`.

### `etsy_orders`

Stores one row per Etsy order.

Important fields include:

- `shop_id`
- `order_id`
- Sale and shipping dates
- Buyer and shipping address fields
- Item count, SKU summary, payment method, and status
- Currency and all Etsy order monetary fields
- `import_batch_id`
- `raw_payload`
- `created_at`
- `updated_at`

Unique key: `shop_id + order_id`.

### `etsy_order_items`

Stores individual Etsy order lines when an item report is available.

Important fields include:

- `shop_id`
- `order_id`
- `transaction_id`
- Listing ID, SKU, item name, variations, and quantity
- Price, discounts, shipping, tax, and item total
- Currency
- Match status for the parent order
- `import_batch_id`
- `raw_payload`

Preferred unique key: `shop_id + transaction_id`. When transaction ID is absent, use a stable source key derived from `shop_id + order_id + item_index + row content`.

### `etsy_statements`

Stores each Etsy ledger transaction independently.

Important fields include:

- `shop_id`
- `statement_date`
- `type`
- `title`
- `info`
- `currency`
- `amount`
- `fees_and_taxes`
- `net`
- `tax_details`
- Optional extracted Order ID
- Stable `source_key`
- `import_batch_id`
- `raw_payload`

Statement rows are not required to match an order because deposits, subscription fees, marketing charges, taxes, and other transactions may be account-level.

## Data Flow

1. An administrator selects one or more Etsy export files.
2. The user selects the shop, or the importer resolves an approved folder alias to a canonical shop.
3. The importer detects the report type from the header schema.
4. A batch is created with status `PROCESSING`.
5. Dates, currencies, and monetary values are parsed without changing their business meaning.
6. Empty rows are removed and required fields are validated.
7. Valid records are upserted using the defined business keys.
8. Invalid rows are recorded in batch error details.
9. The batch is finalized with inserted, updated, skipped, and failed counts.
10. The UI reads normalized tables and filters by shop, month, report type, and currency.

## Import Rules

- Reject a file when its header does not match a supported Etsy report type.
- Detect an already imported file using its cryptographic hash.
- Re-importing equivalent records must not create duplicates.
- Existing orders may be updated when a later Etsy export contains changed status or financial values.
- Items without a parent order remain stored as `UNMATCHED` and can be reconciled later.
- Store the original row in `raw_payload` for audit and future remapping.
- Preserve source currency on every monetary record; do not assume USD.
- Use `Decimal(18,4)` for monetary columns and database `Date` for Etsy report dates.

## Security And Privacy

- Only authenticated administrative users can import or view customer-identifying fields.
- API responses and exports should omit customer contact and address columns unless explicitly requested.
- Import logs must not contain credentials, tokens, or complete customer records.
- Database backups and exported files must be handled as sensitive business data.

## Reliability And Scale

- Imports should run as tracked batches and expose progress or a completion result.
- A failed batch must not be reported as successful.
- Partial row failures are permitted when valid rows can still be safely committed and the failures remain visible.
- Index orders and statements by `shop_id` and date for monthly views.
- Neon is sufficient for the current dataset and expected growth into hundreds of thousands of records.

## Testing Strategy

- Header detection tests for all three supported Etsy export formats.
- Alias normalization tests for shop folder naming differences.
- Date and currency parsing tests, including USD and GBP.
- Idempotency tests using the same file twice.
- Update tests using two exports of the same order with different status or totals.
- Statement source-key collision tests.
- Orphan item import and later reconciliation tests.
- End-to-end import validation against known row counts and financial totals from the source files.

## Decision Log

1. Tables are organized by data type, not by shop, to avoid duplicated schemas and simplify cross-shop reporting.
2. Order items are stored separately because one order can contain multiple SKUs and future COGS reconciliation requires item-level data.
3. Statements remain independent from orders because many ledger transactions are account-level.
4. Raw row payloads are retained so normalized data can always be reconciled with Etsy exports.
5. Import batches and file hashes are retained for traceability, error reporting, and duplicate prevention.
6. Shop aliases are normalized into one canonical shop record.
7. Currency is stored per record because the source data is not exclusively USD.

## Explicit Non-Goals

- Jodoo and Fastway data are not part of this Etsy import flow.
- The initial version does not convert currencies.
- The initial version does not calculate profit or COGS.
- The initial version does not delete source files after import.
