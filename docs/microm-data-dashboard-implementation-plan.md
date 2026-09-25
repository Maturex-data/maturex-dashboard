# Microm data pipeline and dashboard: implementation plan for Antigravity

Status: design approved on 2026-09-25. Planning document only; no application behavior is changed by this file.

## 1. Objective and boundaries

Build `/microm` for the Microm management team. The end-to-end direction is **Microm Shopify + PGPrint + two Meta ad accounts -> Google Sheet -> Microm Prisma read projection -> `/microm`**. The dashboard must never call provider APIs or Google Sheets during a normal page view. Provide separate manual actions for platform-to-Sheet and Sheet-to-DB, plus a scheduled pipeline that runs them in that order.

Backfill begins **2026-01-01**. Scheduled runs begin at **09:00, 13:00, and 22:00 Asia/Ho_Chi_Minh**, one hour after EC's corresponding runs. Keep the EC and Flowa flows, schemas, credentials, routes, and sheet writes unchanged. Do not alter non-target tabs `PL`, `Payroll`, `Tools`, or `Sources` in the Microm spreadsheet. Do not turn this into a generic cross-team sync framework in this release.

The target workbook is `15zckwx3zC-bY_AJsl19mFS1oRz7QkFL6NEW2huhxpuo`, titled `Microm_PL_Aug2026`. The actual tab title is **`Orders`**, not `Ordes`. The other target titles are `COGS`, `Ads`, and `Shopify_Items`. Its timezone metadata is `Asia/Saigon`; use `Asia/Ho_Chi_Minh` for application day/month boundaries (same UTC+7 offset). The project OAuth connection can read the workbook; a different connected Google Drive identity returned 403, so deployment must use the project's stored OAuth connection and verify write permission before release.

The approved source scope is one Shopify store (`ib2w0p-ka.myshopify.com`), one PGPrint shop, and the two previously supplied Meta accounts (`1204086927598523`, `1734816417103349`). Never put credentials or tokens in source, Sheet, logs, or frontend. Existing `.env` has `MICROM_SHOPIFY_STORE_DOMAIN`, `MICROM_SHOPIFY_ACCESS_TOKEN`, `MICROM_PGPRINT_SHOP_ID`, `MICROM_PGPRINT_SECRET`, and `MICROM_META_ACCESS_TOKEN`, but no Microm Meta account-ID variable yet. Add a server-only configuration variable for the two account IDs; validate access to each account and its currency before backfill.

## 2. Verified Sheet contract (2026-09-25)

Read via the project's OAuth and Google Sheets API, not inferred from EC's schema. At inspection the workbook had 3 Orders, 1 COGS, 21 Ads, and 3 Shopify_Items rows. These counts are inspection fixtures, **not** acceptance totals for the 2026 backfill. `UNFORMATTED_VALUE` returned numeric date serials, so use an explicit Google Sheets date-serial parser or a date-render option with strict parsing. Do not store `46266` as a month.

| Tab | Columns in exact order | Grain / key | Currency |
| --- | --- | --- | --- |
| Orders | `Order ID`, `Shopify ID`, `Ngày tạo`, `Kỳ`, `Trạng thái thanh toán`, `Fulfillment`, `Currency`, `Subtotal`, `Discount`, `Shipping`, `Tax`, `Gross order`, `Doanh thu hợp lệ (EUR)`, `Nguồn dòng` | One Shopify order; Shopify ID as stable key, Order ID for display/join | EUR in current rows |
| COGS | `PGPrint Order ID`, `PGC Order ID`, `Customer Order ID`, `Ngày tạo`, `Kỳ`, `Status (source)`, `Currency`, `Production`, `Shipping`, `COGS source USD`, `COGS đủ điều kiện USD`, `Nguồn dòng`, `Kiểm soát` | One PGPrint order/cost row in current Sheet; prove upstream child-item grain before choosing unique key | USD in current row |
| Ads | `Account`, `Account ID`, `Ngày`, `Kỳ`, `Spend USD`, `Impressions`, `Clicks`, `Purchases`, `Nguồn dòng`, `Kiểm soát` | Account-day, **not** account-only; unique `(account ID, date, granularity=account-day)` | USD in header; verify actual Meta account currency |
| Shopify_Items | `Order ID`, `Line Item ID`, `Tên sản phẩm`, `SKU`, `Quantity`, `Line total`, `Currency`, `Fulfillment`, `Nguồn dòng` | One Shopify line item; Line Item ID stable key; join Orders by Order ID | EUR in current rows |

