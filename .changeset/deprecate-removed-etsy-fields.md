---
"@profplum700/etsy-v3-api-client": patch
---

Deprecate `deleteUserAddress()` and `UpdateListingParams.featured_rank`. Etsy has removed both from its Open API v3 specification. They still work as before, and they will be removed in the next major version.
