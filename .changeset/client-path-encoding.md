---
"@profplum700/etsy-v3-api-client": patch
---

`EtsyClient` now percent-encodes the IDs and other values it puts into request paths (#117). They used to go in as they were, and the URL parser resolves `..`, so an ID such as `../../../../../listings/123` could reach another endpoint. For example, `deleteListingImage('1', '2', '../../../../../listings/123')` sent `DELETE /listings/123`. Requests with ordinary IDs are unchanged.

A path value of `.`, `..`, `''`, `null` or `undefined` now throws a `TypeError` before anything is sent. URL parsers collapse `.` and `..` even when they are percent-encoded, and the others used to produce paths such as `/shops/undefined`.
