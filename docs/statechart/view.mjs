// Reader's words for the EtsyClientCall chart. Pure functions of their arguments.
export const title = "One EtsyClient API call, as the caller sees it";

const failed = {
  "EtsyAuthError: refresh failed": "Thrown: EtsyAuthError (refresh failed)",
  "EtsyAuthError: refresh timed out": "Thrown: EtsyAuthError TOKEN_REFRESH_TIMEOUT (tokens kept)",
  "EtsyAuthError: save failed": "Thrown: EtsyAuthError TOKEN_SAVE_FAILED (cause: the storage error)",
  "EtsyRateLimitError: daily quota": "Thrown: EtsyRateLimitError (daily quota)",
  "EtsyRateLimitError: retries used up": "Thrown: EtsyRateLimitError (retries used up)",
  "EtsyRateLimitError: write not replayed": "Thrown: EtsyRateLimitError (write, with retryAfter)",
  "EtsyApiError 429": "Thrown: EtsyApiError 429",
  "EtsyApiError 401": "Thrown: EtsyApiError 401",
  "EtsyApiError other": "Thrown: EtsyApiError (5xx, 4xx, network)",
};

export const state = (v) => {
  switch (v.phase) {
    case "start": return "You call a method";
    case "token": return "Checking the access token";
    case "refreshing": return "Refreshing the token";
    case "saving": return "Saving the new tokens";
    case "slot": return "Waiting for a rate-limit slot";
    case "sent": return "Request sent to Etsy";
    case "backoff": return "Backing off after a 429";
    default:
      if (v.outcome === "data") return "Returns data";
      if (v.outcome === "cached data") return "Returns cached data";
      return failed[v.outcome];
  }
};

export const group = (v) => {
  if (v.phase === "done") return v.outcome.includes("data") ? "ok" : "error";
  if (["refreshing", "saving", "token"].includes(v.phase)) return "auth";
  if (["slot", "backoff"].includes(v.phase)) return "limit";
  return "call";
};

export const colors = { ok: "teal", error: "pink", auth: "purple", limit: "yellow", call: "blue" };

export const step = (action, from, to) => {
  switch (action) {
    case "CacheHit": return "a cached answer exists [reads only]";
    case "CacheMiss": return "no cached answer";
    case "TokenIsFresh": return "token has over a minute left";
    case "TokenIsExpiring": return to.phase === "saving"
      ? "token expiring [new tokens from an earlier call wait to be saved]"
      : "token expiring";
    case "RefreshSucceeds": return "Etsy issues new tokens";
    case "RefreshFails": return "Etsy refuses the refresh, or the network fails";
    case "SaveSucceeds": return to.phase === "slot"
      ? "storage and refreshSave succeed [after a 401]"
      : "storage and refreshSave succeed";
    case "RefreshTimesOut": return "the token endpoint does not answer in time";
    case "SaveFails": return "storage or refreshSave throws";
    case "LocalDailyQuotaUsedUp": return "local 24-hour count is used up";
    case "SlotGranted": return "pacing and cooldown pass (the token may age meanwhile)";
    case "EtsyAnswersOk": return "Etsy answers 2xx";
    case "EtsyRejectsToken": return to.phase === "done"
      ? "Etsy answers 401 [again, or no refresh token held]"
      : "Etsy answers 401 [first time, refresh token held]";
    case "EtsyFailsOtherwise": return "Etsy answers 5xx or 4xx, or the network fails";
    case "EtsySaysDailyQuotaGone": return "Etsy answers 429 with no daily quota left";
    case "EtsySaysSlowDown":
      if (to.phase === "backoff") return "Etsy answers 429 [a read with retries left]";
      if (to.outcome === "EtsyRateLimitError: write not replayed") return "Etsy answers 429 [a write]";
      return "Etsy answers 429 [retries used up]";
    case "BackoffEnds": return "the backoff delay passes";
    case "Finished": return null;
  }
  return action;
};
