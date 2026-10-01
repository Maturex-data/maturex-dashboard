# EC Progress and Daily KPI Page

Status: design approved; implementation has not started.

## Understanding summary

- Add a dedicated `/ec/progress` page under the EC workspace. Keep `/ec` and `/ec/business-report` unchanged.
- Show the `Tiến độ Q4 2026` and `KPI ngày T10 2026` tabs from the existing EC Google spreadsheet.
- Render the Sheet cell values in read-only, scrollable tables, preserving row and column order.
- Do not calculate KPIs, derive totals, write to Sheets, or store a copy in the database.
- Load fresh values when the page opens and provide a manual **Làm mới** action. Do not poll automatically.
- Require a valid application JWT for both the page and its refresh endpoint. The intended audience is the EC team.

## Assumptions and validation notes

- Use `REPORT_SPREADSHEET_ID`, whose default matches the spreadsheet URL supplied by the user.
- The app's existing Google OAuth connection can read both named tabs. The assistant's Google Drive connector returned 403, so verify access through the app OAuth before implementation is considered complete.
- The two tabs are small enough to read in one Sheets `values:batchGet` request and render in a scrollable table. If this proves false, agree on pagination before adding it.
- “Close to the Sheet” means formatted cell values and their order, not exact colors, merged cells, row heights, or other spreadsheet formatting metadata.
- If a read fails, show a clear error and hide values from an earlier load so the page cannot imply stale data is current. Provide retry through **Làm mới**.
- No additional role policy beyond a valid JWT is requested.

## Decision log

| Decision | Alternatives considered | Reason |
| --- | --- | --- |
| Add `/ec/progress` as a separate page | Replace `/ec/business-report`; combine with `/ec` | Keep the existing financial dashboard and direct business report intact. |
| Read both tabs directly from Google Sheets on the server | Import to a database projection; embed the Sheet in an iframe | Keeps the source as the live authority, avoids new storage/import logic, and protects OAuth tokens from the browser. |
| Display basic read-only tables | KPI cards, charts, reconstructed spreadsheet styling | The requested outcome is to show source values without calculations; exact Sheet formatting is not required. |
| Load on open and refresh on demand | Periodic auto-refresh; open-only without refresh | Provides current values while keeping API traffic predictable and user-controlled. |
| Require a valid JWT on the page and refresh API | Follow current dashboard access exactly; admin-only | KPI data is internal, and the user explicitly requested authenticated access. |
| Hide old values after a failed refresh | Keep a possibly stale snapshot visible | Avoid presenting old data as fresh when the source read failed. |

## Final design

### Route and data flow

1. Add a server-rendered page at `src/app/(dashboard)/ec/progress/page.tsx` and an EC navigation item named **Tiến độ & KPI**.
2. The page verifies the `mx_access_token` cookie with the existing JWT verifier. Redirect users without a valid session to `/auth/login`.
3. Add a server-only reader in `src/lib/ec-progress-sheet.ts`. Reuse `getGoogleDriveAccess()` and the configured `REPORT_SPREADSHEET_ID`.
4. Read the two ranges in one request:
   - `'Tiến độ Q4 2026'!A:ZZ`
   - `'KPI ngày T10 2026'!A:ZZ`
5. Request `FORMATTED_VALUE`, normalize sparse rows to rectangular string matrices, and return only the two requested tabs. Do not log or return access tokens.
6. Render the initial values from the server. A JWT-protected `GET /api/ec/progress` endpoint uses the same reader for manual refresh; it refreshes both tabs together.
7. Do not add Prisma models, migrations, Google writes, scheduled jobs, calculations, charts, exports, or provider API calls.

### UI behavior

- Show two tabs with the exact source names and a read-only grid for each.
- Preserve row order, column order, formatted values, and blank cells within returned rows. Use horizontal and vertical scrolling for wide/tall sheets.
- Include a loading state, an empty-sheet state, a localized error state, a retry button, and the last successful fetch time.
- On refresh, replace both tabs as one result. If the batch read fails, clear displayed values and show the error rather than retaining stale rows.
- Leave `/ec` and `/ec/business-report` behavior unchanged.

### Access, reliability, and performance

- Authenticate both the server page and refresh endpoint with the app's JWT cookie. Keep all Google API calls server-side.
- Use the existing Google OAuth token refresh/access path. Handle 401, 403, 429, network errors, and missing tab/range with actionable messages that do not expose credentials.
- Issue one batch read at initial page load and only on explicit refresh. No client-to-Google requests, automatic polling, or persistent cache.
- Assume one EC team and moderate sheet sizes. If actual ranges are too large for one responsive table, pause and agree on pagination rather than adding it silently.

### Acceptance checks

- Both exact tabs load in the page using the configured spreadsheet ID and server OAuth.
- Cell text and row/column order match the values returned by Google Sheets; no derived KPI values appear.
- Loading, empty, authenticated, unauthorized, Google error, and manual refresh states are handled.
- Google tokens never reach the browser, and no write request or database persistence is introduced.
- Existing `/ec` and `/ec/business-report` behavior remains unchanged.

## Implementation handoff

Before coding, re-read `AGENTS.md`, `ARCHITECTURE.md`, and the relevant Next.js guide under `node_modules/next/dist/docs/`. Verify the app OAuth can read both tabs without using the assistant connector. Preserve all unrelated working-tree changes.
