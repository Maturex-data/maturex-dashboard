# Shopify RAW.ORDER Sync Design

## Scope

Import Shopify orders created on or after `2026-01-01` into Neon through Prisma.
The business output is the `RAW.ORDER` structure from
`/Users/tatuanthanh/Downloads/[DEERLY] RAW DATA.xlsx`. Fulfillment, refund, and
raw JSON storage are outside this phase.

## Decisions

| ID | Decision |
| --- | --- |
| D1 | Use Neon PostgreSQL with Prisma. |
| D2 | Use `DIRECT_URL` for Prisma CLI and migrations; use pooled `DATABASE_URL` at runtime. |
| D3 | Seed from Shopify orders created on or after `2026-01-01`. |
| D4 | Sync is manual through the internal dashboard; no webhook or scheduled sync. |
| D5 | Import is append-only. Existing Shopify order IDs are skipped and never updated. |
| D6 | Retry transient Shopify failures and rate limiting up to three times with exponential backoff. |
| D7 | Persist one wide `raw_orders` table plus a technical `shopify_sync_runs` log. |

## RAW.ORDER Contract

`raw_orders` contains the following business columns:

`order_name`, `order_date`, `financial_status`, `fulfillment_status`,
`fulfillment_date`, `delivery_status`, `delivery_date`, `gross_sales`,
`discounts`, `shipping_charged`, `sales_tax`, `order_total_before_refund`,
`order_total`, `refund_amount`, `refund_date`, `items`, and `tag`.

The table also has two technical columns outside the exported contract:

- `shopify_order_id`, uniquely identifying Shopify orders and preventing duplicate imports.
- `synced_at`, recording when the row was added.

Monetary columns use exact decimal values. Missing source values remain `NULL`;
they are not converted to zero unless Shopify explicitly returns zero.

## Mapping Rules

- Monetary totals and refunds derive from Shopify order and refund totals.
- `items` is the summed quantity of all line items.
- Fulfillment fields derive from the latest fulfillment on an order.
- Delivery fields are set only when Shopify reports a fulfillment shipment status
  of `delivered`; otherwise they remain empty.
- `tag` preserves Shopify order tags without an application-level interpretation.

## Sync Behavior

The first sync paginates through all qualifying Shopify orders. Subsequent syncs
start from the newest stored order timestamp. Rows are inserted in small batches;
unique-key conflicts are skipped. A simultaneous sync is blocked while a run is
already active.

Each run records its lifecycle, page count, added count, skipped count, and any
terminal error in `shopify_sync_runs`. Shopify credentials stay server-side in
environment variables and are never exposed to the browser or application logs.

## Constraints And Acceptance Criteria

- Internal authenticated management users can trigger a sync.
- Transient network and `429` errors retry up to three times with backoff.
- The initial run handles unknown order volume through pagination and bounded batches.
- A repeated run does not duplicate rows.
- Existing rows are not changed after import, including later fulfillment,
  delivery, or refund updates.
- The data can be exported in the exact `RAW.ORDER` column order.
