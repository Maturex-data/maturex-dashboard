# Microm MerchOne COGS sync

- Scheduled workflow: `microm-pipeline-cron.yml`, 09:00 / 13:00 / 22:00 Asia/Ho_Chi_Minh.
- Credentials: `MICROM_MERCHONE_API_USER`, `MICROM_MERCHONE_API_KEY` (Basic Auth, server only).
- Read-only provider API v1: orders list with pagination, then order details. Full scan refreshes historical statuses.
- Match `external_id` exactly to Shopify Microm order name. Include persisted Orders mappings for history beyond Shopify's access window. Missing external ID leaves reference blank; ambiguous or unknown nonempty reference stops this provider.
- Sheet: Microm spreadsheet / COGS. Supplier key `PPO...`; legacy `PP0` + 8 digits canonicalizes to `PPO` + digits. Reject duplicate keys.
- Production and shipping retain EUR values. Total API amount (including tax) writes to N: Chi phí nguồn EUR. J/K USD stay blank without approved FX. Existing approved USD/formulas survive unchanged EUR amounts; source total changes invalidate old USD values.
- O retains country. No customer contact/address data fetched into Sheet.
- Update existing rows or append new ones; never clear COGS in the MerchOne writer. Verify readback; fail run if a provider fails.
- PGPrint writer preserves A:O including EUR columns when sorting. Existing non-MerchOne rows are preserved by MerchOne import.
- Sheet-to-DB currently retains original EUR values in rawValues; blank USD parses as zero in numeric DB columns. Do not treat that as confirmed zero cost or a reconciled USD P&L; approved FX integration remains separate.
- Tests: `node --import tsx --test src/lib/__tests__/microm-merchone.test.ts`.