Current Ads rows include multiple dates for the same account and multiple periods. Do not use `Account ID` alone as a key. COGS has a row with blank source status and positive source cost but **zero eligible cost**; retain it for audit and do not infer eligibility from cost alone. Orders include voided/unfulfilled rows with zero eligible revenue; retain them but exclude from eligible-order/revenue KPIs. Never add `Shopify_Items.Line total` on top of order revenue or campaign-level Meta rows on top of account-day spend.

## 3. Architecture and choices

**Chosen approach:** Microm-specific source adapters, four Sheet-aligned Prisma projection models, import-run and active-snapshot metadata, and Microm dashboard components. Reuse existing date/money/OAuth/UI helpers only where contracts genuinely match. Do not retarget EC helpers that read `SHOPIFY_*`, `PGPRINT_*`, or `META_*` env vars: they currently point to EC. Either inject credentials/account IDs into reusable pure fetchers or create Microm wrappers with isolated env names. Avoid copying provider pagination/signing code without tests.

**Alternatives considered:** (a) dashboard reads Google Sheets directly, rejected for page latency/availability; (b) generic multi-team database/scheduler refactor, rejected for EC regression risk and different Microm grains; (c) API directly into DB then Sheet, rejected because this workbook is the designated accounting/audit layer.

Keep two independently retryable stages and one orchestration record. Platform-to-Sheet writes only the four named tabs. Sheet-to-DB reads all four named tabs, validates their headers and rows, inserts a new batch, then atomically switches a Microm-only active pointer. A failure never replaces the last good snapshot. The two manual buttons can run separately; the scheduled pipeline executes Sheet import only after all provider-to-Sheet stages complete and their write/reconciliation passes. Record the write-run ID and per-tab fingerprints after a complete provider reconciliation. If a provider run is partial, the Sheet-to-DB action must show `not ready to import` and refuse activation, including when an admin presses it manually. If the Sheet was edited after provider reconciliation, show the changed tabs/totals and require explicit admin acknowledgement of the unmatched edit before activation; the import run must record that exception and must not label it provider-reconciled. Show per-source results and freshness for both stages.

## 4. Provider-to-Sheet implementation

### Shopify Orders and Items

- Verify the Microm token has the required Admin API order scopes and historical access. Fetch orders created on/after 2026-01-01 with pagination; capture stable Shopify order and line-item IDs, source timestamps, payment and fulfillment states, money/currency fields, refunds/edits, and raw provider IDs for audit.
- Map one order to one `Orders` row and each line item to a `Shopify_Items` row. Define `Doanh thu hợp lệ (EUR)` from a documented Shopify source/calculation consistent with existing Sheet formulas; do **not** assume `Gross order`, subtotal, or line totals are interchangeable. Test voided, cancelled, refunded, partially fulfilled, zero-value, and edited orders. Mark calculated values explicitly.
- Use an update cursor or a rolling lookback for changed older orders; a created-at-only daily cursor misses late refunds/status changes. Backfill in bounded date windows, with page/cursor checkpoints, rate-limit backoff, and resumability. Do not replace the whole workbook on every scheduled run.

### PGPrint COGS

