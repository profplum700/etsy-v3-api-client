---
'@profplum700/etsy-v3-api-client': patch
'@profplum700/etsy-mcp-server': patch
---

Retry persistence of Etsy-rotated tokens without repeating OAuth refresh, fence refresh persistence against concurrent token updates or clears, preserve legacy synchronous `refreshSave` clearing behavior while requiring a paired clear callback for new async persistence, preserve quota-probe response identity for safe exhausted-quota recovery (custom transports must migrate from uncorrelated `updateFromHeaders` calls to the reservation-aware API), keep active-listing pagination metadata within its accepted offset limit, accept listing IDs returned by the list tool, page large inventory results, validate local OAuth callback addresses, and reverify every approved price target after a batch.
