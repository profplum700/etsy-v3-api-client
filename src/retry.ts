/**
 * Request Retry Logic with Exponential Backoff
 * Provides automatic retry for failed requests with configurable backoff
 */

import { EtsyApiError } from './types';

/**
 * Configuration for retry behavior
 */
export interface RetryConfig {
  /**
   * Maximum number of retry attempts (default: 3)
   */
  maxRetries: number;

  /**
   * Initial delay before first retry in milliseconds (default: 1000)
   */
  retryDelay: number;

  /**
   * Whether to use exponential backoff (default: true)
   */
  exponentialBackoff: boolean;

  /**
   * HTTP status codes that should trigger a retry (default: [429, 500, 502, 503, 504])
   */
  retryableStatusCodes: number[];

  /**
   * Callback function called before each retry attempt
   */
  onRetry?: (attempt: number, error: Error) => void;

  /**
   * Maximum delay between retries in milliseconds (default: 30000 = 30 seconds)
   */
  maxRetryDelay?: number;

  /**
   * Jitter factor to randomize delay (0-1, default: 0.1)
   * Helps prevent thundering herd problem
   */
  jitter?: number;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  retryDelay: 1000,
  exponentialBackoff: true,
  retryableStatusCodes: [429, 500, 502, 503, 504],
  maxRetryDelay: 30000,
  jitter: 0.1
};

/**
 * Options for the withRetry helper
 */
export interface RetryOptions extends Partial<RetryConfig> {
  /**
   * Optional signal to abort the retry operation
   */
  signal?: AbortSignal;
}

/**
 * Calculate delay for next retry attempt
 */
function calculateDelay(
  attempt: number,
  config: RetryConfig
): number {
  let delay: number;

  if (config.exponentialBackoff) {
    // Exponential backoff: delay * (2 ^ attempt)
    delay = config.retryDelay * Math.pow(2, attempt - 1);
  } else {
    // Linear backoff
    delay = config.retryDelay * attempt;
  }

  // Apply maximum delay cap
  if (config.maxRetryDelay) {
    delay = Math.min(delay, config.maxRetryDelay);
  }

  // Add jitter to prevent thundering herd
  if (config.jitter && config.jitter > 0) {
    const jitterAmount = delay * config.jitter;
    const randomJitter = Math.random() * jitterAmount * 2 - jitterAmount;
    delay += randomJitter;
  }

  return Math.max(0, Math.floor(delay));
}

/**
 * Check if an error is retryable based on configuration
 */
function isRetryableError(error: unknown, config: RetryConfig): boolean {
  // Check if it's an EtsyApiError with a retryable status code
  if (error instanceof EtsyApiError) {
    const statusCode = error.statusCode;
    if (statusCode && config.retryableStatusCodes.includes(statusCode)) {
      return true;
    }
  }

  // Network errors are generally retryable
  if (error instanceof TypeError && error.message.includes('fetch')) {
    return true;
  }

  return false;
}

/**
 * Extract Retry-After header value from error
 */
function getRetryAfterDelay(error: unknown): number | null {
  if (error instanceof EtsyApiError && error.statusCode === 429) {
    // Try to get Retry-After from response
    // This would need to be added to the error object when creating it
    const retryAfter = (error as any).retryAfter;
    if (typeof retryAfter === 'number') {
      return retryAfter * 1000; // Convert seconds to milliseconds
    }
  }
  return null;
}

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Retry helper function that wraps an async operation
 * @param operation The async function to retry
 * @param options Retry configuration options
 * @returns Promise resolving to the operation result
 *
 * @example
 * ```typescript
 * const data = await withRetry(
 *   async () => client.getShop('123'),
 *   {
 *     maxRetries: 3,
 *     exponentialBackoff: true,
 *     onRetry: (attempt, error) => {
 *       console.log(`Retry attempt ${attempt}: ${error.message}`);
 *     }
 *   }
 * );
 * ```
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const config: RetryConfig = {
    ...DEFAULT_RETRY_CONFIG,
    ...options
  };

  let lastError: Error;
  let attempt = 0;

  while (attempt <= config.maxRetries) {
    try {
      // Check if aborted
      if (options.signal?.aborted) {
        throw new Error('Operation aborted');
      }

      // Execute the operation
      const result = await operation();
      return result;

    } catch (error) {
      lastError = error as Error;
      attempt++;

      // If we've exhausted retries, throw the error
      if (attempt > config.maxRetries) {
        throw lastError;
      }

      // Check if this error is retryable
      if (!isRetryableError(error, config)) {
        throw lastError;
      }

      // Calculate delay
      let delay = calculateDelay(attempt, config);

      // Check for Retry-After header (takes precedence)
      const retryAfterDelay = getRetryAfterDelay(error);
      if (retryAfterDelay !== null) {
        delay = retryAfterDelay;
      }

      // Call onRetry callback if provided
      if (config.onRetry) {
        config.onRetry(attempt, lastError);
      }

      // Wait before retrying
      await sleep(delay);
    }
  }

  // This should never be reached, but TypeScript needs it
  throw lastError!;
}

/**
 * Retry manager class for advanced retry scenarios
 */
export class RetryManager {
  private config: RetryConfig;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      ...DEFAULT_RETRY_CONFIG,
      ...config
    };
  }

  /**
   * Execute an operation with retry logic
   */
  async execute<T>(
    operation: () => Promise<T>,
    options?: RetryOptions
  ): Promise<T> {
    return withRetry(operation, {
      ...this.config,
      ...options
    });
  }

  /**
   * Update retry configuration
   */
  updateConfig(config: Partial<RetryConfig>): void {
    this.config = {
      ...this.config,
      ...config
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config };
  }
}
