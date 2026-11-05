# EtsyClientCall

TLC reached 108 states and 158 steps. The chart draws 16 states and 19 arrows.
The view hides 56 steps, so the chart does not draw them.

## AuthErrorOnlyWhenReauthNeeded breaks
The shortest path has 4 steps:
0. You call a method
1. no cached answer: Checking the access token
2. token has over a minute left: Waiting for a rate-limit slot
3. pacing and cooldown pass: Request sent to Etsy
4. Etsy answers 401: Thrown: EtsyApiError 401

## RateLimitErrorsAreTyped breaks
The shortest path has 4 steps:
0. You call a method
1. no cached answer: Checking the access token
2. token has over a minute left: Waiting for a rate-limit slot
3. pacing and cooldown pass: Request sent to Etsy
4. Etsy answers 429 [a write]: Thrown: EtsyApiError 429

## Rules that hold
TypeOK, NoExpiringTokenSent, NoUnsavedTokensUsed, WritesNotReplayed, RetriesBounded, NoDeadlock
