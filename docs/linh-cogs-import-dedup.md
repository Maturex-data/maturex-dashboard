# Linh COGS import reconciliation

Destination: `1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do`, `RAW.COGS`, gid 58221536. Header row 2, data starts row 3.

- Business key: normalized Store + uppercase Supplier + text Etsy Order ID.
- Resolve replacement Store from its exact ID first, then its original ID if absent. Keep `-Replace` unchanged in COGS and its business key.
- Compare source date, original status, production, shipping and total cost. Normalize midnight dates and decimal representations. Source payment totals and claims are not added to order costs.
- Identical upload rows collapse; conflicting upload rows or duplicate Sheet keys block writes.
- Rows outside 97DECOR, missing Orders mappings, invalid required fields or arithmetic inconsistencies block writes.
- Payment discrepancy remains blocking until business policy is approved.
- Preview includes new/unchanged/changed/conflict decisions and differences. Updates are unselected by default. Changed rows require explicit approval; new rows are inserted when confirming import.
- Signed preview binds file content and exact Orders/COGS snapshot, expires after 30 minutes. Server re-reads both tabs inside PostgreSQL advisory transaction lock and rechecks before writing.
- Lock key: `ecombius-linh-raw-cogs`, shared across application instances using the same PostgreSQL database. Released automatically with transaction.
- Write only new rows and source columns E/F/H/I/L of approved existing rows. Preserve supplier ID, currency, tax, other costs and historical source IDs/files. Never clear the tab.
- Verify inserted/updated values and preserved cells after writing. Network/verification failures require a new preview, never a blind retry.
- Existing JWT/admin access checks apply. Google credentials remain server-side.

## Practical limits

Advisory lock coordinates this COGS importer, not manual Google edits or other integrations. Google Sheets has no atomic compare-and-swap for values: there remains a short gap between the final read and write. Avoid simultaneous manual sorting/editing during import; preserve/verification checks detect unexpected changes.

No live Sheet import was performed during implementation. Tests use simulated writes; live read-only preview and two PostgreSQL transactions verified lock exclusion. No commit/push/deploy performed.

## Order Management export

The canonical export is `Order Management` with two header rows. The parser maps
order-level columns by exact header name: `Order ID`, `Create Day`, `STORE`,
`Partner Sales Channel`, `Order Base Cost`, `Order Fulfillment Cost`, `Order Amount`,
`Order Status`, and `Payment ID`. Item continuation rows with no Order ID are
ignored; order totals are read once. Payment IDs are metadata, not payment totals;
this export does not support validating a declared payment total. The previous
`Payment Management` parser remains available for older exports.

Order Management requires matching RAW.Orders before COGS can be written.
Source STORE is checked against the Orders lookup; disagreement blocks import.
Missing Orders is reported by order ID. Replacement IDs fall back to their base
order only for Store lookup. The excluded TikTok ID is skipped and counted.
The UI uses the whole BO scope (97Decor and Timond), not a selected shop.

## Agreed import sequence

Orders for both 97Decor and Timond → Items → Statement → shared COGS.
Items and COGS require existing Orders with matching Store. Items checks during
preview and again in the writer; COGS rechecks when preparing the write. Statement
is independent. COGS does not require prior Items or Statement.
The user confirmed orders 4171577410 and 4162490383 belong to 97Decor; their
source CSV records were moved from the Timond September Orders file into the
97Decor September Orders file, with original files backed up locally.

## Folder import and automatic COGS updates

Ms. Linh has a folder picker and recursive directory drop zone. Server analysis
recognizes CSV type by headers and Equarus XLSX by worksheet/parser; path or
filename identifies shop, with manual selection for ambiguous files. The UI
shows the list before executing sequential Orders → Items → Statement → COGS.
Byte-identical files are omitted. Conflicting Orders IDs across files, multiple
Statement files for one shop/month, and multiple COGS files require removing
extra files before running. File failures are reported; failed Orders block
dependent Items/COGS for that run while Statement can proceed. Successful jobs
are skipped when retrying on the same page.

User decision supersedes the earlier review policy: COGS changes automatically
update only source-provided columns. The importer computes all CHANGED keys on
the server after fresh validation. Signed preview and snapshot validation remain.
Orders prerequisites, Store mismatches, duplicate keys, and missing source data
still block writes. There is no per-row approval UI.
