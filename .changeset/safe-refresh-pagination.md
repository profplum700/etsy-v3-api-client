---
'@profplum700/etsy-v3-api-client': patch
'@profplum700/etsy-mcp-server': patch
---

Retry persistence of Etsy-rotated tokens without repeating OAuth refresh, fence refresh persistence against concurrent token updates or clears, preserve quota-probe response identity for safe exhausted-quota recovery (custom transports must migrate from uncorrelated `updateFromHeaders` calls to the reservation-aware API), and keep active-listing pagination metadata within its accepted offset limit.
