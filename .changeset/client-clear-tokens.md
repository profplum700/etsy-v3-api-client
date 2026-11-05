---
"@profplum700/etsy-v3-api-client": minor
---

Add `EtsyClient.clearTokens()`. It clears the tokens (in memory, in token storage and through `refreshClearAsync`) and the response cache, so cached GETs are no longer served after sign-out; calls then throw `EtsyAuthError` `NO_TOKENS`. The cache is cleared even when clearing the tokens throws. The README and authentication guide already documented `client.clearTokens()`, but the client did not have it.
