# Statechart: one EtsyClient API call

This folder holds a small TLA+ model of what an SDK user sees when they call an
`EtsyClient` method. It covers token checks and refresh, saving rotated tokens,
rate-limit pacing, 429 retries, and the error each failure throws. The chart is
drawn from the model by the `statechart` skill in pstack. Its purpose is to let
the owner check that the model matches how the client should behave.

| File | What it is |
|---|---|
| `EtsyClientCall.tla` | The model. Each action cites the code it follows. |
| `EtsyClientCall.cfg` | TLC config: `MaxRetries = 2` and the rules checked. |
| `view.mjs` | Labels for states and arrows, in the caller's words. |
| `chart.mmd` | Generated Mermaid statechart. |
| `chart.svg` | `chart.mmd` rendered with Pele. |
| `report.md` | Generated TLC report: rules that hold, rules that break, and the shortest path to each break. |

## Chart

```mermaid
---
title: "One EtsyClient API call, as the caller sees it"
---
stateDiagram-v2
  state "Legend" as legend {
    lg0: ok
    lg1: error
    lg2: auth
    lg3: limit
    lg4: call
  }
  class lg0 teal
  class lg1 pink
  class lg2 purple
  class lg3 yellow
  class lg4 blue
  s0: You call a method
  s1: Returns cached data
  s2: Waiting for a rate-limit slot
  s3: Thrown: EtsyRateLimitError (daily quota)
  s4: Checking the access token
  s5: Request sent to Etsy
  s6: Refreshing the token
  s7: Saving the new tokens
  s8: Returns data
  s9: Thrown: EtsyApiError 401
  s10: Thrown: EtsyApiError (5xx, 4xx, network)
  s11: Backing off after a 429
  s12: Thrown: EtsyAuthError (refresh failed)
  s13: Thrown: the storage or refreshSave error, unchanged
  s14: Thrown: EtsyRateLimitError (write, with retryAfter)
  s15: Thrown: EtsyRateLimitError (retries used up)
  [*] --> s0
  s0 --> s1: a cached answer exists [reads only]
  s0 --> s2: no cached answer
  s2 --> s3: local 24-hour count is used up
  s2 --> s4: pacing and cooldown pass (the token may age meanwhile)
  s4 --> s5: token has over a minute left
  s4 --> s6: token expiring
  s4 --> s7: token expiring [new tokens from an earlier call wait to be saved]
  s5 --> s8: Etsy answers 2xx
  s5 --> s9: Etsy answers 401 [again, or no refresh token held]
  s5 --> s10: Etsy answers 5xx or 4xx, or the network fails
  s5 --> s3: Etsy answers 429 with no daily quota left
  s5 --> s11: Etsy answers 429 [a read with retries left]
  s6 --> s12: Etsy refuses the refresh, or the network fails
  s5 --> s6: Etsy answers 401 [first time, refresh token held]
  s6 --> s7: Etsy issues new tokens
  s7 --> s5: storage and refreshSave succeed
  s7 --> s13: storage or refreshSave throws
  s5 --> s14: Etsy answers 429 [a write]
  s11 --> s2: the backoff delay passes
  s7 --> s2: storage and refreshSave succeed [after a 401]
  s5 --> s15: Etsy answers 429 [retries used up]
  class s0 blue
  class s1 teal
  class s2 yellow
  class s3 pink
  class s4 purple
  class s5 blue
  class s6 purple
  class s7 purple
  class s8 teal
  class s9 pink
  class s10 pink
  class s11 yellow
  class s12 pink
  class s13 pink
  class s14 pink
  class s15 pink
```

No rule breaks, so no state is marked.

## Rules

All rules hold: `NoExpiringTokenSent`, `NoUnsavedTokensUsed`,
`WritesNotReplayed`, `RetriesBounded`, `RateLimitErrorsAreTyped`,
`AuthErrorOnlyWhenReauthNeeded`, `TypeOK`, `NoDeadlock`.

- **`NoExpiringTokenSent`**: no request leaves with a token about to expire.
  The client reads the token after each rate-limit wait (`sendAuthorized`),
  and the model lets the token age while the call waits, so the wait and the
  429 backoff are covered.
- **`AuthErrorOnlyWhenReauthNeeded`**: "You only see a 401 when re-authorising
  is the only fix." On the first 401, when a refresh token is held, the client
  refreshes once and resends once (`recoverFromUnauthorized`). A second 401,
  or a 401 with no refresh token, is thrown as `EtsyApiError 401`. A failed
  refresh throws its `EtsyAuthError`.
- **`RateLimitErrorsAreTyped`**: "Every rate-limit failure is an
  `EtsyRateLimitError`." A 429 on a write is still not replayed, but it now
  throws `EtsyRateLimitError` with `retryAfter` (`writeRateLimitError`).
- **`WritesNotReplayed`**: a write reaches Etsy once, or twice when the first
  send got a 401 (Etsy did not act on it). It is never replayed after a 429.
- **`RetriesBounded`**: sends stop at `maxRetries + 1`, plus one resend after a
  401.

If saving rotated tokens fails, the caller gets the error that
`storage.save` or `refreshSave` threw, unchanged. It is not wrapped in
`EtsyAuthError`: `persistRefreshedTokens` has no catch, and the request loop
passes token errors through.

## What the model leaves out

- The OAuth authorisation step (`AuthHelper`). The model starts with tokens
  already held.
- Concurrency: many calls sharing one refresh promise, out-of-order rate-limit
  headers, and the guarded single quota probe in `EtsyRateLimiter`.
- The proactive rotation scheduler, `clearTokens`, `updateTokens` and manual
  `refreshToken()`.
- Calls that use `fetchOnceWithRateLimit` (uploads and
  `updateListingProperty`) instead of the retry loop. They follow the same
  token, 401 and write-429 rules as a write, and are covered by unit tests.
- `rateLimiting.enabled = false`. In that mode slots are not reserved, but
  GET 429s are still retried.
- Exact delays, jitter and `Retry-After` arithmetic. Time is reduced to
  "token fresh / token expiring" and "backoff passes".
- Exact elapsed time. Time passing is reduced to "the token may start
  expiring while the call waits for a slot".
- Concurrent calls that hit a 401 together. The client refreshes only if the
  rejected token is still current; otherwise it resends with the new token.
- The model assumes that a refresh token Etsy has just issued works.

## Open questions

- Should a failure to save rotated tokens be wrapped in `EtsyAuthError`, or is
  passing the storage error through unchanged the intended contract?

## Regenerate

1. Enable the **pstack (Claude Code port)** plugin from the
   `henrypitmandigital/agent-skills` org marketplace.
2. From this folder, run the skill's script (it needs Node 22.18+, Bun or Deno):

   ```sh
   <plugin dir>/skills/statechart/scripts/statechart EtsyClientCall.tla \
     --config EtsyClientCall.cfg --view view.mjs --out /tmp/etsy-statechart
   ```

   On its first run the script installs TLC and Java with `mise`. Without
   `mise`, download `tla2tools.jar` from the TLA+ releases and set
   `TLA2TOOLS=/path/to/tla2tools.jar JAVA=/path/to/java` before the command.
3. Copy `chart.mmd` and `report.md` from the `--out` folder back here. To
   rebuild `chart.svg`, follow the skill's `references/render.md` (it uses
   `pele@1.9.0`).

When the client's auth, retry or rate-limit code changes, update the matching
action in `EtsyClientCall.tla` and regenerate.
