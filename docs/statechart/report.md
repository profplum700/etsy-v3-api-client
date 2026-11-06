# EtsyClientCall

TLC reached 320 states and 492 steps. The chart draws 17 states and 22 arrows.
The view hides 168 steps, so the chart does not draw them.

## Rules that hold
TypeOK, NoExpiringTokenSent, NoUnsavedTokensUsed, WritesNotReplayed, RetriesBounded, RateLimitErrorsAreTyped, AuthErrorOnlyWhenReauthNeeded, RefreshTimeoutKeepsTokens, SaveFailureKeepsRotatedTokens, NoDeadlock

## Paths checked to be reachable
Each was checked by giving TLC its negation as an invariant and seeing it break:
- a call ends with `EtsyApiError 401` (second 401, or no refresh token held);
- a call returns data after refreshing on a 401;
- a write ends with `EtsyRateLimitError` after a 429;
- a write reaches Etsy twice (resent once after a 401);
- a call ends with `EtsyAuthError TOKEN_REFRESH_TIMEOUT`;
- a call ends with `EtsyAuthError TOKEN_SAVE_FAILED`.
