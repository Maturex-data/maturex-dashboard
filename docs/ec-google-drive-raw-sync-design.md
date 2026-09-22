# EC Google Drive Raw Sync Design

## Understanding Summary

- Add an independent EC page that syncs source data from platforms to Google Drive for accounting review and reconciliation.
- Existing Prisma data, dashboard views, and all current sync flows remain unchanged and independent from this feature.
- Data is organized per shop so accounting can locate and reconcile a shop's source files without mixing tenants.
- The first release covers Shopify, Meta Ads, Airwallex, PGPrint, Printify, Printful, Luxury Pro, and future EC partners.
- Google OAuth opens a user login URL. The authorized user completes consent themselves; no Google password is collected by the application.
- The feature is for senior management only and prioritizes reliable, traceable exports over maximum throughput.

## Confirmed Assumptions

- Create a Google Drive root folder named `MatureX - EC Raw Data` in the Drive account authorized through OAuth.
- Use one folder tree per shop, source, year, and month.
- Syncs create or update a source snapshot identified by shop, source, and reporting period. A separate version action is required to create an additional version.
- The default sync range is the latest completed/current month. Users may select a month, date range, or full history.
- Meta Ads exports are available only after its token has valid API and ad-account permissions.

## Architecture

### Google Drive Connection

The application uses a server-side Google OAuth installed client flow. The browser is redirected to Google's consent screen with the Google Drive scope required to place source folders inside the accounting-owned `Data` folder. The OAuth callback stores a refresh token, the authorized Google email, connection state, and timestamps in secure server-side storage. Client secret and refresh token are never sent to the browser or included in source exports.

The connection area supports connect, reconnect, and disconnect. Disconnecting removes stored authorization material but does not delete files previously created in Google Drive.

### File Layout

```text
MatureX - EC Raw Data/
  {Shop}/
    Shopify/
      {Year}/
        {YYYY-MM}/
          raw-orders.xlsx
    Meta Ads/
    Airwallex/
    PGPrint/
    Printify/
    Printful/
    Luxury Pro/
```

Each XLSX uses source-oriented sheets such as `Orders`, `Items`, `Refunds`, and `Transactions`. Files preserve raw API meaning. They may add only provenance columns required for reconciliation: `source`, `shop`, `synced_at_utc`, and a `raw_payload` field where a source response cannot be represented faithfully in ordinary columns. No dashboard-derived or `calc_*` fields are added.

### Sync Jobs

The page creates a distinct job per selected shop, source, and period. Each adapter calls its external platform API directly; no existing Prisma table is treated as the source for the Drive export. A source failure does not block other selected sources. Long jobs run in the background with per-source checkpoints, bounded retries for transient/rate-limit failures, and a single-job lock for identical shop/source/period work.

The job records requested range, caller, timestamps, rows read, rows exported, Google Drive file ID/URL, status, and actionable error details. Retry reruns only failed sources.

### Page Design

The `EC Drive Sync` page has three operational areas:

1. Google Drive connection: authorized email, token health, root folder, and connect/disconnect actions.
2. Sync queue: shop, source selection, date/month controls, a sync action, and live source progress.
3. File history: shop, source, period, row count, status, actor, completion time, file link, and retry action.

## Security and Reliability

- Restrict the page and its API routes to senior-management roles.
- Store OAuth tokens and client credentials only in server-side protected configuration/storage.
- Request the Google Drive scope needed to access the existing accounting-owned `Data` folder. This broader access was explicitly approved so the export root can be stored inside that folder.
- Keep a durable audit trail for each sync request and outcome.
- Prevent duplicate concurrent jobs for the same shop, source, and period.
- Make failure states explicit. Missing source access must not appear as a zero-row successful export.

## Decision Log

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| User OAuth with refresh token | Service account; manual upload | Files belong to the accounting-owned Drive and the user explicitly wants an OAuth login link. |
| Server-side OAuth and upload | Browser-side Drive API | Keeps client secret and refresh token out of the browser. |
| Google Drive scope | `drive.file` scope | `drive.file` cannot discover or use the existing accounting-owned `Data` folder; the approved broader scope is required for the requested folder placement. |
| Source APIs export directly to Drive | Export from existing Prisma data | Preserves source data and isolates the Drive feature from dashboard data pipelines. |
| Folder hierarchy by shop/source/year/month | One shared folder or one file per team | Makes accounting review and per-shop reconciliation predictable. |
| Per-source jobs and retries | One all-or-nothing job | A failed API integration, including Meta, must not block other exports. |
| Latest month by default | Full-history sync by default | Avoids unnecessary API volume while retaining explicit historical sync options. |
