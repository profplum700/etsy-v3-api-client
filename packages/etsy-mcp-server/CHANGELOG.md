# @profplum700/etsy-mcp-server

## 1.0.0

### Major Changes

- a147325: Add the local, read-only Etsy MCP server and publish the CLI with a semver dependency on the current Etsy client.

### Patch Changes

- a147325: Retry persistence of Etsy-rotated tokens without repeating OAuth refresh, fence refresh persistence against concurrent token updates or clears, preserve legacy synchronous `refreshSave` clearing behavior while requiring a paired clear callback for new async persistence, preserve quota-probe response identity for safe exhausted-quota recovery (custom transports must migrate from uncorrelated `updateFromHeaders` calls to the reservation-aware API), keep active-listing pagination metadata within its accepted offset limit, accept listing IDs returned by the list tool, page large inventory results, validate local OAuth callback addresses, verify same-listing price targets from one final inventory snapshot, and include required `property_values` in non-variation inventory examples.
- Updated dependencies [a147325]
- Updated dependencies [a147325]
- Updated dependencies [a147325]
  - @profplum700/etsy-v3-api-client@4.0.0
