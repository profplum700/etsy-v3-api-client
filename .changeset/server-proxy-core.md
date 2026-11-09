---
"@profplum700/etsy-v3-api-client": minor
---

Add a server proxy for browser apps, so a public web app can use the client without shipping the shared secret or the user's tokens (#107). `createEtsyProxyClient({ endpoint })` returns an object with the `EtsyClient` methods that the `@profplum700/etsy-react` hooks use. It sends each call to your server. `createEtsyProxyHandler({ getClient })` is the server half: a Fetch API `(Request) => Response` handler that runs the call with an `EtsyClient` built for that request's user.

The handler:
- runs only the methods in `ETSY_PROXY_METHODS`, or a shorter list you pass;
- accepts only `POST` from the request's own origin or `allowedOrigins`;
- never caches responses;
- sends image uploads as multipart.

`EtsyApiError`, `EtsyAuthError` and `EtsyRateLimitError` keep their class, `code`, `statusCode` and `retryAfter` across the hop. Other errors become a generic 500 and are passed to `onError`.
