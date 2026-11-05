# EtsyClientCall

TLC reached 296 states and 444 steps. The chart draws 16 states and 21 arrows.
The view hides no steps.

## Rules that hold
TypeOK, NoExpiringTokenSent, NoUnsavedTokensUsed, WritesNotReplayed, RetriesBounded, RateLimitErrorsAreTyped, AuthErrorOnlyWhenReauthNeeded, NoDeadlock

## Paths checked to be reachable
Each was checked by giving TLC its negation as an invariant and seeing it break:
- a call ends with `EtsyApiError 401` (second 401, or no refresh token held);
- a call returns data after refreshing on a 401;
- a write ends with `EtsyRateLimitError` after a 429;
- a write reaches Etsy twice (resent once after a 401).
