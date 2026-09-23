# EC dashboard: Google Sheet -> Prisma -> dashboard

Status: implementation plan for Antigravity. No application code or database migration is part of this document.

## 1. Goal and hard boundary

- Redesign `/` with four truthful KPI cards, two charts backed by real data, and four detail tabs: `Orders`, `COGS`, `Ads`, `Payouts`.
- The EC Google spreadsheet is the source of truth for these four datasets. The dashboard's **Sync from Google Sheet** action reads those sheets into a Prisma read model. It does not call Shopify, Meta, PGPrint, Printify, Printful, or Airwallex.
- The existing `/ec-drive-sync` flow continues to pull platform/partner APIs and write the Google spreadsheet. **Do not modify its UI, routes, provider fetchers, scheduling, data mappings, clear action, or write logic.** In particular, do not change `/api/ec/drive/sync`, `/api/ec/drive/clear-report`, or the meaning of `EcDriveSyncRun`.
- Reuse the existing `getGoogleDriveAccess()` OAuth connection for read-only Sheets API calls. The new direction is `platforms -> /ec-drive-sync -> Google Sheet -> dashboard import -> Prisma -> /`.
- Do not edit the spreadsheet as part of dashboard import. Do not replace or delete legacy Prisma models used by other routes, exports, or sync jobs in the first migration.

## 2. Verified source snapshot (2026-09-23)

Spreadsheet: `REPORT_SPREADSHEET_ID` from `src/lib/ec-drive.ts`; current default is `19QrKNM6Tzn433gRo4neKcT3e6UtRcFaJ7Hj8lvtP5g8`.

| Sheet | Columns | Rows | Months and row counts | Stable key in sheet |
| --- | ---: | ---: | --- | --- |
| Orders | A:M (13) | 4,126 | Jul 1,636; Aug 1,632; Sep 858 | `Order` (C), scoped to shop |
| COGS | A:L (12) | 6,304 | Jul 2,519; Aug 2,417; Sep 1,368 | `Row key` (J), scoped to shop |
| Ads | A:K (11) | 84 | Jul 31; Aug 31; Sep 22 | `ID` (C), scoped to shop |
| Payouts | A:P (16) | 4,337 | Jul 1,720; Aug 1,696; Sep 921 | `Balance transaction ID` (C), scoped to shop |

At inspection, all four keys had zero blanks and zero duplicates. This is a snapshot assertion, not a guarantee for future imports. `Source row` is a mutable sheet position and must **never** be a primary or unique key.

Important data characteristics:

- July/August monetary cells are mostly strings such as `45,99` even with `UNFORMATTED_VALUE`; September cells are numeric. A direct `Number(value)` turns earlier amounts into `NaN` or zero. A typed decimal parser and strict invalid-cell reporting are mandatory.
- Ads contains only `account daily` rows for account `918678220936371`; all 84 `Campaign ID` and `Campaign name` cells are blank. Do not promise campaign breakdowns or attributed ROAS from this sheet.
- COGS includes PGPrint, Printful, Printify, and Luxury Pro, plus 433 zero-cost rows. Keep zero-cost records. `Treatment` includes `MATCHED`, `Ghi nhận COGS — fulfilled`, and `Loại — chi phí bằng 0`.
- Payouts contains `charge`, `balance_transaction`, `Payments::Refund`, and `Payments::Dispute`; all current rows are USD. It is Shopify Payments data, **not Airwallex**. `Processed UTC` and the two Vietnam-local columns must retain their distinct meanings.
- July `PL` currently shows no COGS/Ads although the source sheets contain USD 39,943.54 COGS and USD 44,932.29 Ads. Show a reconciliation warning; do not silently equate the July PL variable-cost line with the raw sheets.

Verified raw aggregates (USD):

| Month | Orders gross | Orders corrected net | Original tax | Net revenue = corrected net - tax | COGS total | Ads spend | Payout fee |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-07 | 101,403.79 | 105,935.39 | 107.85 | 105,827.54 | 39,943.54 | 44,932.29 | 3,676.91 |
| 2026-08 | 101,664.48 | 101,551.42 | 74.26 | 101,477.16 | 36,461.83 | 46,688.22 | 3,560.88 |
| 2026-09, partial | 57,737.46 | 54,748.43 | 82.23 | 54,666.20 | 11,409.48 | 29,115.65 | 1,856.18 |

