---
"@profplum700/etsy-nextjs": minor
---

`createEtsyApiRoute()` now works; it used to answer `501 Not Implemented`. It is the server side of the proxy that the `@profplum700/etsy-react` hooks use through `createEtsyProxyClient()` (#107).

For each request, it builds the client from that user's token cookies, runs one allowlisted method, and returns the result or the typed Etsy error. It accepts only `POST` from your own origin and never caches responses. The config is now optional, and its old fields are ignored. It needs the `@profplum700/etsy-v3-api-client` release that adds `createEtsyProxyHandler()`.

`getEtsyServerClient()` and `createEtsyServerClient()` now throw `EtsyAuthError` with code `NO_TOKENS` when the token cookie is missing or unreadable. They used to throw a plain `Error`. The message is the same, and `EtsyAuthError` extends `Error`.
