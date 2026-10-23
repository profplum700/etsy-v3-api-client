# @profplum700/etsy-mcp-server

## 1.0.1

### Patch Changes

- 15f1dcf: Update @modelcontextprotocol/server from 2.1.0 to 2.3.0. The server already builds a new McpServer per connection through serveStdio, so the one-connection-per-server rule in 2.3.0 does not affect it. Tool registration and the stdio transport are unchanged.
- f94bf66: Update the `open` runtime dependency to ^11.0.4.
- Updated dependencies [f285f3f]
  - @profplum700/etsy-v3-api-client@4.1.0

## 1.0.0

### Major Changes

- a147325: Add the local, read-only Etsy MCP server and publish the CLI with a semver dependency on the current Etsy client.

### Patch Changes

- a147325: Retry persistence of Etsy-rotated tokens without repeating OAuth refresh, fence refresh persistence against concurrent token updates or clears, preserve legacy synchronous `refreshSave` clearing behavior while requiring a paired clear callback for new async persistence, preserve quota-probe response identity for safe exhausted-quota recovery (custom transports must migrate from uncorrelated `updateFromHeaders` calls to the reservation-aware API), keep active-listing pagination metadata within its accepted offset limit, accept listing IDs returned by the list tool, page large inventory results, validate local OAuth callback addresses, verify same-listing price targets from one final inventory snapshot, and include required `property_values` in non-variation inventory examples.
- Updated dependencies [a147325]
- Updated dependencies [a147325]
- Updated dependencies [a147325]
  - @profplum700/etsy-v3-api-client@4.0.0