- Use Microm credentials only. Inspect the real PGPrint response grain: an order with multiple child details may require one Sheet row per child with a composite stable key. The current Sheet has one row; do not silently sum a parent total once per child. Map production, shipping, source cost, status, customer-order match, and eligibility with explicit rules.
- Match to Shopify using a stable customer/order ID where possible; unresolved or blank-status rows stay visible with `COGS đủ điều kiện USD = 0` and an audit reason in `Kiểm soát`. Do not mark a cost eligible solely because it is positive. Preserve historical source cost and mapping evidence. Revisit unresolved and previously ineligible PGPrint orders on scheduled runs when their status or Shopify match can change; provide a bounded historical correction/reconciliation path so older rows are not frozen at zero.
- Paginate with bounded concurrency and retry/backoff. Record provider checkpoint and per-window totals; rerunning a range updates existing keyed rows rather than duplicating them.

### Meta Ads

- Fetch **account-day** insights for exactly the two approved accounts, from 2026-01-01. Verify each account's currency **and reporting timezone**. Meta `date_start` is an account reporting day, not automatically a Vietnam-local instant: record the account timezone and use an explicitly verified mapping to the Sheet's `Ngày`/`Kỳ`. If an account day crosses a Vietnam month boundary, reconcile the intended workbook treatment before backfill; do not silently shift it. Write `Spend USD` only when the source is USD or after an explicitly documented conversion; never label arbitrary account currency as USD.
- Use `(account ID, date)` at the account-day level as the logical key. Query bounded date windows with pagination/rate-limit handling and retain account/day IDs. Recheck a documented recent window on each run and support explicit older-period reconciliation for revised historical Meta insights; otherwise old account-days could remain stale. Do not append campaign-level insights into the same tab, which would double ad spend.

### Google Sheet write safety

