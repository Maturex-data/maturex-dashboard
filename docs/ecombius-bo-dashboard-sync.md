# ECOMBIUS BO imports and dashboard periods

The dashboard reads Etsy PostgreSQL tables. BO imports historically wrote only Google Sheets, leaving dashboard data/periods stale at July–August 2026.

## Current flow

1. Validate uploaded Orders, Items or Statement.
2. Write target BO Sheet.
3. Mirror verified source rows into dashboard DB, grouped by normalized Store and actual report month.
4. Clear browser table cache after successful import. The period dropdown comes from DB dates for the chosen shop/tab, independent of the selected month/search.

If DB sync fails after a Sheet write, report that Sheet succeeded and ask to retry the import. Upserts are idempotent. Report type/shop/month advisory locks serialize DB projection updates. Orders use shop/order ID. Items and Statements keep the existing legacy occurrence-hash key algorithm; Statement partitions remove stale keys only in the replaced source spreadsheet + shop/month.

## Data preservation

- No migration or deletion of unrelated shops/months.
- BO grouping does not become part of the business key: Timond is the same shop in Linh/Nam.
- Statements preserve legitimate repeated rows with occurrence keys.
- Sheet writes use RAW to avoid Google reinterpreting Etsy MM/DD/YY dates under vi_VN locale. Existing Order/Items cell values/formulas remain intact when rewriting.
- Source CSV dates are parsed as US dates; ISO and Google numeric dates are supported.

## Existing data recovery

Run `node --env-file=.env --import tsx scripts/backfill-ecombius-dashboard.ts` explicitly to backfill the three BO spreadsheets (Phuc, Linh, Nam). This only writes the DB projection, never the source Sheets. Phuc Statement uses the extended 12-column contract.

Legacy numeric date cells under vi_VN/en_GB were created by USER_ENTERED MM/DD uploads. Source-file comparison confirmed month/day inversion. Backfill reverses that conversion for numeric legacy Order/Items date cells, while text dates are parsed normally; ambiguous unsupported formats stop rather than guess. Future imports use RAW and do not need this recovery.

A local pre-backfill DB snapshot was saved to `/private/tmp/ecombius-db-before-bo-backfill.json`.
