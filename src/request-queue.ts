/**
 * Global request queue for coordinating rate limits across multiple client instances
 * Prevents hitting Etsy API rate limits when using multiple EtsyClient instances
 */

import { EtsyRateLimitError } from './types';
import { ETSY_RATE_LIMITS } from './rate-limiting';

const QPD_WINDOW_MS = 24 * 60 * 60 * 1000;

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
  private requestTimestamps: number[] = [];
  private lastRequestTime = 0;

  // Configuration — sourced from the shared ETSY_RATE_LIMITS constant
  private readonly maxRequestsPerDay = ETSY_RATE_LIMITS.MAX_REQUESTS_PER_DAY;
  private readonly maxRequestsPerSecond = ETSY_RATE_LIMITS.MAX_REQUESTS_PER_SECOND;
  private readonly minRequestInterval = ETSY_RATE_LIMITS.MIN_REQUEST_INTERVAL;

  private constructor() {}

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
    /** Estimated expiry of the oldest locally tracked request in the rolling QPD window. */
    resetTime: Date;
  } {
    const now = Date.now();
    this.pruneRequestTimestamps(now);
    return {
      queueLength: this.queue.length,
      processing: this.processing,
      remainingRequests: Math.max(0, this.maxRequestsPerDay - this.requestTimestamps.length),
      resetTime: this.getNextRequestExpiry(now),
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
        const now = Date.now();
        this.pruneRequestTimestamps(now);

        // Etsy's QPD quota is a rolling 24-hour window, not a UTC calendar day.
        if (this.requestTimestamps.length >= this.maxRequestsPerDay) {
          const timeUntilReset = Math.max(0, this.getNextRequestExpiry(now).getTime() - now);
          console.warn(
            `Daily rate limit reached. Waiting ${Math.ceil(timeUntilReset / 1000 / 60)} minutes for the oldest request to leave the rolling 24-hour window.`
          );

          await this.delay(timeUntilReset);
          continue;
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

        // Check if already timed out while waiting in queue
        const elapsed = Date.now() - item.addedAt;
        if (item.timeout && elapsed > item.timeout) {
          item.reject(new Error(`Request timeout after ${elapsed}ms (exceeded while waiting in queue)`));
          continue;
        }

        // Execute request with timeout
        try {
          let result: unknown;

          if (item.timeout) {
            // Capture timeout in local const so the closure cannot see a stale value
            const timeout = item.timeout;
            // Calculate remaining timeout (total timeout minus time already spent in queue)
            const remainingTimeout = timeout - elapsed;
            let timeoutId: ReturnType<typeof setTimeout> | undefined;

            // Race the request against the timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
              timeoutId = setTimeout(() => {
                reject(new Error(`Request timeout after ${timeout}ms (exceeded during execution)`));
              }, remainingTimeout);

              // Prevent open handles in Node.js test runners
              if (timeoutId && typeof timeoutId.unref === 'function') {
                timeoutId.unref();
              }
            });

            try {
              result = await Promise.race([this.startRequest(item.request), timeoutPromise]);
            } finally {
              if (timeoutId) {
                clearTimeout(timeoutId);
              }
            }
          } else {
            // No timeout specified
            result = await this.startRequest(item.request);
          }

          item.resolve(result);
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
      // Keep diagnostic output off stdout so stdio protocols such as MCP stay valid.
      console.warn(`Global rate limit active. Waiting ${waitTime}ms`);
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

  private pruneRequestTimestamps(now: number): void {
    const oldestAllowed = now - QPD_WINDOW_MS;
    while (this.requestTimestamps[0] !== undefined && this.requestTimestamps[0] <= oldestAllowed) {
      this.requestTimestamps.shift();
    }
  }

  private getNextRequestExpiry(now: number): Date {
    this.pruneRequestTimestamps(now);
    const oldestRequest = this.requestTimestamps[0] ?? now;
    return new Date(oldestRequest + QPD_WINDOW_MS);
  }

  private startRequest<T>(request: () => Promise<T>): Promise<T> {
    const startedAt = Date.now();
    this.pruneRequestTimestamps(startedAt);
    this.requestTimestamps.push(startedAt);
    this.lastRequestTime = startedAt;
    return request();
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
    return new Promise(resolve => {
      const timer = setTimeout(resolve, ms) as ReturnType<typeof setTimeout> & {
        unref?: () => void;
      };

      // Ensure timers don't keep the Node.js event loop alive after tests complete
      if (typeof timer.unref === 'function') {
        timer.unref();
      }
    });
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
