/**
 * Global request queue for coordinating rate limits across multiple client instances
 * Prevents hitting Etsy API rate limits when using multiple EtsyClient instances
 */

import { EtsyRateLimitError } from './types';

/**
 * Priority levels for requests
 */
export type RequestPriority = 'high' | 'normal' | 'low';

/**
 * Options for enqueueing a request
 */
export interface QueueOptions {
  /**
   * Priority level (higher priority requests are processed first)
   * @default 'normal'
   */
  priority?: RequestPriority;

  /**
   * Timeout for the request in milliseconds
   * @default 30000 (30 seconds)
   */
  timeout?: number;

  /**
   * Endpoint path for better rate limit tracking
   */
  endpoint?: string;
}

/**
 * Queued request information
 */
interface QueuedRequest<T> {
  id: string;
  request: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
  priority: RequestPriority;
  addedAt: number;
  timeout?: number;
  endpoint?: string;
}

/**
 * Rate limit information
 */
interface RateLimitInfo {
  remaining: number;
  resetAt: number;
}

/**
 * Global Request Queue (Singleton)
 *
 * Coordinates requests across multiple EtsyClient instances to prevent
 * exceeding Etsy's rate limits.
 *
 * Features:
 * - Singleton pattern (shared across all client instances)
 * - Priority queue (high/normal/low)
 * - Automatic rate limit handling
 * - Request timeout support
 * - Progress tracking
 *
 * @example
 * ```typescript
 * import { GlobalRequestQueue } from '@profplum700/etsy-v3-api-client';
 *
 * const queue = GlobalRequestQueue.getInstance();
 *
 * // All clients use the same queue
 * const client1 = new EtsyClient(config1);
 * const client2 = new EtsyClient(config2);
 *
 * // Requests are coordinated to avoid rate limits
 * await Promise.all([
 *   client1.getShop('shop1'),
 *   client2.getShop('shop2'),
 * ]);
 * ```
 */
export class GlobalRequestQueue {
  private static instance: GlobalRequestQueue | null = null;

  private queue: QueuedRequest<unknown>[] = [];
  private processing = false;
  private rateLimits = new Map<string, RateLimitInfo>();
  private requestCount = 0;
  private dailyReset = new Date();
  private lastRequestTime = 0;

  // Configuration
  private readonly maxRequestsPerDay = 10000;
  private readonly maxRequestsPerSecond = 10;
  private readonly minRequestInterval = 100; // 100ms = 10 req/sec

  private constructor() {
    this.setNextDailyReset();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): GlobalRequestQueue {
    if (!this.instance) {
      this.instance = new GlobalRequestQueue();
    }
    return this.instance;
  }

  /**
   * Reset the singleton instance (useful for testing)
   */
  static resetInstance(): void {
    this.instance = null;
  }

  /**
   * Enqueue a request
   */
  async enqueue<T>(
    request: () => Promise<T>,
    options: QueueOptions = {}
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const queuedRequest = {
        id: this.generateId(),
        request,
        resolve: resolve as (value: unknown) => void,
        reject,
        priority: options.priority ?? 'normal',
        addedAt: Date.now(),
        timeout: options.timeout ?? 30000,
        endpoint: options.endpoint,
      } as QueuedRequest<unknown>;

      this.queue.push(queuedRequest);

      // Start processing if not already running
      if (!this.processing) {
        this.processQueue().catch(error => {
          console.error('Queue processing error:', error);
        });
      }
    });
  }

  /**
   * Get current queue status
   */
  getStatus(): {
    queueLength: number;
    processing: boolean;
    remainingRequests: number;
    resetTime: Date;
  } {
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      remainingRequests: Math.max(0, this.maxRequestsPerDay - this.requestCount),
      resetTime: this.dailyReset,
    };
  }

  /**
   * Clear the queue
   */
  clear(): void {
    this.queue.forEach(item => {
      item.reject(new Error('Queue cleared'));
    });
    this.queue = [];
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    if (this.processing) {
      return;
    }

    this.processing = true;

    try {
      while (this.queue.length > 0) {
        // Reset daily counter if needed
        if (Date.now() >= this.dailyReset.getTime()) {
          this.requestCount = 0;
          this.setNextDailyReset();
        }

        // Check daily limit
        if (this.requestCount >= this.maxRequestsPerDay) {
          const timeUntilReset = this.dailyReset.getTime() - Date.now();
          console.warn(
            `Daily rate limit reached. Waiting ${Math.ceil(timeUntilReset / 1000 / 60)} minutes until reset.`
          );

          // Wait until reset
          await this.delay(timeUntilReset);
          this.requestCount = 0;
          this.setNextDailyReset();
        }

        // Wait for rate limit
        await this.waitForRateLimit();

        // Sort queue by priority
        this.queue.sort((a, b) => {
          const priorityOrder: Record<RequestPriority, number> = {
            high: 0,
            normal: 1,
            low: 2,
          };
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        });

        // Get next request
        const item = this.queue.shift();
        if (!item) {
          break;
        }

        // Check timeout
        const elapsed = Date.now() - item.addedAt;
        if (item.timeout && elapsed > item.timeout) {
          item.reject(new Error(`Request timeout after ${elapsed}ms`));
          continue;
        }

        // Execute request
        try {
          const result = await item.request();
          item.resolve(result);
          this.requestCount++;
          this.lastRequestTime = Date.now();
        } catch (error) {
          // Update rate limit info from error
          if (error instanceof EtsyRateLimitError) {
            this.updateRateLimitInfo(error);
          }
          item.reject(error);
        }

        // Small delay between requests
        await this.delay(this.minRequestInterval);
      }
    } finally {
      this.processing = false;
    }
  }

  /**
   * Wait for rate limit constraints to be satisfied
   */
  private async waitForRateLimit(): Promise<void> {
    const now = Date.now();

    // Check global rate limit
    const globalRateLimit = this.rateLimits.get('global');
    if (globalRateLimit && now < globalRateLimit.resetAt) {
      const waitTime = globalRateLimit.resetAt - now;
      console.log(`Global rate limit active. Waiting ${waitTime}ms`);
      await this.delay(waitTime);
    }

    // Check per-second limit
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      await this.delay(waitTime);
    }
  }

  /**
   * Update rate limit information from error
   */
  private updateRateLimitInfo(error: EtsyRateLimitError): void {
    const retryAfter = error.retryAfter;
    if (retryAfter) {
      this.rateLimits.set('global', {
        remaining: 0,
        resetAt: Date.now() + retryAfter * 1000,
      });
    }
  }

  /**
   * Set next daily reset time (midnight UTC)
   */
  private setNextDailyReset(): void {
    const now = new Date();
    this.dailyReset = new Date(now);
    this.dailyReset.setUTCDate(this.dailyReset.getUTCDate() + 1);
    this.dailyReset.setUTCHours(0, 0, 0, 0);
  }

  /**
   * Generate unique request ID
   */
  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Get the global request queue instance
 */
export function getGlobalQueue(): GlobalRequestQueue {
  return GlobalRequestQueue.getInstance();
}

/**
 * Queue middleware for wrapping requests
 */
export function withQueue<T>(
  request: () => Promise<T>,
  options?: QueueOptions
): Promise<T> {
  const queue = GlobalRequestQueue.getInstance();
  return queue.enqueue(request, options);
}
