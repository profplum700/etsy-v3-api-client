---
"@profplum700/etsy-v3-api-client": minor
---

`EtsyClient` now takes an optional `TokenStorage` as its second constructor argument: `new EtsyClient(config, storage)`. Every token set the client refreshes is saved to that storage before the new access token is used, alongside any `refreshSave` / `refreshSaveAsync` callback (storage is written first). Previously the README and guides showed this call, but the constructor accepted only `config`, so JavaScript callers' storage was silently ignored and TypeScript callers got a compile error. The client still starts from the tokens in `config`; the docs now show loading them from storage when resuming a session.
