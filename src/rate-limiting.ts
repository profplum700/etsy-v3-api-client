/**
 * Rate limiting implementation for Etsy API v3
 * Etsy API limits: 10,000 requests per day, 10 requests per second
 *
 * This implementation supports:
 * - Header-based rate limiting using Etsy's response headers
 * - Automatic retry on 429 errors with exponential backoff
 * - Callback notification when approaching daily limit
 * - Fallback to configured values when headers are unavailable
 */

import {
  RateLimitConfig,
  RateLimitStatus,
  EtsyRateLimitError,
  EtsyRateLimitHeaders,
  ApproachingLimitCallback
} from './types';

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
  // Existing state for local tracking
  private requestCount = 0;
  private dailyReset = new Date();
  private lastRequestTime = 0;
  private readonly config: RequiredRateLimitConfig;

  // Header-based state
  private headerLimitPerSecond?: number;
  private headerRemainingThisSecond?: number;
  private headerLimitPerDay?: number;
  private headerRemainingToday?: number;
  private isHeaderBasedLimiting = false;

  // Retry state
  private currentRetryCount = 0;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      // Existing defaults
      maxRequestsPerDay: 10000,
      maxRequestsPerSecond: 10,
      minRequestInterval: 100, // 100ms = 10 requests per second
      // New defaults
      maxRetries: 3,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitter: 0.1,
      qpdWarningThreshold: 80,
      onApproachingLimit: undefined,
      ...config
    };

    // Set next reset to midnight UTC tomorrow
    this.setNextDailyReset();
  }

  private setNextDailyReset(): void {
    const now = new Date();
    this.dailyReset = new Date(now);
    this.dailyReset.setUTCDate(this.dailyReset.getUTCDate() + 1);
    this.dailyReset.setUTCHours(0, 0, 0, 0);
  }

  /**
   * Update rate limit state from API response headers.
   * Call this after each successful request.
   *
   * @param headers - Response headers (Headers object or plain object)
   */
  public updateFromHeaders(headers: Headers | Record<string, string> | undefined | null): void {
    if (!headers) {
      return; // No headers to parse
    }
    const parsed = this.parseRateLimitHeaders(headers);

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
      this.headerRemainingToday = parsed.remainingToday;

      // Fire warning callback if approaching limit
      this.checkApproachingLimit();
    }
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
      return isNaN(num) ? undefined : num;
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
    headers: Headers | Record<string, string> | undefined | null
  ): Promise<{ shouldRetry: boolean; delayMs: number }> {
    const parsed: EtsyRateLimitHeaders = headers ? this.parseRateLimitHeaders(headers) : {};

    // Update our state from headers
    this.updateFromHeaders(headers);

    // Check if QPD is exhausted (no retry possible)
    if (this.headerRemainingToday === 0) {
      throw new EtsyRateLimitError(
        'Daily rate limit exhausted. No requests remaining until limit resets.',
        parsed.retryAfter,
        'qpd_exhausted'
      );
    }

    // Check if we've exceeded max retries
    this.currentRetryCount++;
    if (this.currentRetryCount > this.config.maxRetries) {
      this.currentRetryCount = 0; // Reset for next request
      throw new EtsyRateLimitError(
        `Max retries (${this.config.maxRetries}) exceeded for rate limit`,
        parsed.retryAfter,
        'qps_exhausted'
      );
    }

    // Calculate delay with exponential backoff
    const delayMs = this.calculateBackoffDelay(
      this.currentRetryCount,
      parsed.retryAfter
    );

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

    // Add jitter
    if (this.config.jitter > 0) {
      const jitterAmount = delay * this.config.jitter;
      const randomJitter = Math.random() * jitterAmount * 2 - jitterAmount;
      delay += randomJitter;
    }

    return Math.max(0, Math.floor(delay));
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
    const now = Date.now();

    // Reset daily counter if needed (fallback behavior)
    if (now >= this.dailyReset.getTime()) {
      this.requestCount = 0;
      this.setNextDailyReset();
    }

    // Determine effective limits (prefer headers over config)
    const effectiveDailyLimit = this.headerLimitPerDay ?? this.config.maxRequestsPerDay;
    const effectiveRemaining = this.headerRemainingToday ??
      (effectiveDailyLimit - this.requestCount);

    // Check daily limit
    if (effectiveRemaining <= 0) {
      const timeUntilReset = this.dailyReset.getTime() - now;
      throw new EtsyRateLimitError(
        `Daily rate limit exhausted (${effectiveDailyLimit} requests). ` +
        `Reset in approximately ${Math.ceil(timeUntilReset / 1000 / 60)} minutes.`,
        Math.ceil(timeUntilReset / 1000),
        'qpd_exhausted'
      );
    }

    // Check per-second limit using effective interval
    const minInterval = this.getEffectiveMinInterval();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < minInterval) {
      const waitTime = minInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Get current rate limit status with header-based information
   */
  public getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();

    // Check if we need to reset daily counter
    if (now >= this.dailyReset.getTime()) {
      this.requestCount = 0;
      this.setNextDailyReset();
    }

    const effectiveRemaining = this.headerRemainingToday ??
      Math.max(0, this.config.maxRequestsPerDay - this.requestCount);

    return {
      remainingRequests: effectiveRemaining,
      resetTime: this.dailyReset,
      canMakeRequest: effectiveRemaining > 0 &&
        (now - this.lastRequestTime) >= this.getEffectiveMinInterval(),
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
    return this.headerRemainingToday ??
      Math.max(0, this.config.maxRequestsPerDay - this.requestCount);
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  public reset(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
    this.currentRetryCount = 0;
    this.headerLimitPerSecond = undefined;
    this.headerRemainingThisSecond = undefined;
    this.headerLimitPerDay = undefined;
    this.headerRemainingToday = undefined;
    this.isHeaderBasedLimiting = false;
    this.setNextDailyReset();
  }

  /**
   * Check if we can make a request immediately
   */
  public canMakeRequest(): boolean {
    const now = Date.now();

    // Check if we need to reset daily counter
    if (now >= this.dailyReset.getTime()) {
      this.requestCount = 0;
      this.setNextDailyReset();
    }

    // Check if daily limit is exceeded (prefer headers)
    const effectiveRemaining = this.headerRemainingToday ??
      (this.config.maxRequestsPerDay - this.requestCount);
    if (effectiveRemaining <= 0) {
      return false;
    }

    // Check if enough time has passed since last request
    return (now - this.lastRequestTime) >= this.getEffectiveMinInterval();
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   */
  public getTimeUntilNextRequest(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minInterval = this.getEffectiveMinInterval();

    if (timeSinceLastRequest >= minInterval) {
      return 0;
    }

    return minInterval - timeSinceLastRequest;
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