These are acceptance fixtures for the inspected snapshot. They are not hardcoded UI data; they will change on later Sheet syncs. Compare with a tolerance of USD 0.01 after import.

## 3. Source-to-model contract

Create **additive** Prisma projection models. Use `Decimal(18,4)` for amounts, `@db.Date` for day-only columns, UTC `DateTime` for instants, nullable text where the Sheet allows blanks, and preserve the original row as `Json` for audit. Every row belongs to an import batch. Add indexes on `month`/`date` and the filter fields used by the UI.

### `EcSheetOrder`

Map the sheet columns in exact order: `Month`, `Source row`, `Order`, `Date`, `Gross sales`, `Discounts`, `Shipping charged`, `Original tax`, `Corrected net`, `Refund snapshot`, `Before refund`, `Source`, `Item name`.

Suggested fields: `batchId`, `shop`, `month`, `sourceRow`, `orderName`, `orderDate`, `grossSales`, `discounts`, `shippingCharged`, `originalTax`, `correctedNet`, `refundSnapshot`, `beforeRefund`, `source`, `itemName`, `rawValues`. Unique `(batchId, shop, orderName)`. Reject a duplicate rather than selecting an arbitrary row. Do not invent a Shopify numeric order ID: this Sheet does not contain it.

### `EcSheetCogs`

Map: `Month`, `Source row`, `Supplier`, `Date`, `Reference order ID`, `Items name`, `Supplier order ID`, `Total cost`, `Estimated cost`, `Row key`, `Treatment`, `Source`.

Suggested fields: `batchId`, `shop`, `month`, `sourceRow`, `supplier`, `costDate`, `referenceOrderId`, `itemsName`, `supplierOrderId`, `totalCost`, `estimatedCost`, `rowKey`, `treatment`, `source`, `rawValues`. Unique `(batchId, shop, rowKey)`; indexes `(batchId, month, supplier)` and `(batchId, costDate)`. Keep `Total cost` and `Estimated cost` separate. Do not sum summary rows from a supplier's source file again: the Sheet is the normalized line source. Preserve rows with zero cost and the exclusion treatment, but omit excluded rows from recognized-cost KPI.

### `EcSheetAd`

Map: `Month`, `Source row`, `ID`, `Date`, `Account ID`, `Campaign ID`, `Campaign name`, `Currency`, `Spend`, `Granularity`, `Source`.

Suggested fields: `batchId`, `shop`, `month`, `sourceRow`, `externalId`, `date`, `accountId`, `campaignId?`, `campaignName?`, `currency`, `spend`, `granularity`, `source`, `rawValues`. Unique `(batchId, shop, externalId)`; index `(batchId, accountId, date)`. The current account-daily grain is one row per account/day; never aggregate by campaign when campaign fields are blank.

### `EcSheetPayout`

Map: `Month local`, `Source row`, `Balance transaction ID`, `Payout ID`, `Type`, `Currency`, `Gross`, `Fee`, `Net`, `Processed UTC`, `Processed GMT+7`, `Processed Vietnam`, `Reason`, `Source ID`, `Order ID`, `Source`.

Suggested fields: `batchId`, `shop`, `monthLocal`, `sourceRow`, `balanceTransactionId`, `payoutId?`, `type`, `currency`, `gross`, `fee`, `net`, `processedUtc`, `processedGmt7`, `processedVietnam`, `reason?`, `sourceId?`, `orderId?`, `source`, `rawValues`. Unique `(batchId, shop, balanceTransactionId)`; indexes `(batchId, monthLocal, type)` and `(batchId, processedUtc)`. Store UTC as an instant and the local strings as displayed by the Sheet. Assert `monthLocal` matches the Vietnam-local date. Never sum `Gross` or `Net` into revenue; payout cash flow is not order revenue.

### Import metadata

Add `EcSheetImportRun` (`id`, `spreadsheetId`, `status`, `startedAt`, `heartbeatAt`, `completedAt`, per-sheet counts/checksums, error details, actor) and a singleton active-snapshot pointer (`EcSheetActiveSnapshot.activeRunId`). Keep the previous active batch until all four sheets parse, insert, and validate. Publish the new pointer in one short DB transaction. This prevents half-imported KPI/chart/table combinations. Retain at least the previous successful batch for rollback. A stale run must expire/recover; concurrent dashboard imports must not publish out of order.

