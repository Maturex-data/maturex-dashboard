# EC Business Report Export Design

## Understanding Summary

- Export a TheDeerly EC business report following the structure and presentation of the reference P&L workbook.
- The report is for the internal management team and must retain enough detail to trace every P&L figure to source records.
- Users can export either one selected month or two selected months for comparison.
- The workbook contains seven sheets: `PL`, `Rewards`, `Orders`, `COGS`, `Ads`, `Payouts`, and `Airwallex`.
- `COGS` includes Printful records. `Airwallex` replaces the three legacy tools sheets.
- Legacy scenario, notes, sources, and Python-check sheets are intentionally excluded.

## Assumptions

- Report periods and exported dates use `Asia/Ho_Chi_Minh`.
- `PL` values are calculated on the server from the same database snapshot as the exported source sheets.
- A one-month report includes one amount/ratio pair. A two-month report includes both amount/ratio pairs plus total amount and ratio columns.
- Manual monthly P&L inputs remain labelled as monthly configuration in the source/status column.
- An actual missing dataset is represented as zero only when there are no matching records; invalid requests return an error instead of a partial workbook.

## Decision Log

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| Keep seven sheets | Preserve all 14 sheets; only export `PL` | Seven sheets keep the report auditable without legacy planning and check tabs. |
| Merge Printful into `COGS` | Keep a `Printful orders` sheet | Printful is a supplier COGS source, so a separate report sheet duplicates the same business concept. |
| Replace legacy tools tabs with `Airwallex` | Preserve three tool tabs | Airwallex is the authoritative database source and prevents duplicated mapping logic. |
| Generate XLSX on the server | Build the workbook in the browser; background export job | Server-side generation keeps P&L and source rows consistent in one query snapshot and suits the current data volume. |
| Support one or two explicit months | Fixed July/August report; arbitrary multi-month matrix | It covers the requested workflow while keeping the P&L layout faithful to the template. |

## Final Design

### Export Interaction

The existing export control opens a compact selector for report mode: one month or two months. The user chooses the reporting month or comparison months and downloads an `.xlsx` file. Duplicate month selection and invalid month values are rejected before generation.

### Server Data Flow

The export route validates the selected periods and derives Vietnam-time start/end boundaries. It loads all report values from the database during the same export request:

1. `RAW.ORDER` for revenue, discounts, shipping, refunds, tax, and corrected net order.
2. `RAW.COGS` for supplier costs, including Printful.
3. `META_ADS` for advertising spend.
4. `RAW.PAYOUT_DETAIL` for Shopify charge, refund, dispute, and other payment fees.
5. `Airwallex` for card and non-card activity used to trace tools-related payments.
6. Monthly P&L configuration for subscription, personnel, overhead, welfare, and other manual inputs.

The API creates an XLSX workbook in this order: `PL`, `Rewards`, `Orders`, `COGS`, `Ads`, `Payouts`, `Airwallex`.

### PL Sheet

The `PL` sheet retains the reference workbook's title rows, column sequence, indicator codes, groups, totals, USD number formatting, percentage columns, and source/status column. One-month exports use a single amount and ratio pair. Two-month exports use the same two-period comparison plus total columns as the reference.

### Source Sheets

Each source sheet is limited to its selected reporting months and retains the database-backed normalized columns. The workbook does not include standalone Printful or tools tabs. Airwallex records remain visible even when they cannot yet be mapped to a P&L tool category.

### Validation and Failure Behavior

Before returning the file, the export checks P&L subtotals against the corresponding source datasets for each selected month. A mismatch, unsupported period, or generation failure returns a clear error and no incomplete file. The response uses an XLSX content type and descriptive file name.

### Testing Strategy

- Verify one-month and two-month exports.
- Compare each monthly P&L revenue/cost subtotal with the related source sheet data.
- Open the generated workbook and verify sheet names, headers, number formats, and title layout.
- Test a month with no source rows and invalid/duplicate period input.
