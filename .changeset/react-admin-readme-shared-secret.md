---
"@profplum700/etsy-react": patch
"@profplum700/etsy-admin-ui": patch
---

README: the Quick Start built `EtsyClient` with a nonexistent `apiKey` field. It now uses `keystring`, `sharedSecret` and tokens, and saves refreshed tokens. A new warning explains that the hooks and components need the shared secret in the browser, so they suit only trusted environments such as internal tools. A server-proxy mode for public web apps is tracked in #107.
