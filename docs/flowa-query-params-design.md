# Flowa Query Params Design

## Understanding Summary

- Flowa has three data tabs: Orders, Statements, and Items.
- The URL should preserve the main navigation context after refresh.
- Query params will contain only the active tab, shop, and month.
- Search, sorting, pagination, and column visibility remain client-side state.
- The existing in-memory table cache continues to use the full query key.
- This is an internal dashboard; URLs must not contain business data, only filters.

## URL Contract

```text
/flowa?tab=orders&shop=97DECOR&month=2026-08
```

Supported params:

- `tab`: `orders`, `statements`, or `items`
- `shop`: an active Etsy shop code or `all`
- `month`: `YYYY-MM` or `all`

Invalid or missing values fall back to safe defaults. The default tab is
`orders`, the default shop is `all`, and the month uses the current dashboard
selection behavior.

## Behavior

- Read params on initial render and use them to initialize the table state.
- Use `router.replace()` when tab, shop, or month changes.
- Do not add a browser history entry for every filter change.
- Back/Forward navigation restores the three URL-controlled values.
- Sort, page, search, and column visibility are intentionally not persisted in
  the URL to keep it short and readable.

## Non-Functional Requirements

- No additional URL-state dependency is required; use Next.js native
  `useRouter` and `useSearchParams`.
- Query params must not contain row data, credentials, or sensitive payloads.
- Existing in-memory cache remains session-scoped and is independent from URL
  persistence.

## Decision Log

1. **Persist only tab, shop, and month.** This solves the F5 problem without
   making URLs noisy.
2. **Use native Next.js navigation APIs.** The feature is small enough that a
   new dependency such as `nuqs` is unnecessary.
3. **Use `router.replace`.** Filter changes should not pollute browser history.
4. **Keep other table state local.** Sort, pagination, search, and column
   visibility are working-session preferences rather than navigation state.

