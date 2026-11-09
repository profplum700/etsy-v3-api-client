---
"@profplum700/etsy-v3-api-client": minor
---

Add `rateLimiting.limiter` to `EtsyClient`. Pass an `EtsyRateLimiter` to share it between clients that use the same API key, such as per-request clients on a server, so their requests count against one local quota. The limiter's own configuration applies, and the client's other `rateLimiting` options are ignored. It is ignored when `rateLimiting.enabled` is `false`.
