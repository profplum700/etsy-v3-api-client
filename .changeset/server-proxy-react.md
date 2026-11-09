---
"@profplum700/etsy-react": minor
---

`EtsyProvider` now accepts any client that has the methods the hooks call (the new `EtsyReactClient` type), not only `EtsyClient`. In a public web app, pass the proxy client from `createEtsyProxyClient()` in `@profplum700/etsy-v3-api-client`, which keeps the shared secret and the user's tokens on your server (#107). `useEtsyClient()` is still typed as `EtsyClient` by default. Use `useEtsyClient<EtsyReactClient>()` for a proxy client. The README's Quick Start now leads with the proxy setup.
