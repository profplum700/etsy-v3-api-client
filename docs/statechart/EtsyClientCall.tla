---- MODULE EtsyClientCall ----
\* One API call made through EtsyClient, as the SDK user sees it.
\* Source of truth: src/client.ts (makeRequest, executeWithRetry,
\* sendAuthorized, recoverFromUnauthorized, writeRateLimitError),
\* src/auth/token-manager.ts (getAccessToken, refreshToken, persistence),
\* src/rate-limiting.ts (acquireRequestSlot, handleRateLimitResponse).
\* Etsy's answers are free choices, so every answer is explored.
EXTENDS Naturals

CONSTANT MaxRetries   \* rateLimiting.maxRetries (default 3)

VARIABLES
    phase,       \* where the call is
    kind,        \* "read" (GET) or "write" (POST/PUT/PATCH/DELETE)
    token,       \* the access token the client holds: "fresh" or "expiring"
    hasRefresh,  \* does the client hold a refresh token?
    refreshOk,   \* will Etsy accept the refresh token?
    unsaved,     \* Etsy gave new tokens but saving them failed (pendingTokens)
    why,         \* why the client is refreshing: "expiry" or "401"
    authRetried, \* the call already refreshed after a 401
    retries,     \* 429 retries taken for this call
    sends,       \* times this call reached Etsy
    outcome      \* what the caller gets back

vars == <<phase, kind, token, hasRefresh, refreshOk, unsaved, why, authRetried,
          retries, sends, outcome>>

Outcomes == {"pending", "data", "cached data",
             "EtsyAuthError: refresh failed", "EtsyAuthError: refresh timed out",
             "EtsyAuthError: save failed",
             "EtsyRateLimitError: daily quota", "EtsyRateLimitError: retries used up",
             "EtsyRateLimitError: write not replayed",
             "EtsyApiError 429", "EtsyApiError 401", "EtsyApiError other"}

TypeOK ==
    /\ phase \in {"start", "token", "refreshing", "saving", "slot", "sent", "backoff", "done"}
    /\ kind \in {"read", "write"}
    /\ token \in {"fresh", "expiring"}
    /\ hasRefresh \in BOOLEAN
    /\ refreshOk \in BOOLEAN
    /\ unsaved \in BOOLEAN
    /\ why \in {"expiry", "401"}
    /\ authRetried \in BOOLEAN
    /\ retries \in 0..MaxRetries
    /\ sends \in 0..(MaxRetries + 2)
    /\ outcome \in Outcomes

\* The state before the call: any token age, a refresh token that may be
\* missing or that Etsy may reject, and possibly rotated tokens left unsaved
\* by an earlier call.
Init ==
    /\ phase = "start"
    /\ kind \in {"read", "write"}
    /\ token \in {"fresh", "expiring"}
    /\ hasRefresh \in BOOLEAN
    /\ refreshOk \in BOOLEAN
    /\ ~hasRefresh => ~refreshOk
    /\ unsaved \in BOOLEAN
    /\ unsaved => (token = "expiring" /\ hasRefresh)
    /\ why = "expiry"
    /\ authRetried = FALSE
    /\ retries = 0
    /\ sends = 0
    /\ outcome = "pending"

Fail(o) == phase' = "done" /\ outcome' = o

\* makeRequest: a cached GET returns before the token is read.
CacheHit ==
    /\ phase = "start" /\ kind = "read"
    /\ Fail("cached data")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

CacheMiss ==
    /\ phase = "start"
    /\ phase' = "slot"
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends, outcome>>

\* acquireRequestSlot: waits for pacing and cooldown, but throws when the
\* local rolling 24-hour count is used up.
LocalDailyQuotaUsedUp ==
    /\ phase = "slot"
    /\ Fail("EtsyRateLimitError: daily quota")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

\* Time passes while the call waits for a slot, so a fresh token can start
\* expiring. sendAuthorized reads the token after the wait.
SlotGranted ==
    /\ phase = "slot"
    /\ phase' = "token"
    /\ token' \in {token, "expiring"}
    /\ UNCHANGED <<kind, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends, outcome>>

\* getAccessToken, just before each send: refresh only when the token
\* expires within 60 s.
TokenIsFresh ==
    /\ phase = "token" /\ token = "fresh"
    /\ phase' = "sent" /\ sends' = sends + 1
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, outcome>>

TokenIsExpiring ==
    /\ phase = "token" /\ token = "expiring"
    \* refreshToken(): unsaved tokens are re-saved without a new refresh.
    /\ phase' = IF unsaved THEN "saving" ELSE "refreshing"
    /\ why' = "expiry"
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, authRetried, retries, sends, outcome>>

RefreshSucceeds ==
    /\ phase = "refreshing" /\ refreshOk
    /\ phase' = "saving" /\ unsaved' = TRUE
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, why, authRetried, retries, sends, outcome>>

RefreshFails ==
    /\ phase = "refreshing" /\ ~refreshOk
    /\ Fail("EtsyAuthError: refresh failed")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

\* performTokenRefresh: the token endpoint gives no complete answer within
\* tokenRefreshTimeoutMs (default 30 s), whether or not it would accept the
\* refresh token. The request is aborted and EtsyAuthError
\* TOKEN_REFRESH_TIMEOUT is thrown. Nothing is changed: the stored tokens are
\* kept, and this is never REAUTH_REQUIRED.
RefreshTimesOut ==
    /\ phase = "refreshing"
    /\ Fail("EtsyAuthError: refresh timed out")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

