/**
 * Rate limiting implementation for Etsy API v3
 * Conservative fallback limits: 5,000 requests per rolling 24 hours and
 * 5 requests per second. Etsy assigns QPD/QPS quotas per API key; response
 * headers provide the authoritative values for the connected application.
 *
 * This implementation supports:
 * - Header-based rate limiting using Etsy's response headers
 * - Automatic retry on 429 errors with exponential backoff
 * - Callback notification when approaching daily limit
 * - Fallback to configured values when headers are unavailable
 *
 * The local QPD fallback tracks this process's requests over a rolling 24h
 * window. It cannot see calls made by other processes, other serverless
 * instances, or other applications using the same API key, so Etsy's response
 * headers remain authoritative.
 */

import {
  RateLimitConfig,
  RateLimitStatus,
  EtsyRateLimitError,
  EtsyRateLimitHeaders,
  ApproachingLimitCallback
} from './types';

/**
 * Etsy's official API rate limits.
 * Conservative fallbacks shared by EtsyRateLimiter and GlobalRequestQueue.
 * The Etsy Developer Portal and response headers define each app's actual quota.
 */
export const ETSY_RATE_LIMITS = {
  MAX_REQUESTS_PER_DAY: 5000,
  MAX_REQUESTS_PER_SECOND: 5,
  /** 1000ms / 5 fallback QPS */
  MIN_REQUEST_INTERVAL: 200,
} as const;

const QPD_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Required configuration fields with defaults applied
 */
interface RequiredRateLimitConfig {
  maxRequestsPerDay: number;
  maxRequestsPerSecond: number;
  minRequestInterval: number;
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  jitter: number;
  qpdWarningThreshold: number;
  onApproachingLimit?: ApproachingLimitCallback;
}

export class EtsyRateLimiter {
  // Local rolling-window fallback; the server's headers are authoritative.
  private requestTimestamps: number[] = [];
  private uncertainRequestTimestamps: number[] = [];
  private lastRequestTime = 0;
  private readonly config: RequiredRateLimitConfig;

  // Header-based state
  private headerLimitPerSecond?: number;
  private headerRemainingThisSecond?: number;
  private headerLimitPerDay?: number;
  private headerRemainingToday?: number;
  private isHeaderBasedLimiting = false;
  private headerQuotaAvailableAt = 0;
  private retryNotBefore = 0;
  private quotaProbeBackoffMs = 60_000;
  private nextReservationId = 0;
  private latestHeaderReservationId = 0;
  private inFlightReservations = new Map<number, { isQuotaProbe: boolean; startedAt: number }>();
  private quotaProbeInFlight = false;
  private readonly stateWaiters = new Set<() => void>();

  // Retry state
  private currentRetryCount = 0;

  // Serialize request reservations so concurrent callers cannot all pass the
  // same last-request timestamp and burst past the configured QPS interval.
  private reservationQueue: Promise<void> = Promise.resolve();

  constructor(config?: Partial<RateLimitConfig>) {
    const overrides = Object.fromEntries(
      Object.entries(config ?? {}).filter(([, value]) => value !== undefined)
    ) as Partial<RateLimitConfig>;
    this.config = {
      // Etsy API defaults (see ETSY_RATE_LIMITS)
      maxRequestsPerDay: ETSY_RATE_LIMITS.MAX_REQUESTS_PER_DAY,
      maxRequestsPerSecond: ETSY_RATE_LIMITS.MAX_REQUESTS_PER_SECOND,
      minRequestInterval: ETSY_RATE_LIMITS.MIN_REQUEST_INTERVAL,
      // Retry/backoff defaults
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitter: 0.1,
      qpdWarningThreshold: 80,
      onApproachingLimit: undefined,
      ...overrides
    };
  }

  private pruneRequestTimestamps(now: number): void {
    const oldestAllowed = now - QPD_WINDOW_MS;
    while (this.requestTimestamps[0] !== undefined && this.requestTimestamps[0] <= oldestAllowed) {
      this.requestTimestamps.shift();
    }
    while (this.uncertainRequestTimestamps[0] !== undefined && this.uncertainRequestTimestamps[0] <= oldestAllowed) {
      this.uncertainRequestTimestamps.shift();
    }
  }

