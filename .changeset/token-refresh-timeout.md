---
"@profplum700/etsy-v3-api-client": minor
---

A token refresh now has a deadline. `tokenRefreshTimeoutMs` (default 30000) bounds the request to Etsy's token endpoint, including reading its response. On expiry the request is aborted and `EtsyAuthError` is thrown with code `TOKEN_REFRESH_TIMEOUT`; the stored tokens are kept, so callers can retry later. A hung token endpoint no longer hangs every caller waiting on the refresh.