Do **not** repurpose `RawOrder`, `CogsRecord`, `MetaDailyFinancial`, `ShopifyPaymentRecord`, or their sync-run models in this phase. Those are used by existing ingestion/API/export code and have different grains and columns. New models form a Sheet-aligned read projection. Deprecate old dashboard reads only after the new projection passes comparison.

## 4. Import flow and validation

1. Add a protected `POST /api/ec/sheet-import` for admins. It reads all four sheets via Google Sheets API using the existing OAuth connection. It only reads Google and writes the new Prisma projection.
2. Record the Sheet ID, requested user, start time, and active `/ec-drive-sync` run state. Do not start a read while any relevant `EcDriveSyncRun` is `RUNNING`; check again before publishing to avoid capturing the Sheet during its clear-and-write cycle.
3. Fetch the four ranges in bounded requests; use `UNFORMATTED_VALUE`, but parse every cell by schema because old cells are still locale-formatted strings. Handle comma decimals, dot thousands, `$`, surrounding parentheses, zero, and negative values. Reject a nonempty unparseable amount with sheet/row/column in the error. Do not silently coerce it to zero.
4. Validate exact headers and column order before ingest. Do not rely on spreadsheet `gridProperties.rowCount`, which includes empty capacity. Ignore fully blank rows only. Keep blank optional cells as `null`.
5. Validate month `YYYY-MM`, dates, timestamps, USD currency before cross-currency aggregation, uniqueness, known treatment/type, and `Source` labels. Verify `gross - fee = net` only for payout row types where that identity applies; report exceptions rather than rewriting source amounts.
6. Insert in bounded chunks into a new batch. Compare inserted row counts, distinct keys, per-month counts, and Decimal sums against values parsed from the Sheet. Store checksums for later audits. Run the same import twice as an idempotency check: the active output must not double-count.
7. Publish all four datasets atomically by switching `activeRunId`. On failure, keep the previous active snapshot and return an actionable status. The UI shows last successful import time, source ranges/row counts, and the current run's progress/errors.
8. Do not make `/` call Google per page view. Dashboard SSR reads the active Prisma snapshot. A manual `Đồng bộ từ Google Sheet` command refreshes it; a normal page refresh does not trigger partner API work.

## 5. Dashboard numbers and period rules

One shared month selector controls cards, charts, and all four tabs. Default to current Vietnam month when an active snapshot has rows; otherwise choose the latest month with data and show that period explicitly. Current month is marked `tạm tính`. All date boundaries use `Asia/Ho_Chi_Minh`. For a partial current month, a change percentage compares the same number of elapsed Vietnam days in the previous month; for completed months, compare full months. If a source is missing, show `Chưa có dữ liệu`, never `$0` unless the parsed value is truly zero.

Recommended four cards:

1. **Đơn hàng**: count distinct `Orders.Order` in period. Secondary: `Tỷ lệ đơn có refund = count(refundSnapshot > 0) / order count`. This is order incidence, not refund value rate.
2. **Doanh thu thuần**: sum `Orders.Corrected net - Orders.Original tax`, USD. Secondary: `AOV thuần = doanh thu thuần / số đơn`. Add a `calc` marker because this is derived from two source columns. Show `Gross sales` as a hover/detail metric, not the headline revenue.
3. **Chi phí quảng cáo**: sum `Ads.Spend` for USD account-daily rows. Secondary: `MER = doanh thu thuần / ad spend` (company-wide marketing efficiency ratio); do not label this `Meta ROAS`. Undefined denominator displays `—`.
4. **Lãi gộp sau COGS**: `doanh thu thuần - recognized COGS Total cost`, USD. Secondary: `biên lãi gộp = lãi gộp / doanh thu thuần`. Mark `calc`. The label explicitly excludes Ads, payout fees, Sales bonus, and fixed costs; do not call it `lợi nhuận ròng` or equate it with PL's contribution margin.

Keep Decimal arithmetic through aggregation and round only for display. Apply USD formatting consistently; no hardcoded positive deltas or zero placeholders. Card click should select the corresponding detail tab/filter where useful.