  private getLocalResetTime(now: number): Date {
    this.pruneRequestTimestamps(now);
    const oldestRequest = this.requestTimestamps[0] ?? now;
    return new Date(oldestRequest + QPD_WINDOW_MS);
  }

  private getLocalRemainingRequests(now: number): number {
    this.pruneRequestTimestamps(now);
    const localLimit = this.headerLimitPerDay ?? this.config.maxRequestsPerDay;
    return Math.max(0, localLimit - this.requestTimestamps.length);
  }

  private getEffectiveRemainingRequests(now: number): number {
    this.pruneRequestTimestamps(now);
    if (this.headerRemainingToday !== undefined) {
      return Math.max(0, this.headerRemainingToday - this.inFlightReservations.size - this.uncertainRequestTimestamps.length);
    }
    return this.getLocalRemainingRequests(now);
  }

  private isQuotaProbeReady(now: number): boolean {
    const exhausted = this.headerRemainingToday === 0;
    const uncertainBudgetExhausted = this.inFlightReservations.size === 0 &&
      this.uncertainRequestTimestamps.length > 0 &&
      this.getEffectiveRemainingRequests(now) === 0;
    return (exhausted || uncertainBudgetExhausted) &&
      !this.quotaProbeInFlight &&
      this.inFlightReservations.size === 0 &&
      this.headerQuotaAvailableAt <= now;
  }

  private refreshExpiredHeaderQuota(now: number): void {
    if (this.headerRemainingToday === 0 && this.headerQuotaAvailableAt > 0 && now >= this.headerQuotaAvailableAt) {
      // Keep Etsy's exhausted state until a single recovery probe gets a fresh
      // response. Falling back to the process-local count here can overrun a
      // quota shared with other processes using the same app key.
      this.headerQuotaAvailableAt = 0;
    }
  }

  private notifyStateWaiters(): void {
    for (const resolve of this.stateWaiters) resolve();
    this.stateWaiters.clear();
  }

  private scheduleQuotaProbe(): void {
    this.headerQuotaAvailableAt = Date.now() + this.quotaProbeBackoffMs;
    this.quotaProbeBackoffMs = Math.min(this.quotaProbeBackoffMs * 2, 60 * 60 * 1000);
  }

  private waitForStateChange(): Promise<void> {
    return new Promise((resolve) => this.stateWaiters.add(resolve));
  }

  private finishReservation(reservationId: number, receivedQuotaHeader: boolean): void {
    const wasQuotaProbe = this.inFlightReservations.get(reservationId);
    if (wasQuotaProbe === undefined) return;
    this.inFlightReservations.delete(reservationId);
    if (wasQuotaProbe.isQuotaProbe) {
      this.quotaProbeInFlight = false;
      if (this.headerRemainingToday === 0 && !receivedQuotaHeader) {
        this.scheduleQuotaProbe();
      }
    }
    this.notifyStateWaiters();
  }

