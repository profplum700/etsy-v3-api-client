---- MODULE EtsyClientCall ----
\* One API call made through EtsyClient, as the SDK user sees it.
\* Source of truth: src/client.ts (makeRequest, executeWithRetry),
\* src/auth/token-manager.ts (getAccessToken, refreshToken, persistence),
\* src/rate-limiting.ts (acquireRequestSlot, handleRateLimitResponse).
\* Etsy's answers are free choices, so every answer is explored.
EXTENDS Naturals

CONSTANT MaxRetries   \* rateLimiting.maxRetries (default 3)

VARIABLES
    phase,      \* where the call is
    kind,       \* "read" (GET) or "write" (POST/PUT/PATCH/DELETE)
    token,      \* the access token the client holds: "fresh" or "expiring"
    refreshOk,  \* will Etsy accept the refresh token?
    unsaved,    \* Etsy gave new tokens but saving them failed (pendingTokens)
    retries,    \* 429 retries taken for this call
    sends,      \* times this call reached Etsy
    outcome     \* what the caller gets back

vars == <<phase, kind, token, refreshOk, unsaved, retries, sends, outcome>>

Outcomes == {"pending", "data", "cached data",
             "EtsyAuthError: refresh failed", "EtsyAuthError: save failed",
             "EtsyRateLimitError: daily quota", "EtsyRateLimitError: retries used up",
             "EtsyApiError 429", "EtsyApiError 401", "EtsyApiError other"}

TypeOK ==
    /\ phase \in {"start", "token", "refreshing", "saving", "slot", "sent", "backoff", "done"}
    /\ kind \in {"read", "write"}
    /\ token \in {"fresh", "expiring"}
    /\ refreshOk \in BOOLEAN
    /\ unsaved \in BOOLEAN
    /\ retries \in 0..MaxRetries
    /\ sends \in 0..(MaxRetries + 1)
    /\ outcome \in Outcomes

\* The state before the call: any token age, a refresh token Etsy may reject,
\* and possibly rotated tokens left unsaved by an earlier call.
Init ==
    /\ phase = "start"
    /\ kind \in {"read", "write"}
    /\ token \in {"fresh", "expiring"}
    /\ refreshOk \in BOOLEAN
    /\ unsaved \in BOOLEAN
    /\ unsaved => token = "expiring"
    /\ retries = 0
    /\ sends = 0
    /\ outcome = "pending"

Fail(o) == phase' = "done" /\ outcome' = o

\* makeRequest: a cached GET returns before the token is checked.
CacheHit ==
    /\ phase = "start" /\ kind = "read"
    /\ Fail("cached data")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

CacheMiss ==
    /\ phase = "start"
    /\ phase' = "token"
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends, outcome>>

\* getAccessToken: refresh only when the token expires within 60 s.
TokenIsFresh ==
    /\ phase = "token" /\ token = "fresh"
    /\ phase' = "slot"
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends, outcome>>

TokenIsExpiring ==
    /\ phase = "token" /\ token = "expiring"
    \* refreshToken(): unsaved tokens are re-saved without a new refresh.
    /\ phase' = IF unsaved THEN "saving" ELSE "refreshing"
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends, outcome>>

RefreshSucceeds ==
    /\ phase = "refreshing" /\ refreshOk
    /\ phase' = "saving" /\ unsaved' = TRUE
    /\ UNCHANGED <<kind, token, refreshOk, retries, sends, outcome>>

RefreshFails ==
    /\ phase = "refreshing" /\ ~refreshOk
    /\ Fail("EtsyAuthError: refresh failed")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

\* persistRefreshedTokens: storage.save and refreshSave must both succeed
\* before the new tokens are used.
SaveSucceeds ==
    /\ phase = "saving"
    /\ phase' = "slot" /\ token' = "fresh" /\ unsaved' = FALSE
    \* Etsy issued a new refresh token; assume it is good.
    /\ refreshOk' = TRUE
    /\ UNCHANGED <<kind, retries, sends, outcome>>

SaveFails ==
    /\ phase = "saving"
    /\ Fail("EtsyAuthError: save failed")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

\* acquireRequestSlot: waits for pacing and cooldown, but throws when the
\* local rolling 24-hour count is used up.
LocalDailyQuotaUsedUp ==
    /\ phase = "slot"
    /\ Fail("EtsyRateLimitError: daily quota")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

SlotGranted ==
    /\ phase = "slot"
    /\ phase' = "sent" /\ sends' = sends + 1
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, outcome>>

\* Etsy's answers.
EtsyAnswersOk ==
    /\ phase = "sent"
    /\ Fail("data")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

\* A token can be rejected before its expiry (revoked, clock skew).
\* executeWithRetry throws EtsyApiError(401); nothing refreshes.
EtsyRejectsToken ==
    /\ phase = "sent"
    /\ Fail("EtsyApiError 401")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

\* 5xx, 4xx other than 401/429, or no response: thrown at once, no retry.
EtsyFailsOtherwise ==
    /\ phase = "sent"
    /\ Fail("EtsyApiError other")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

EtsySaysDailyQuotaGone ==
    /\ phase = "sent"
    /\ Fail("EtsyRateLimitError: daily quota")
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends>>

\* 429 with daily quota left.
EtsySaysSlowDown ==
    /\ phase = "sent"
    /\ IF retries + 1 > MaxRetries
         THEN Fail("EtsyRateLimitError: retries used up") /\ UNCHANGED retries
       ELSE IF kind = "write"
         THEN Fail("EtsyApiError 429") /\ UNCHANGED retries
       ELSE phase' = "backoff" /\ retries' = retries + 1 /\ UNCHANGED outcome
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, sends>>

BackoffEnds ==
    /\ phase = "backoff"
    /\ phase' = "slot"
    /\ UNCHANGED <<kind, token, refreshOk, unsaved, retries, sends, outcome>>

Finished ==
    /\ phase = "done"
    /\ UNCHANGED vars

Next ==
    \/ CacheHit \/ CacheMiss
    \/ TokenIsFresh \/ TokenIsExpiring
    \/ RefreshSucceeds \/ RefreshFails
    \/ SaveSucceeds \/ SaveFails
    \/ LocalDailyQuotaUsedUp \/ SlotGranted
    \/ EtsyAnswersOk \/ EtsyRejectsToken \/ EtsyFailsOtherwise
    \/ EtsySaysDailyQuotaGone \/ EtsySaysSlowDown
    \/ BackoffEnds
    \/ Finished

Spec == Init /\ [][Next]_vars

\* ---- Rules the SDK user can hold the client to ----

\* The client never sends a token it knows is about to expire.
NoExpiringTokenSent == phase = "sent" => token = "fresh"

\* Rotated tokens are used only after they are saved.
NoUnsavedTokensUsed == phase = "sent" => ~unsaved

\* A write reaches Etsy at most once per call (no blind replay).
WritesNotReplayed == kind = "write" => sends <= 1

\* Rate-limit retries stop at maxRetries.
RetriesBounded == sends <= MaxRetries + 1

\* Every rate-limit failure is an EtsyRateLimitError, as the README's
\* error-handling example assumes.
RateLimitErrorsAreTyped == outcome # "EtsyApiError 429"

\* You only see a 401 when re-authorising is the only fix: a rejected access
\* token is refreshed once and the call retried while the refresh token works.
AuthErrorOnlyWhenReauthNeeded == outcome = "EtsyApiError 401" => ~refreshOk

====
