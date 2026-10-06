# Fastway → RAW.COGS

Destination: spreadsheet `1_BysyndKW-loIuuMb9AzWMJZCrWj2cHjovaXJC5D2Do`,
`RAW.COGS`, gid 58221536, header row 2, data from row 3.

- Etsy Order ID: blank, per user decision.
- Supplier Order ID: Fastway `exOrderId`.
- Supplier: FASTWAY.
- Store: optional lookup in RAW.Orders using orderName (terminal -replace stripped
  only for lookup). Missing/ambiguous lookup leaves new Store blank.
- Source date/status: createdAt/status.
- Shipping cost/Tax: shippingFee/taxFee.
- Total cost nguồn: totalFee, fallback orderPrice; round to two decimals.
- Currency/Production/Other/source tracing: absent in new rows; preserve existing
  unsupported values and formulas when updating. Surcharges are not separately
  summed without confirming their relationship to totalFee.

Unique key is FASTWAY + Supplier Order ID. Same rows skip; changed source cells
update; new rows append. Never clears/replaces whole Sheet. Duplicate IDs with
conflicting data or missing ID/date/total block the write. Uses the same PostgreSQL
advisory lock as Equarus, fresh read, and full value verification afterward.

The Fastway card on `/ecombius/bo-import` writes to this destination directly.
It supports month, date range (Vietnam timezone), and all history, with admin
login checked on the server. Historic cogs_records
in PostgreSQL remain; the new sync does not add/update them. The legacy Drive Sync page, API routes, and dedicated helpers have been removed.
Old Drive Sync URLs redirect to BO import. Shared Google OAuth remains intact;
no historical database rows or old Sheet content are deleted.
