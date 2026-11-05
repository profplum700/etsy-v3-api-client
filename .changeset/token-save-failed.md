---
"@profplum700/etsy-v3-api-client": major
---

When saving refreshed tokens fails (`TokenStorage.save()`, `refreshSave` or `refreshSaveAsync`), the refresh now throws `EtsyAuthError` with code `TOKEN_SAVE_FAILED` and the original error as `cause`. It used to throw the storage or callback error unchanged. Code that catches the raw storage error should check `error instanceof EtsyAuthError && error.code === 'TOKEN_SAVE_FAILED'` and read `error.cause`. The new tokens are still kept in memory and the next refresh retries the save. `EtsyAuthError` now accepts an optional third `{ cause }` argument.
