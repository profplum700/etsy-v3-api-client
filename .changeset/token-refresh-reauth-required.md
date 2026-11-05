---
"@profplum700/etsy-v3-api-client": major
---

A refresh that Etsy refuses with `invalid_grant` now throws `EtsyAuthError` with code `REAUTH_REQUIRED`, so callers can tell "the user must authorise again" from a transient failure. `TOKEN_REFRESH_FAILED` now covers only refresh failures that may succeed later.