\* persistRefreshedTokens: storage.save and refreshSave must both succeed
\* before the new tokens are used. A refresh at send time sends at once; a
\* refresh after a 401 goes back to wait for a slot.
SaveSucceeds ==
    /\ phase = "saving"
    /\ token' = "fresh" /\ unsaved' = FALSE
    /\ IF why = "401"
         THEN phase' = "slot" /\ UNCHANGED sends
         ELSE phase' = "sent" /\ sends' = sends + 1
    \* Etsy issued a new refresh token; assume it is good.
    /\ hasRefresh' = TRUE /\ refreshOk' = TRUE
    /\ UNCHANGED <<kind, why, authRetried, retries, outcome>>

\* persistRefreshedTokens (saveRotatedTokens) wraps an error thrown by
\* storage.save or refreshSave in EtsyAuthError TOKEN_SAVE_FAILED, with the
\* original as `cause`. The rotated tokens stay pending (unsaved), so the next
\* refresh retries the save without asking Etsy again.
SaveFails ==
    /\ phase = "saving"
    /\ Fail("EtsyAuthError: save failed")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

\* Etsy's answers.
EtsyAnswersOk ==
    /\ phase = "sent"
    /\ Fail("data")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

\* A token can be rejected before its expiry (revoked, clock skew). The
\* first 401 refreshes once and resends once, when a refresh token is held
\* (recoverFromUnauthorized). Any other 401 is thrown as EtsyApiError(401).
EtsyRejectsToken ==
    /\ phase = "sent"
    /\ IF hasRefresh /\ ~authRetried
         THEN /\ phase' = IF unsaved THEN "saving" ELSE "refreshing"
              /\ why' = "401" /\ authRetried' = TRUE
              /\ UNCHANGED outcome
         ELSE Fail("EtsyApiError 401") /\ UNCHANGED <<why, authRetried>>
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, retries, sends>>

\* 5xx, 4xx other than 401/429, or no response: thrown at once, no retry.
EtsyFailsOtherwise ==
    /\ phase = "sent"
    /\ Fail("EtsyApiError other")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

EtsySaysDailyQuotaGone ==
    /\ phase = "sent"
    /\ Fail("EtsyRateLimitError: daily quota")
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends>>

\* 429 with daily quota left. A write is never replayed: it throws
\* EtsyRateLimitError with retryAfter (writeRateLimitError).
EtsySaysSlowDown ==
    /\ phase = "sent"
    /\ IF retries + 1 > MaxRetries
         THEN Fail("EtsyRateLimitError: retries used up") /\ UNCHANGED retries
       ELSE IF kind = "write"
         THEN Fail("EtsyRateLimitError: write not replayed") /\ UNCHANGED retries
       ELSE phase' = "backoff" /\ retries' = retries + 1 /\ UNCHANGED outcome
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, sends>>

BackoffEnds ==
    /\ phase = "backoff"
    /\ phase' = "slot"
    /\ UNCHANGED <<kind, token, hasRefresh, refreshOk, unsaved, why, authRetried, retries, sends, outcome>>

Finished ==
    /\ phase = "done"
    /\ UNCHANGED vars

Next ==
    \/ CacheHit \/ CacheMiss
    \/ LocalDailyQuotaUsedUp \/ SlotGranted
    \/ TokenIsFresh \/ TokenIsExpiring
    \/ RefreshSucceeds \/ RefreshFails \/ RefreshTimesOut
    \/ SaveSucceeds \/ SaveFails
    \/ EtsyAnswersOk \/ EtsyRejectsToken \/ EtsyFailsOtherwise
    \/ EtsySaysDailyQuotaGone \/ EtsySaysSlowDown
    \/ BackoffEnds
    \/ Finished

Spec == Init /\ [][Next]_vars

\* ---- Rules the SDK user can hold the client to ----

\* No request leaves with a token that is about to expire. The token is read
\* after each rate-limit wait, so time spent waiting or backing off is covered.
NoExpiringTokenSent == phase = "sent" => token = "fresh"

\* Rotated tokens are used only after they are saved.
NoUnsavedTokensUsed == phase = "sent" => ~unsaved

\* A write is never replayed after a 429. It is sent again only once, after
\* a 401 (Etsy did not act on it).
WritesNotReplayed == kind = "write" => sends <= IF authRetried THEN 2 ELSE 1

\* Rate-limit retries stop at maxRetries, plus at most one resend after a 401.
RetriesBounded == sends <= MaxRetries + 1 + IF authRetried THEN 1 ELSE 0

\* Every rate-limit failure is an EtsyRateLimitError, as the README's
\* error-handling example assumes.
RateLimitErrorsAreTyped == outcome # "EtsyApiError 429"

\* You only see a 401 when re-authorising is the only fix: the client already
\* refreshed and resent once, or holds no refresh token.
AuthErrorOnlyWhenReauthNeeded == outcome = "EtsyApiError 401" => (authRetried \/ ~hasRefresh)

\* A refresh that times out changes no tokens: Etsy issued none, so none wait
\* to be saved, and the stored tokens are the ones the call started with. A
\* later call can try again; it is not reported as REAUTH_REQUIRED.
RefreshTimeoutKeepsTokens ==
    outcome = "EtsyAuthError: refresh timed out" => ~unsaved

\* When saving rotated tokens fails, the caller gets an EtsyAuthError, and the
\* rotated tokens are kept in memory for the next save attempt.
SaveFailureKeepsRotatedTokens ==
    outcome = "EtsyAuthError: save failed" => unsaved

====
