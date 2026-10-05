# Microm Orders delivery

Spreadsheet: `15zckwx3zC-bY_AJsl19mFS1oRz7QkFL6NEW2huhxpuo`, tab `Orders`.

Existing financial columns A:N stay in place. Additional columns:

| Column | Header | Shopify source |
| --- | --- | --- |
| O | Fulfillment status | Order.displayFulfillmentStatus |
| P | Fulfillment ID | Fulfillment.id |
| Q | Tracking number | trackingInfo.number |
| R | Carrier | trackingInfo.company |
| S | Shipment status | Fulfillment.displayStatus |
| T | Delivered at | Fulfillment.deliveredAt |
| U | Shipped at | Fulfillment.inTransitAt |
| V | Delivery source | Shopify fulfillment |
| W | Delivery updated at | Latest event.createdAt, only when its status matches displayStatus |

Use only MICROM_SHOPIFY_STORE_DOMAIN and MICROM_SHOPIFY_ACCESS_TOKEN. Fetch GraphQL order nodes in batches of 100. Keep ISO timestamps including timezone; missing timestamps remain blank. Never substitute updatedAt or fulfillment.createdAt for delivery/shipping time. Multiple fulfillments use aligned newline separated values.

Both manual sync and scripts/sync-microm-upstream.ts use the shared Microm Shopify adapter. Orders writer reads, sorts and writes all A:W so delivery information remains attached to its Shopify ID. Financial reconciliation hashes only A:N.

Backfill existing rows:

```sh
USE_NATIVE_PRISMA=true node --import tsx --env-file=.env scripts/backfill-microm-order-delivery.ts
USE_NATIVE_PRISMA=true node --import tsx --env-file=.env scripts/backfill-microm-order-delivery.ts --apply
```

The script holds the existing Microm database lock, backs up rows locally, writes only O:W and verifies A:N was unchanged. Deploy the updated writer before scheduled sync sorts Orders again.