  /** Reserve one outbound request immediately before dispatch. */
  public async acquireRequestSlot(): Promise<number> {
    const previousReservation = this.reservationQueue;
    let releaseReservation: () => void = () => undefined;
    this.reservationQueue = new Promise<void>((resolve) => {
      releaseReservation = resolve;
    });

    await previousReservation;
    try {
      while (true) {
        const now = Date.now();
        this.pruneRequestTimestamps(now);
        this.refreshExpiredHeaderQuota(now);

        let isQuotaProbe = false;
        if (this.headerRemainingToday === 0 || this.isQuotaProbeReady(now)) {
          if (this.quotaProbeInFlight || this.inFlightReservations.size > 0) {
            await this.waitForStateChange();
            continue;
          }
          const probeWait = this.headerQuotaAvailableAt - now;
          if (probeWait > 0) {
            await new Promise(resolve => setTimeout(resolve, probeWait));
            continue;
          }
          isQuotaProbe = true;
        } else {
          const effectiveRemaining = this.getEffectiveRemainingRequests(now);
          if (effectiveRemaining <= 0) {
            // Other local requests have reserved all currently known quota.
            // Recheck when one completes rather than rejecting prematurely.
            if (this.inFlightReservations.size > 0 && this.headerRemainingToday !== undefined) {
              await this.waitForStateChange();
              continue;
            }
            const effectiveDailyLimit = this.headerLimitPerDay ?? this.config.maxRequestsPerDay;
            const localResetTime = this.getLocalResetTime(now);
            const timeUntilReset = Math.max(0, localResetTime.getTime() - now);
            throw new EtsyRateLimitError(
              `Daily rate limit exhausted (${effectiveDailyLimit} requests in the local rolling 24-hour window). ` +
                `The oldest local request expires in approximately ${Math.ceil(timeUntilReset / 1000 / 60)} minutes.`,
              Math.ceil(timeUntilReset / 1000),
              'qpd_exhausted'
            );
          }
        }

        const intervalWait = Math.max(
          0,
          this.getEffectiveMinInterval() - (now - this.lastRequestTime)
        );
        const cooldownWait = Math.max(0, this.retryNotBefore - now);
        const waitTime = Math.max(intervalWait, cooldownWait);
        if (waitTime > 0) {
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        const requestStartedAt = Date.now();
        const reservationId = ++this.nextReservationId;
        this.requestTimestamps.push(requestStartedAt);
        this.lastRequestTime = requestStartedAt;
        this.inFlightReservations.set(reservationId, { isQuotaProbe, startedAt: requestStartedAt });
        if (isQuotaProbe) this.quotaProbeInFlight = true;
        return reservationId;
      }
    } finally {
      releaseReservation();
    }
  }

  /** Release a reservation when transport fails before a response is received. */
  public releaseRequestSlot(reservationId: number): void {
    const reservation = this.inFlightReservations.get(reservationId);
    if (!reservation) return;
    // A lost response does not prove Etsy never received or charged the request.
    // Keep the charge until its rolling-window expiry or a guarded quota probe.
    this.uncertainRequestTimestamps.push(reservation.startedAt);
    this.finishReservation(reservationId, false);
  }

  /**
   * Update rate limit state from API response headers.
   * Call this after each response, passing the reservation used for the request.
   *
   * @param headers - Response headers (Headers object or plain object)
   */
  public updateFromHeaders(
    headers: Headers | Record<string, string> | undefined | null,
    reservationId?: number
  ): void {
    const matchedReservationId = reservationId;
    const isQuotaProbe = matchedReservationId !== undefined &&
      this.inFlightReservations.get(matchedReservationId)?.isQuotaProbe === true;
    if (!headers) {
      if (matchedReservationId !== undefined) this.finishReservation(matchedReservationId, false);
      return; // No headers to parse
    }
    const parsed = this.parseRateLimitHeaders(headers);
    if (matchedReservationId !== undefined) {
      this.finishReservation(matchedReservationId, parsed.remainingToday !== undefined);
    }

    if (parsed.limitPerSecond !== undefined) {
      this.headerLimitPerSecond = parsed.limitPerSecond;
      this.isHeaderBasedLimiting = true;
    }

    if (parsed.remainingThisSecond !== undefined) {
      this.headerRemainingThisSecond = parsed.remainingThisSecond;
    }

    if (parsed.limitPerDay !== undefined) {
      this.headerLimitPerDay = parsed.limitPerDay;
      this.isHeaderBasedLimiting = true;
    }

    if (parsed.remainingToday !== undefined) {
      const observationId = matchedReservationId ?? this.nextReservationId;
      if (isQuotaProbe && parsed.remainingToday > 0) {
        this.uncertainRequestTimestamps = [];
      }
      const exhaustedByEarlierObservation = this.headerRemainingToday === 0 &&
        parsed.remainingToday > 0 && matchedReservationId !== undefined && !isQuotaProbe;
      const exhaustedByUncorrelatedObservation = this.headerRemainingToday === 0 &&
        parsed.remainingToday > 0 && matchedReservationId === undefined;
      if (exhaustedByEarlierObservation || exhaustedByUncorrelatedObservation) {
        // Client reservation order cannot establish Etsy's server processing
        // order. Once any response reports exhaustion, only the guarded probe
        // may reopen quota; a delayed response from an earlier-dispatched
        // request or an uncorrelated convenience response can still carry a
        // stale positive snapshot.
      } else if (isQuotaProbe || this.headerRemainingToday === undefined) {
        this.headerRemainingToday = parsed.remainingToday;
        this.latestHeaderReservationId = Math.max(this.latestHeaderReservationId, observationId);
      } else if (parsed.remainingToday < this.headerRemainingToday) {
        // Client reservation order cannot prove Etsy's server processing order.
        // Keep the most restrictive observation unless a guarded probe succeeds.
        this.headerRemainingToday = parsed.remainingToday;
        this.latestHeaderReservationId = Math.max(this.latestHeaderReservationId, observationId);
      }

      if (this.headerRemainingToday !== undefined && this.headerRemainingToday > 0) {
        this.headerQuotaAvailableAt = 0;
        this.quotaProbeBackoffMs = 60_000;
      } else if (this.headerQuotaAvailableAt === 0) {
        // Other processes may free a rolling quota slot before this process's
        // oldest call expires. Retry with one guarded, gradually less frequent
        // probe rather than falling back to a potentially overlarge local QPD.
        this.scheduleQuotaProbe();
      }

      // Fire warning callback if approaching limit
      this.checkApproachingLimit();
    } else if (matchedReservationId !== undefined && this.headerRemainingToday !== undefined) {
      // A request without a QPD header still consumes one slot. Be conservative
      // until a newer authoritative response refreshes this value.
      this.headerRemainingToday = Math.max(0, this.headerRemainingToday - 1);
      if (this.headerRemainingToday === 0 && this.headerQuotaAvailableAt === 0) {
        this.scheduleQuotaProbe();
      }
    }

    this.notifyStateWaiters();
  }

  /**
   * Parse rate limit headers from response
   */
  private parseRateLimitHeaders(
    headers: Headers | Record<string, string>
  ): EtsyRateLimitHeaders {
    const getHeader = (name: string): string | null => {
      if (headers instanceof Headers) {
        return headers.get(name);
      }
      // Handle plain object (case-insensitive lookup)
      const lowerName = name.toLowerCase();
      for (const key of Object.keys(headers)) {
        if (key.toLowerCase() === lowerName) {
          return headers[key] ?? null;
        }
      }
      return null;
    };

    const parseNumber = (value: string | null): number | undefined => {
      if (value === null) return undefined;
      const num = parseInt(value, 10);
      return Number.isNaN(num) ? undefined : num;
    };

    return {
      limitPerSecond: parseNumber(getHeader('x-limit-per-second')),
      remainingThisSecond: parseNumber(getHeader('x-remaining-this-second')),
      limitPerDay: parseNumber(getHeader('x-limit-per-day')),
      remainingToday: parseNumber(getHeader('x-remaining-today')),
      retryAfter: parseNumber(getHeader('retry-after'))
    };
  }

  /**
   * Check if approaching daily limit and fire callback
   */
  private checkApproachingLimit(): void {
    if (!this.config.onApproachingLimit) return;

    const limit = this.headerLimitPerDay ?? this.config.maxRequestsPerDay;
    const remaining = this.headerRemainingToday ?? this.getRemainingRequests();
    const used = limit - remaining;
    const percentageUsed = (used / limit) * 100;

    if (percentageUsed >= this.config.qpdWarningThreshold) {
      this.config.onApproachingLimit(remaining, limit, percentageUsed);
    }
  }

  /**
   * Handle a 429 rate limit response. Determines if retry is possible.
   *
   * @param headers - Response headers from 429 response
   * @returns Object indicating if retry should occur and delay to wait
   * @throws EtsyRateLimitError if QPD exhausted or max retries exceeded
   */
  public async handleRateLimitResponse(
    headers: Headers | Record<string, string> | undefined | null,
    reservationId?: number,
    retryAttempt?: number
  ): Promise<{ shouldRetry: boolean; delayMs: number }> {
    const parsed: EtsyRateLimitHeaders = headers ? this.parseRateLimitHeaders(headers) : {};

    // Update our state from headers
    this.updateFromHeaders(headers, reservationId);

    // When Etsy reports no QPD remaining, do not replay the request. Preserve
    // its Retry-After so later caller-initiated requests wait before probing
    // the rolling quota again.
    if (parsed.remainingToday === 0) {
      if (parsed.retryAfter !== undefined) {
        this.headerQuotaAvailableAt = Date.now() + parsed.retryAfter * 1000;
        this.retryNotBefore = Math.max(this.retryNotBefore, this.headerQuotaAvailableAt);
      }
      this.currentRetryCount = 0;
      throw new EtsyRateLimitError(
        'Daily rate limit exhausted according to Etsy response headers.',
        parsed.retryAfter,
        'qpd_exhausted'
      );
    }

    const attempt = retryAttempt ?? this.currentRetryCount + 1;
    if (retryAttempt === undefined) this.currentRetryCount = attempt;
    const delayMs = this.calculateBackoffDelay(
      attempt,
      parsed.retryAfter
    );
    this.retryNotBefore = Math.max(this.retryNotBefore, Date.now() + delayMs);

    // Check if we've exceeded max retries after recording the shared cooldown.
    if (attempt > this.config.maxRetries) {
      if (retryAttempt === undefined) this.currentRetryCount = 0; // Reset for next request
      throw new EtsyRateLimitError(
        `Max retries (${this.config.maxRetries}) exceeded for rate limit`,
        parsed.retryAfter,
        'qps_exhausted'
      );
    }

    return { shouldRetry: true, delayMs };
  }

  /**
   * Calculate backoff delay with exponential growth and jitter
   */
  private calculateBackoffDelay(
    attempt: number,
    retryAfterSeconds?: number
  ): number {
    // If server provides retry-after, use it as minimum
    const serverSuggestedMs = retryAfterSeconds ? retryAfterSeconds * 1000 : 0;

    // Calculate exponential backoff
    const exponentialDelay = this.config.baseDelayMs * Math.pow(2, attempt - 1);

    // Apply max cap
    let delay = Math.min(exponentialDelay, this.config.maxDelayMs);

    // Use whichever is larger: our calculation or server suggestion
    delay = Math.max(delay, serverSuggestedMs);

    // Add jitter, but never retry sooner than Etsy's Retry-After minimum.
    if (this.config.jitter > 0) {
      const jitterAmount = delay * this.config.jitter;
      const randomJitter = Math.random() * jitterAmount * 2 - jitterAmount;
      delay += randomJitter;
    }

    return Math.max(serverSuggestedMs, 0, Math.floor(delay));
  }

  /**
   * Reset retry counter (call after successful request)
   */
  public resetRetryCount(): void {
    this.currentRetryCount = 0;
  }

  /**
   * Set the callback for approaching limit warnings.
   * Allows setting/updating the callback after construction.
   */
  public setApproachingLimitCallback(callback: ApproachingLimitCallback | undefined): void {
    (this.config as RateLimitConfig).onApproachingLimit = callback;
  }

  /**
   * Set the warning threshold percentage.
   */
  public setWarningThreshold(threshold: number): void {
    this.config.qpdWarningThreshold = threshold;
  }

  /**
   * Calculate effective minimum interval between requests
   */
  private getEffectiveMinInterval(): number {
    // If we have header-based QPS info, use it
    if (this.headerLimitPerSecond !== undefined && this.headerLimitPerSecond > 0) {
      return Math.ceil(1000 / this.headerLimitPerSecond);
    }
    // Fall back to config
    return this.config.minRequestInterval;
  }

  /**
   * Wait for rate limit constraints to be satisfied.
   * Uses header-based limits if available, falls back to config values.
   */
  public async waitForRateLimit(): Promise<void> {
    // Keep the original convenience API for callers that only need a paced
    // dispatch. Without a returned reservation ID, response headers cannot
    // safely be correlated when concurrent calls complete out of order.
    const reservationId = await this.acquireRequestSlot();
    this.finishReservation(reservationId, false);
  }

  /**
   * Reserve a paced request and return its identity for response reconciliation.
   * Pass the returned ID to updateFromHeaders() (or releaseRequestSlot() if
   * transport fails) so out-of-order responses cannot reopen exhausted quota.
   */
  public async waitForRateLimitWithReservation(): Promise<number> {
    return this.acquireRequestSlot();
  }

  /**
   * Get current rate limit status with header-based information
   */
  public getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();
    this.pruneRequestTimestamps(now);
    this.refreshExpiredHeaderQuota(now);

    const effectiveRemaining = this.getEffectiveRemainingRequests(now);
    const qpdProbeReady = this.isQuotaProbeReady(now);

    return {
      remainingRequests: effectiveRemaining,
      resetTime: this.headerRemainingToday === 0
        ? new Date(this.headerQuotaAvailableAt || now)
        : this.getLocalResetTime(now),
      canMakeRequest: (effectiveRemaining > 0 || qpdProbeReady) &&
        (now - this.lastRequestTime) >= this.getEffectiveMinInterval() &&
        now >= this.retryNotBefore,
      // New fields
      isFromHeaders: this.isHeaderBasedLimiting,
      limitPerSecond: this.headerLimitPerSecond,
      remainingThisSecond: this.headerRemainingThisSecond,
      limitPerDay: this.headerLimitPerDay
    };
  }

