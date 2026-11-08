---
"@profplum700/etsy-nextjs": minor
---

Security and correctness fixes:

- `getEtsyServerClient()` now builds a new client for each call, from the current request's cookies. Before, it cached the first request's client in a module variable, so on a running server every later request, whoever sent it, used the first user's Etsy tokens.
- The OAuth callback's `success_url` and the logout route's `redirect_url` now accept only paths on your own origin. Anything else redirects to `/`. Before, they could send users to any site (an open redirect).
- `createEtsyApiRoute()` was a stub that returned placeholder JSON with status 200 (and a `public` cache header when caching was on) without calling Etsy. Its handlers now answer `501 Not Implemented`. Write your own Route Handlers that call `getEtsyServerClient()`; a generic proxy is tracked in #107.
- README: config examples include `sharedSecret`; the client-component example calls your Route Handlers instead of building `EtsyClient` in the browser; it documents that a token refresh during a Server Component render can't save the new tokens; the SSG/ISR examples and the `getListingsByShop` usage are corrected.
