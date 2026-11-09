---
"@profplum700/etsy-nextjs": minor
---

Add `createEtsyMiddleware()`, exported from `@profplum700/etsy-nextjs/middleware`. It refreshes the user's Etsy tokens when they are close to expiry (within 5 minutes by default), before Server Components render. It sends the new tokens to the browser and passes them on to the rest of the request. Before this, the client refreshed during a Server Component render, where the new tokens could not be saved, so Etsy's single-use refresh token was spent and the user had to authorise again (#111). Concurrent requests share one refresh. If Etsy refuses the refresh, the request passes through unchanged. The OAuth refresh route and the middleware now share their token request and cookie-writing code.