  /**
   * Get remaining requests count
   */
  public getRemainingRequests(): number {
    const now = Date.now();
    this.pruneRequestTimestamps(now);
    this.refreshExpiredHeaderQuota(now);
    return this.getEffectiveRemainingRequests(now);
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  public reset(): void {
    this.requestTimestamps = [];
    this.lastRequestTime = 0;
    this.currentRetryCount = 0;
    this.quotaProbeBackoffMs = 60_000;
    this.headerQuotaAvailableAt = 0;
    this.retryNotBefore = 0;
    this.headerLimitPerSecond = undefined;
    this.headerRemainingThisSecond = undefined;
    this.headerLimitPerDay = undefined;
    this.headerRemainingToday = undefined;
    this.isHeaderBasedLimiting = false;
    this.nextReservationId = 0;
    this.latestHeaderReservationId = 0;
    this.inFlightReservations.clear();
    this.uncertainRequestTimestamps = [];
    this.quotaProbeInFlight = false;
    this.notifyStateWaiters();
  }

  /**
   * Check if we can make a request immediately
   */
  public canMakeRequest(): boolean {
    const now = Date.now();
    this.pruneRequestTimestamps(now);
    this.refreshExpiredHeaderQuota(now);

    // Check if daily limit is exceeded (prefer headers)
    const effectiveRemaining = this.getEffectiveRemainingRequests(now);
    const qpdProbeReady = this.isQuotaProbeReady(now);
    if (effectiveRemaining <= 0 && !qpdProbeReady) {
      return false;
    }

    // Check if enough time has passed since last request
    return (now - this.lastRequestTime) >= this.getEffectiveMinInterval() &&
      now >= this.retryNotBefore;
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   */
  public getTimeUntilNextRequest(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = this.getEffectiveMinInterval();

    return Math.max(
      0,
      minInterval - timeSinceLastRequest,
      this.retryNotBefore - now
    );
  }

  /**
   * Get configuration
   */
  public getConfig(): RateLimitConfig {
    return { ...this.config };
  }
}

/**
 * Default rate limiter instance
 */
export const defaultRateLimiter = new EtsyRateLimiter();
