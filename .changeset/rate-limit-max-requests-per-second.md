---
"@profplum700/etsy-v3-api-client": patch
---

`rateLimiting.maxRequestsPerSecond` now sets the spacing between requests: `ceil(1000 / maxRequestsPerSecond)` ms until Etsy's headers report the app's own per-second limit. Before, the rate limiter ignored it and paced requests only by `minRequestInterval` (default 200 ms), so setting `maxRequestsPerSecond: 1` still sent up to 5 requests a second. When both options are set, the longer interval (the stricter cap) applies. Configs that set only `minRequestInterval`, or neither option, behave as before.