## 6. Charts

- Replace `RevenueOverviewChart`'s Jan–Dec mock array with a real **monthly trend**: net revenue, recognized COGS, and Ads spend from the active snapshot. Use only months present in the source, and distinguish a missing source from a true zero. Tooltips show exact USD, period, and provisional status. Do not calculate a fake `net = revenue - ads` and call it profit.
- Replace `RevenueSourcesChart`'s static donut with **cost mix for the selected month**: recognized COGS, Ads spend, and Shopify Payments fee (`Payouts.Fee` only; exclude payout gross/net/principal). Show USD and share of these three categories. If any category has no source rows, show an incomplete-data notice; do not invent a zero slice.
- Both charts derive from the same server-side aggregate function as the cards and detail-table totals. Avoid independent client formulas. Handle empty, loading, error, and narrow-screen states; use readable icons/legend and no misleading `Optimized` label.

## 7. Four detail tabs and APIs

- Replace the outer tabs in `EcDashboardTabs` with `Orders`, `COGS`, `Ads`, `Payouts` in that order. Remove the dashboard Airwallex tab. Airwallex's existing API/table may remain elsewhere; the fourth tab must show **Shopify Payouts from Google Sheet**.
- Use one shared month filter, page size 50 by default, server-side pagination/sorting/search, column visibility, and a capped scrolling table height. Preserve the Sheet's column names and order in each tab. Add supplier filter in COGS, account filter in Ads, and type filter in Payouts.
- `GET /api/ec/dashboard?month=YYYY-MM` returns cards, chart series, reconciliation/freshness, and source coverage from the active batch. `GET /api/ec/sheet-rows?sheet=...&month=...&page=...&sort=...` returns typed rows and total. Validate all query values and whitelist sort columns. Read-only access follows existing dashboard auth; import requires admin.
- Maintain the existing export affordance by reading the active projection for selected/all months, preserving the same four sheet names and column order. Show an explicit snapshot timestamp on exports. Do not call provider APIs from export.
- Remove fake read-only search/notification controls in the page header if they have no actual action. Keep the existing compact dashboard visual language, responsive grid, icons and text sizes; don't turn the page into a marketing layout.

## 8. Reconciliation and release gates

- Add a reconciliation view/log comparing per-sheet row count, unique-key count, earliest/latest Vietnam date, and monthly Decimal totals between the Google read and active Prisma batch. A mismatch prevents batch publication.
- Compare the dashboard's July/August net revenue against `PL` line `II` (105,827.54 and 101,477.16 in the inspected file). Compare COGS/Ads against source sheets first; show the known July PL discrepancy separately. Never mutate PL formulas as part of this dashboard task.
- Confirm exact counts in the snapshot table in section 2 and sums in section 2 after a first import. Test a second import with no source changes, then a changed source row to verify replacement rather than duplication. Test malformed money/date, duplicate key, zero-cost COGS, negative payout, missing Ads day, Google 401/403/429, expired OAuth, and a concurrent `/ec-drive-sync` run.
- Verify the four cards, both charts and all four tab tables on desktop and mobile; check horizontal scrolling and that labels/numbers do not overlap. Run Biome, TypeScript, and focused import/aggregation tests. Compare exported row counts with the active Prisma projection.
- Only after all gates pass, switch `/` to the new projection. Leave a rollback path by restoring the previous active batch or the prior dashboard page code. Do not delete legacy tables in this release.

## 9. Suggested implementation order for Antigravity

1. Inventory current routes/models and save the reconciliation snapshot; add tests for money parsing and source keys.
2. Add additive Prisma migration and generated client for the four Sheet projection models plus import-run/active-pointer metadata.
3. Implement the read-only Google Sheets importer, batch validation, atomic publish, and import status API/UI. Do not modify `/ec-drive-sync`.
4. Implement typed aggregate/query services and the two new read APIs.
5. Replace KPI cards, then charts, then four tabs and export source. Verify each against the same active batch.
6. Run source-vs-DB and dashboard-vs-source reconciliation, visual checks, and rollback drill before calling the work complete.

Antigravity should treat the numbers above as a verified baseline, not as constants to copy into code. When the Sheet changes, the dashboard must update only after a successful Google Sheet -> Prisma import.
