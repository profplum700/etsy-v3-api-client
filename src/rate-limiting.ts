/**
 * Rate limiting implementation for Etsy API v3
 * Etsy API limits: 10,000 requests per day, 10 requests per second
 */

import { RateLimitConfig, RateLimitStatus, EtsyRateLimitError } from './types';

export class EtsyRateLimiter {
  private requestCount = 0;
  private dailyReset = new Date();
  private lastRequestTime = 0;
  private readonly config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = {
      maxRequestsPerDay: 10000,
      maxRequestsPerSecond: 10,
      minRequestInterval: 100, // 100ms = 10 requests per second
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
   * Wait for rate limit constraints to be satisfied
   */
  public async waitForRateLimit(): Promise<void> {
    const now = Date.now();

    // Reset daily counter if needed
    if (now >= this.dailyReset.getTime()) {
      this.requestCount = 0;
      this.setNextDailyReset();
    }

    // Check daily limit
    if (this.requestCount >= this.config.maxRequestsPerDay) {
      const timeUntilReset = this.dailyReset.getTime() - now;
      throw new EtsyRateLimitError(
        `Daily rate limit of ${this.config.maxRequestsPerDay} requests exceeded. Reset in ${Math.ceil(timeUntilReset / 1000 / 60)} minutes.`,
        timeUntilReset
      );
    }

    // Check per-second limit
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.config.minRequestInterval) {
      const waitTime = this.config.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.requestCount++;
    this.lastRequestTime = Date.now();
  }

  /**
   * Get current rate limit status
   */
  public getRateLimitStatus(): RateLimitStatus {
    const now = Date.now();
    
    // Check if we need to reset daily counter
    if (now >= this.dailyReset.getTime()) {
      this.requestCount = 0;
      this.setNextDailyReset();
    }
    
    return {
      remainingRequests: Math.max(0, this.config.maxRequestsPerDay - this.requestCount),
      resetTime: this.dailyReset,
      canMakeRequest: this.requestCount < this.config.maxRequestsPerDay &&
                     (now - this.lastRequestTime) >= this.config.minRequestInterval
    };
  }

  /**
   * Get remaining requests count
   */
  public getRemainingRequests(): number {
    return Math.max(0, this.config.maxRequestsPerDay - this.requestCount);
  }

  /**
   * Reset the rate limiter (useful for testing)
   */
  public reset(): void {
    this.requestCount = 0;
    this.lastRequestTime = 0;
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
    
    // Check if daily limit is exceeded
    if (this.requestCount >= this.config.maxRequestsPerDay) {
      return false;
    }
    
    // Check if enough time has passed since last request
    return (now - this.lastRequestTime) >= this.config.minRequestInterval;
  }

  /**
   * Get time until next request is allowed (in milliseconds)
   */
  public getTimeUntilNextRequest(): number {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest >= this.config.minRequestInterval) {
      return 0;
    }
    
    return this.config.minRequestInterval - timeSinceLastRequest;
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