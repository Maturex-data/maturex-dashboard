# EC Sheet-to-DB scheduled sync: Antigravity implementation plan

Status: design approved on 2026-09-24. This document does not authorize changes to the upstream `/ec-drive-sync` flow.

## Goal and current baseline

The existing direction is partner/platform APIs -> `/ec-drive-sync` -> Google Spreadsheet -> Prisma projection -> EC dashboard (`/`). The dashboard already reads `EcSheetActiveSnapshot` and the four `EcSheet*` projection tables; it does not need a new read architecture. A manual "Dong bo tu Google Sheet" button already calls `POST /api/ec/sheet-import` and invokes `executeSheetImport`.

Add a deployment-platform scheduled trigger for 08:00, 12:00, and 21:00 **Asia/Ho_Chi_Minh** every day. Keep the manual button. Both triggers must use the same importer and validation/publish path, with distinct `manual` and `cron` actors in run history. The scheduler must not call supplier APIs or write to the spreadsheet.

**Hard boundary:** Do not change `/ec-drive-sync`, `/api/ec/drive/sync`, `/api/ec/drive/clear-report`, its provider fetchers, mappings, clear behavior, OAuth connection flow, or upstream scheduling. The four Sheet tabs are `Orders`, `COGS`, `Ads`, and `Payouts`; Payouts is Shopify Payments, not Airwallex.

The broader source mapping, numerical baseline, and dashboard release gates are in [ec-dashboard-google-sheet-import-plan.md](./ec-dashboard-google-sheet-import-plan.md). Inspect the current implementation before coding; some of that earlier plan is already implemented.

## Architecture decision

Use the deployment platform's native cron to call a separate, protected server endpoint. Do not rely on a timer inside a Next.js process: it would stop during scale-down/restarts and could run on multiple instances. Keep `POST /api/ec/sheet-import` admin-only for manual requests. The cron endpoint authenticates a secret held only in deployment environment variables and calls the same `executeSheetImport` service. Never pass that secret to the browser or log it.

The deployment provider has not been named. Antigravity must identify it from deployment configuration or confirm it before adding provider-specific cron files. Use three daily schedule entries if the provider requires UTC cron expressions; Asia/Ho_Chi_Minh is UTC+7 and has no daylight-saving change. Document the exact UTC schedules and verify each maps to 08:00, 12:00, and 21:00 local time. Configure cron execution duration/limits consistent with the measured import time; do not assume `maxDuration = 300` guarantees the host will run that long.

## Concurrency and publication

1. Give both triggers the same DB-backed lock. Acquire it atomically before creating an import run or reading Google. A read-then-create check is insufficient under simultaneous manual/cron requests. The loser returns a clear `already running` result without starting another import.
2. Record heartbeat/progress during long imports. Define a stale threshold longer than a healthy batch interval; expired jobs may be marked failed and their lock reclaimed. An ordinary failure releases the lock in `finally`. Avoid a stale first worker publishing after a second worker takes over: verify lock ownership at the publish transaction.
3. Do not import while any relevant `/ec-drive-sync` run is writing the spreadsheet. Check once before Google reads and once before publishing. This protects against a partial clear-and-write cycle without modifying the upstream flow.
4. Parse and validate all four sheets before publishing. Check exact headers, valid keys, dates, money/currency, duplicate IDs, inserted row counts, and monthly totals using Decimal arithmetic. Preserve zero-cost COGS rows. Fail with sheet/row/column detail rather than coercing invalid nonempty amounts to zero.
5. Insert a new batch, then atomically switch `EcSheetActiveSnapshot.activeRunId` only after all four datasets and checks pass. On any failure, continue serving the previous active batch. Retain at least one previous successful batch for rollback and clean up failed/unpublished batches on a bounded retention schedule.
6. If the sheet content has not changed, the run may finish as `no change` rather than publishing a duplicate batch, but only after comparing robust per-sheet content fingerprints or source revisions. Do not infer equality from row count or ID-only checksums; edited amounts with unchanged IDs must be detected.

## API and operational behavior

- Manual trigger: preserve the current admin permission check and user feedback. Show a running state and distinguish `already running`, upstream Sheet write in progress, authentication failure, validation failure, and success.
- Scheduled trigger: reject missing/invalid secret with 401; never accept an arbitrary spreadsheet ID from the scheduler. Return a small structured status with run ID, outcome, and elapsed time. Do not expose source rows or credentials.
- Store trigger type (`MANUAL`/`CRON`), start/end time, per-sheet counts and sums, error category, and last successful sync time in import-run metadata. If schema fields are added, use an additive migration and keep older runs readable.
- Show dashboard freshness based on the **last successful** active batch, not the last attempted run. A failed cron must leave the dashboard usable and visibly stale. Log `runId` and timestamps in Vietnam time for operators; store instants in UTC.
- Put scheduler secrets in deployment environment variables. Reuse the existing Google OAuth token access on the server. Verify token refresh and distinguish Google 401/403/429 from parse errors. If OAuth requires interactive reconnection, surface an actionable alert; do not retry endlessly.

## Implementation sequence for Antigravity

1. Inventory the deployment provider and its cron/runtime limits. Inspect the existing importer, run schema, status endpoint, manual button, and dashboard queries. Capture current sheet and DB row counts/sums as a baseline. Confirm the target production spreadsheet ID; do not change it in this task.
2. Add shared atomic locking, heartbeat/stale recovery, and ownership checks to the Sheet-to-DB importer. Ensure cleanup on failure and preserve active snapshot rollback.
3. Add the secret-protected cron endpoint calling the same importer, with trigger metadata and bounded error responses. Keep the manual endpoint/button intact.
4. Configure three schedules in the deployment platform for 08:00, 12:00, and 21:00 Vietnam time. Record UTC conversion and deployment prerequisites; test the deployed scheduler with one safe invocation before enabling the recurring schedule.
5. Improve status visibility for manual and cron runs without changing `/ec-drive-sync`. Make stale-data and failed-run states explicit.
6. Add focused tests and perform Sheet-vs-DB and dashboard-vs-DB reconciliation. Measure dashboard response time and verify its page/view requests make zero Google Sheets API calls.

## Acceptance tests

- Manual and cron triggers run the same validation and publish path; both update the dashboard only via the active DB snapshot.
- Two simultaneous triggers result in one writer; a crashed/stale writer cannot hold the lock forever or publish after losing ownership.
- An upstream `/ec-drive-sync` run in progress blocks Sheet-to-DB import without altering upstream behavior.
- A malformed cell, missing sheet, expired OAuth token, Google 429, failed insert, or runtime interruption does not replace the last good snapshot.
- Running import twice on unchanged data does not double dashboard totals. Editing an existing Sheet amount with unchanged row ID is reflected after the next successful import.
- Per-month row counts and Decimal totals match all four source sheets within USD 0.01, then match KPI/cards/charts/tables derived from the active batch.
- Cron executions occur at all three requested local times; dashboard freshness/status shows the actual last success and flags failures.
- No dashboard page view calls Google Sheets or any supplier API. `/ec-drive-sync` files and behavior are unchanged.

## Decision log and open deployment detail

- Chosen: keep manual sync and add deployment-platform cron.
- Rejected: in-process timer or machine-local cron, because availability and single-instance behavior are not guaranteed.
- Chosen: one importer and atomic batch publication for both triggers.
- Open: exact platform-specific configuration, secret naming, duration setting, and alert delivery depend on the confirmed deployment host. Do not invent or deploy a provider-specific schedule until the host is identified.