- Read header rows and reject schema drift before writing. Keep the existing column order/formulas/formatting and the four non-target tabs untouched. Do not clear whole tabs; upsert by stable keys (or atomically replace a validated bounded range if that is proven safe for the workbook's formulas and filters). Include a clear `Nguồn dòng` trace that does not contain tokens or local private paths.
- Validate counts, unique keys, min/max dates, currency, and source-vs-written Decimal sums per provider/window. A partial provider failure leaves the existing Sheet intact for that source and prevents the scheduled Sheet-to-DB stage. Record run states and actionable failures; do not report success merely because an HTTP request returned 200.

## 5. Sheet-to-Prisma projection

Create additive Microm-specific Prisma models for `Orders`, `COGS`, `Ads`, and `Shopify_Items`, plus source-sync runs, Sheet-import runs, and an active-snapshot pointer. Use `Decimal` for money and FX, date-only types for business days, UTC `DateTime` for instants, source IDs as text (avoid integer precision loss), and raw row JSON for audit. Every projected row has a batch ID, source row number, logical key, period, and indexes for month/filter/sort. Source row position is **not** a unique key. Do not delete or repurpose EC models.

Strictly parse both formatted date strings and Google serial dates, header names/order, integer quantity, currency, optional blanks, and locale-formatted decimals. Verify `Kỳ` against the parsed business date in Vietnam time. Reject duplicate logical keys and nonempty invalid amounts with sheet/row/column detail. Compare parsed counts and Decimal totals against inserted data. Publish all four models via one Microm active-snapshot switch; retain the previous successful batch. A no-change shortcut must include spreadsheet ID **and all relevant values**, not just IDs/counts, and must update the last-successful-check timestamp without changing the last-data-change timestamp. Use a DB-backed lock with heartbeat per batch and stale-run recovery. Keep Microm locks separate from EC locks.

Fixed reporting FX approved for all history from 2026-01-01: **1 EUR = 1.15 USD**. Preserve `EUR` amount and original currency in Sheet and DB; store `fx_rate=1.15` and `revenue_usd_calc` in the Prisma projection (or a versioned aggregate), clearly marked `calc`. Do not insert columns into Orders solely for this conversion, because existing PL formulas may depend on its range. `Gross order` and eligible revenue must use distinct conversion fields. If an unexpected currency appears, fail or quarantine that row rather than applying the EUR rate. A future change to FX policy requires a versioned re-import/recalculation, not a silent retroactive rewrite.

## 6. `/microm` dashboard and navigation

- Build `/microm` as a Next.js Server Component backed by the active Microm DB snapshot; use client components only for interactive filters/table controls. Reuse the compact EC visual language, not its labels or Payouts tab.
- Cards: eligible order count; eligible revenue USD (`calc`, with EUR original visible); Meta spend USD; eligible COGS USD. An additional contribution figure may be shown as `estimated / calc = eligible revenue USD - eligible COGS USD - Meta spend USD`, **not** net profit or the workbook's full PL: Payroll, Tools, payment fees and other costs are outside this scope. Missing sources must display incomplete-data status, not `$0`.
- One month filter (current Vietnam month if it has a published complete snapshot; otherwise latest published month with data), real monthly trends/cost composition, and four detail tabs `Orders`, `COGS`, `Ads`, `Shopify_Items`. Distinguish `no activity` (confirmed zero source rows) from `not imported` (no verified snapshot). Server-side pagination (50 default), search, sorting, relevant filters, bounded scroll, currency labels, source/eligibility flags, and source/DB freshness. All KPI/chart/table totals must derive from the same active batch and use Decimal until display.
- Provide CSV/XLSX export from the active DB snapshot with source columns in the same order as the Sheet, plus clearly labeled derived fields if requested. Never query providers/Google as part of a dashboard page or export request. Provide loading, empty, stale, partial-source, and failure states.
- Change the Microm team-switcher href to `/microm`; add Microm-specific sidebar navigation. Redirect `/dashboard?team=microm` to `/microm` if an existing bookmark uses it; do not redirect unrelated `/dashboard` visits or Pocdy. Keep existing EC and Flowa navigation unchanged.

## 7. Scheduling, security, and operations

Use the existing deployment scheduler pattern (GitHub Actions if confirmed for production) for Microm. The requested local times map to **02:00, 06:00, 15:00 UTC**. Scheduled workflows can be delayed; show actual start/finish times and last successful data check rather than implying exact-minute execution. Configure secrets separately from EC and validate the production base URL. One scheduled invocation orchestrates both stages sequentially; do not create two independent crons with a fixed-minute offset, which would import a half-written Sheet after a slow API run.

Protect the scheduled endpoint with a Microm-specific bearer secret, bypassing cookie auth only on that exact path; the route must still reject missing/invalid secrets. Manual routes remain admin-only. Do not log secrets or raw customer information. Give each source bounded retries and a maximum runtime; if historical backfill exceeds a request limit, use persisted, resumable jobs rather than `after()`/fire-and-forget inside a serverless request. Never run the full 2026 backfill on every schedule. Separate historic backfill from short daily incremental windows and define overlap for late updates.

Record run ID, trigger type, stage/source, start/end, range, checkpoint, counts, sums, error category, last completed provider reconciliation, last Sheet write, last successful Sheet check, and last DB snapshot publication. Label these timestamps separately in the UI. Lock against simultaneous manual/scheduled Microm jobs. If API-to-Sheet fails, skip Sheet-to-DB for that scheduled run and retain the last DB snapshot. If Sheet-to-DB fails, preserve the newly written Sheet but keep the old active DB snapshot and show the divergence prominently. A `partial-source` state refers to a failed **new** run while the prior complete snapshot remains on-screen; show that snapshot's timestamp next to its numbers. Provide an operator retry path and retain at least one prior DB batch for rollback.

## 8. Verification and release gates

1. Confirm Shopify historical scope, PGPrint pagination/grain/status fields, Meta access to both accounts/currencies, and project OAuth read/write permission for this workbook. Stop with an explicit blocked status when access is absent; do not invent data.
2. Verify provider adapters on a narrow date range first. Compare raw API IDs/counts/sums against four written tabs. Test repeated sync, changed old order, refund/void, multi-item order, multi-child PGPrint cost, unresolved COGS, zero cost, two Meta accounts on the same day, and API 401/403/429/5xx.
3. Verify Sheet import with formatted and serial dates, blank/duplicate keys, changed headers, mixed decimal formats, unexpected currency, empty month, and a crash mid-batch. Confirm active snapshot remains unchanged on any failure and no-change imports refresh only `lastCheckedAt`.
4. Reconcile Sheet and DB per month and source: row counts, distinct keys, earliest/latest dates, EUR source totals, USD costs/spend, and derived USD revenue at 1.15 (tolerance USD 0.01 after final rounding). Prove Items are not added to order revenue and account-day Ads are not double-counted.
5. Test manual and scheduled entrypoints with invalid/valid secret and concurrent runs in an **isolated test DB/workbook**. Never reset production locks or mutate production `lastCheckedAt` from a test script. Measure normal `/microm` load and table pagination; inspect network/server logs to prove zero Google/provider calls during page views.
6. Check desktop/mobile visual behavior and navigation; run TypeScript, Biome, focused tests, production build. Roll back to the previous active batch on a rehearsal run. Do not call the feature complete until the four Sheet totals and dashboard totals reconcile.

## 8a. Structured design review and resolutions

The high-impact design was reviewed sequentially by a Skeptic, a Constraint Guardian, and a User Advocate before implementation handoff. Their objections and resolutions are part of the decision log:

| Objection | Resolution |
| --- | --- |
| A partial provider run can leave four tabs from different runs, and manual Sheet import could publish them as one snapshot. | Require complete provider reconciliation and per-tab fingerprints before activation. A partial run is `not ready to import`; manual import cannot bypass it. |
| A human edit after provider reconciliation can be valid yet break source-to-Sheet equality. | Report exact changed tabs/totals and require explicit admin acknowledgement; record the exception and do not claim provider-reconciled status. |
| Meta account-day may not use Vietnam timezone, so month boundaries can be mislabeled. | Verify and record each account's timezone; settle the `Ngay`/`Ky` mapping against the workbook before backfill. Never silently reinterpret account-local dates. |
| Older Meta spend or PGPrint status/order matches can change after a short incremental window. | Revisit a documented recent window each run and support explicit older-period reconciliation. Include previously ineligible PGPrint rows in status/match reevaluation. |
| Two manual actions can confuse admins about whether to proceed after a partial run. | Show per-source result and an explicit ready/not-ready gate before Sheet import. |
| Current-month default, freshness labels, and partial-source states could make stale data look current. | Fall back to latest published month; distinguish confirmed zero from not imported; label source/Sheet/DB timestamps and show old snapshot date whenever a new run fails. |

Arbiter outcome: all six objection groups above are **accepted and resolved** by the stated gates and UI contracts; none is rejected. The reviewed design is acceptable for implementation handoff. Live API access, source formulas, currency/timezone mapping, and OAuth write permission remain release gates to verify with real data, not assumptions of success.

## 9. Decision log and assumptions

| Decision | Alternatives | Reason |
| --- | --- | --- |
| Dedicated Microm projection and UI | Generic multi-team refactor | Different grains/currencies; protect EC stability |
| API -> Sheet -> DB -> dashboard | Direct Sheet render; API -> DB first | Accounting Sheet remains audit source; DB gives fast reads |
| Two manual actions, one sequential scheduled pipeline | One opaque sync button; independent timed jobs | Clear fault isolation and no half-written Sheet import |
| Backfill from 2026-01-01 | All-history crawl | Explicit user scope, bounded cost |
| Fixed EUR -> USD at 1.15, derived in DB | Daily FX; monthly FX; mutate Sheet | Explicit approved internal reporting rule, auditable source amounts |
| Microm starts one hour after EC | Same schedule | Avoid shared OAuth/API/DB contention |

Assumptions: only existing admins use these tools; traffic is internal and moderate; source rows increase over time; correctness/recoverability outrank real-time updates; API tokens and OAuth are maintained by the management team. The initial workbook row counts are illustrative, not backfill acceptance targets. The exact Shopify revenue eligibility formula and PGPrint child-item mapping must be verified from live API payloads and the workbook's existing formulas before implementation is considered complete.
