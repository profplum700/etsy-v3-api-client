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
    lg5: Breaks RateLimitErrorsAreTyped
    lg6: Breaks AuthErrorOnlyWhenReauthNeeded in some cases
    lg7: Path to the AuthErrorOnlyWhenReauthNeeded or RateLimitErrorsAreTyped bug
  }
  class lg0 teal
  class lg1 pink
  class lg2 purple
  class lg3 yellow
  class lg4 blue
  class lg5 breaks
  class lg6 mayBreak
  class lg7 bugPath
  s0: You call a method
  s1: Returns cached data
  s2: Checking the access token
  s3: Refreshing the token
  s4: Saving the new tokens
  s5: Waiting for a rate-limit slot
  s6: Thrown: EtsyAuthError (refresh failed)
  s7: Thrown: EtsyRateLimitError (daily quota)
  s8: Thrown: EtsyAuthError (new tokens not saved)
  s9: Request sent to Etsy
  s10: Backing off after a 429
  s11: Thrown: EtsyApiError 401
  s12: Thrown: EtsyApiError 429
  s13: Thrown: EtsyApiError (5xx, 4xx, network)
  s14: Returns data
  s15: Thrown: EtsyRateLimitError (retries used up)
  [*] --> s0
  s0 --> s1: a cached answer exists [reads only]
  s0 --> s2: no cached answer
  s2 --> s3: token expiring
  s2 --> s5: token has over a minute left
  s2 --> s4: token expiring [new tokens from an earlier call wait to be saved]
  s3 --> s6: Etsy refuses the refresh, or the network fails
  s3 --> s4: Etsy issues new tokens
  s4 --> s5: storage and refreshSave succeed
  s4 --> s8: storage or refreshSave throws
  s5 --> s7: local 24-hour count is used up
  s5 --> s9: pacing and cooldown pass
  s9 --> s10: Etsy answers 429 [a read with retries left]
  s9 --> s11: Etsy answers 401
  s9 --> s13: Etsy answers 5xx or 4xx, or the network fails
  s9 --> s7: Etsy answers 429 with no daily quota left
  s9 --> s14: Etsy answers 2xx
  s9 --> s12: Etsy answers 429 [a write]
  s10 --> s5: the backoff delay passes
  s9 --> s15: Etsy answers 429 [retries used up]
  classDef breaks fill:#ffecee,stroke:#e72e3b,stroke-width:2.5px,color:#cd2834
  classDef mayBreak fill:#fff3e6,stroke:#e8730c,stroke-width:2.5px,color:#b85a06
  class s0 blue
  class s0 bugPath
  class s1 teal
  class s2 purple
  class s2 bugPath
  class s3 purple
  class s4 purple
  class s5 yellow
  class s5 bugPath
  class s6 pink
  class s7 pink
  class s8 pink
  class s9 blue
  class s9 bugPath
  class s10 yellow
  class s11 pink
  class s11 mayBreak
  class s11 bugPath
  class s12 pink
  class s12 breaks
  class s12 bugPath
  class s13 pink
  class s14 teal
  class s15 pink
```

A red box breaks a rule in every case. An orange box breaks it only in some
cases. A blue border marks a state on the shortest path to a break.

## Rules

Rules that hold: `NoExpiringTokenSent`, `NoUnsavedTokensUsed`,
`WritesNotReplayed`, `RetriesBounded`, `TypeOK`, `NoDeadlock`.

Two proposed rules break. Each break was replayed against `src/client.ts`
with a throwaway Vitest test that stubs `fetch`, and each one reproduces.

- **`AuthErrorOnlyWhenReauthNeeded`**: "You only see a 401 when re-authorising
  is the only fix." Path: you call a method → no cached answer → token has
  over a minute left → pacing passes → Etsy answers 401 → `EtsyApiError 401`.
  The client refreshes only on its own clock (`getAccessToken`, 60 s buffer).
  A 401 from Etsy is thrown as is, without a refresh or a retry
  (`executeWithRetry` in `src/client.ts`).
- **`RateLimitErrorsAreTyped`**: "Every rate-limit failure is an
  `EtsyRateLimitError`." Path: … → Etsy answers 429 [a write] →
  `EtsyApiError 429`. On purpose, writes are not replayed after a 429. They are
  thrown as `EtsyApiError` with no `retryAfter`, so `getRetryAfter()` returns
  `null`.

These two rules are proposals for the owner to accept or reject. If the
current behaviour is what you want, delete the rule from the `.cfg` file, and
fix the docs listed in the PR.

## What the model leaves out

- The OAuth authorisation step (`AuthHelper`). The model starts with tokens
  already held.
- Concurrency: many calls sharing one refresh promise, out-of-order rate-limit
  headers, and the guarded single quota probe in `EtsyRateLimiter`.
- The proactive rotation scheduler, `clearTokens`, `updateTokens` and manual
  `refreshToken()`.
- Calls that use `fetchOnceWithRateLimit` (some upload and inventory methods)
  instead of the retry loop.
- `rateLimiting.enabled = false`. In that mode slots are not reserved, but
  GET 429s are still retried.
- Exact delays, jitter and `Retry-After` arithmetic. Time is reduced to
  "token fresh / token expiring" and "backoff passes".
- The model assumes that a refresh token Etsy has just issued works.

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
