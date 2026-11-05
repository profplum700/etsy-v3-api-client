---
"@profplum700/etsy-v3-api-client": major
---

A 429 on a write (including uploads and `updateListingProperty`) now throws `EtsyRateLimitError` with `retryAfter`, like reads; it used to throw `EtsyApiError` with status 429. Writes are still never replayed. A 401 from Etsy now triggers one token refresh and one resend when a refresh token is held; a second 401 is thrown as before. Each send attempt now reads the access token after the rate-limit wait, so a retried read never reuses a token that expired while it waited.
