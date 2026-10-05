# EC Orders: fulfillment and delivery

The EC report spreadsheet Orders tab keeps its accounting columns A:M. Columns N:V add:

| Column | Header | Shopify source |
|---|---|---|
| N | Fulfillment status | Order.displayFulfillmentStatus |
| O | Fulfillment ID | Fulfillment.id |
| P | Tracking number | Fulfillment.trackingInfo.number |
| Q | Carrier | Fulfillment.trackingInfo.company |
| R | Shipment status | Fulfillment.displayStatus |
| S | Delivered at | Fulfillment.deliveredAt |
| T | Shipped at | Fulfillment.inTransitAt (start of transit) |
| U | Delivery source | Shopify fulfillment (API provenance; does not identify who created an event) |
| V | Delivery updated at | createdAt of latest FulfillmentEvent, only when its status matches displayStatus |

Time fields retain the original ISO 8601 timestamp with timezone (`Z` means UTC). They are fetched directly from Shopify for the Sheet; the date-only RawOrder.deliveryDate database column is not used. Missing values stay blank. Fulfillment.createdAt and updatedAt never substitute for delivery or shipping timestamps.

For multiple fulfillments, each fulfillment occupies the same line in columns O:V, including blank lines. Tracking numbers within one fulfillment are separated by ` | `. Order-level fulfillment status does not prove delivery. A delivered timestamp for one fulfillment does not prove all packages in an order arrived.

Manual EC Drive sync and `scripts/sync-upstream.ts` share the same mapper and append headers after checking existing A:M and N:V headers. The accounting importer still reads A:M, so these extra columns do not affect financial calculations.

Existing Orders rows can be filled without rewriting accounting columns:

```sh
USE_NATIVE_PRISMA=true node --import tsx --env-file=.env scripts/backfill-ec-order-delivery.ts
USE_NATIVE_PRISMA=true node --import tsx --env-file=.env scripts/backfill-ec-order-delivery.ts --apply
```

The first command previews counts. The second saves a private temporary backup, checks that A:M did not change while Shopify was being read, writes only N:V, and verifies the values after writing. Unmatched order names or unexpected headers stop the operation.
