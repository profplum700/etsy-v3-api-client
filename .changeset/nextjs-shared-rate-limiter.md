---
"@profplum700/etsy-nextjs": patch
---

`getEtsyServerClient()` and `createEtsyServerClient()` now share one rate limiter per API key within the server process. Clients are still built per request, but the local per-second and per-day throttle counts across requests again. The shared limiter needs `@profplum700/etsy-v3-api-client` with `rateLimiting.limiter`; with an older version each client keeps its own limiter, as before.
