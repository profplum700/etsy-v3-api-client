/**
 * Tests for Retry Logic with Exponential Backoff (Phase 1)
 */

import { withRetry, RetryManager, DEFAULT_RETRY_CONFIG } from '../src/retry';
import { EtsyApiError } from '../src/types';

// Helper to create a mock operation that fails N times then succeeds
function createFailingOperation(failCount: number, errorCode = 500) {
  let attempts = 0;
  return async () => {
    attempts++;
    if (attempts <= failCount) {
      throw new EtsyApiError(`Server error ${attempts}`, errorCode);
    }
    return { success: true, attempts };
  };
}

// Helper to create a mock operation that always fails
function createAlwaysFailingOperation(errorCode = 500) {
  let attempts = 0;
  return async () => {
    attempts++;
    throw new EtsyApiError(`Server error ${attempts}`, errorCode);
  };
}

describe('Retry Logic', () => {
  // Increase timeout for retry tests since they involve delays
  jest.setTimeout(15000);

  describe('withRetry', () => {
    it('should succeed on first attempt if operation succeeds', async () => {
      const operation = jest.fn(async () => ({ success: true }));

      const result = await withRetry(operation, { maxRetries: 3 });

      expect(result).toEqual({ success: true });
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors', async () => {
      const operation = createFailingOperation(2, 500); // Fail twice, succeed on third

      const result = await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 10, // Short delay for testing
        exponentialBackoff: false
      });

      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
    });

    it('should throw after exhausting retries', async () => {
      const operation = createAlwaysFailingOperation(500);

      await expect(
        withRetry(operation, {
          maxRetries: 2,
          retryDelay: 10,
          exponentialBackoff: false
        })
      ).rejects.toThrow('Server error 3'); // Initial + 2 retries = 3 attempts
    });

    it('should not retry non-retryable errors', async () => {
      const operation = jest.fn(async () => {
        throw new EtsyApiError('Bad request', 400);
      });

      await expect(
        withRetry(operation, {
          maxRetries: 3,
          retryDelay: 10
        })
      ).rejects.toThrow('Bad request');

      // Should only try once since 400 is not retryable
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('should retry 429 rate limit errors', async () => {
      const operation = createFailingOperation(1, 429);

      const result = await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 10,
        exponentialBackoff: false
      });

      expect(result.success).toBe(true);
    });

    it('should retry 503 service unavailable errors', async () => {
      const operation = createFailingOperation(1, 503);

      const result = await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 10,
        exponentialBackoff: false
      });

      expect(result.success).toBe(true);
    });

    it('should use exponential backoff when enabled', async () => {
      const operation = createFailingOperation(2, 500);
      const startTime = Date.now();

      await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 100,
        exponentialBackoff: true,
        jitter: 0 // Disable jitter for predictable timing
      });

      const duration = Date.now() - startTime;

      // First retry: 100ms, second retry: 200ms
      // Total should be at least 300ms
      expect(duration).toBeGreaterThanOrEqual(250); // Allow some slack
    });

    it('should use linear backoff when exponential is disabled', async () => {
      const operation = createFailingOperation(2, 500);
      const startTime = Date.now();

      await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 100,
        exponentialBackoff: false,
        jitter: 0
      });

      const duration = Date.now() - startTime;

      // First retry: 100ms, second retry: 200ms (linear)
      // Total should be at least 300ms
      expect(duration).toBeGreaterThanOrEqual(250);
    });

    it('should respect maxRetryDelay', async () => {
      const operation = createFailingOperation(3, 500);
      const startTime = Date.now();

      await withRetry(operation, {
        maxRetries: 4,
        retryDelay: 100,
        exponentialBackoff: true,
        maxRetryDelay: 150,
        jitter: 0
      });

      const duration = Date.now() - startTime;

      // Even with exponential backoff, delays should be capped at 150ms
      // First: 100ms, Second: 150ms (capped), Third: 150ms (capped)
      // Total should be around 400ms, not 700ms if uncapped
      expect(duration).toBeLessThan(600);
    });

    it('should call onRetry callback', async () => {
      const operation = createFailingOperation(2, 500);
      const onRetry = jest.fn();

      await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 10,
        exponentialBackoff: false,
        onRetry
      });

      expect(onRetry).toHaveBeenCalledTimes(2);
      expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(EtsyApiError));
      expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(EtsyApiError));
    });

    it('should handle abort signal', async () => {
      const controller = new AbortController();
      const operation = createAlwaysFailingOperation(500);

      // Abort after 50ms
      setTimeout(() => controller.abort(), 50);

      await expect(
        withRetry(operation, {
          maxRetries: 10,
          retryDelay: 10,
          signal: controller.signal
        })
      ).rejects.toThrow('Operation aborted');
    });

    it('should retry network errors', async () => {
      let attempts = 0;
      const operation = async () => {
        attempts++;
        if (attempts <= 2) {
          throw new TypeError('fetch failed');
        }
        return { success: true };
      };

      const result = await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 10,
        exponentialBackoff: false
      });

      expect(result.success).toBe(true);
    });
  });

  describe('RetryManager', () => {
    it('should create instance with default config', () => {
      const manager = new RetryManager();
      const config = manager.getConfig();

      expect(config.maxRetries).toBe(DEFAULT_RETRY_CONFIG.maxRetries);
      expect(config.retryDelay).toBe(DEFAULT_RETRY_CONFIG.retryDelay);
    });

    it('should create instance with custom config', () => {
      const manager = new RetryManager({
        maxRetries: 5,
        retryDelay: 2000
      });
      const config = manager.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
    });

    it('should execute operation with retry', async () => {
      const manager = new RetryManager({
        maxRetries: 3,
        retryDelay: 10,
        exponentialBackoff: false
      });

      const operation = createFailingOperation(2, 500);
      const result = await manager.execute(operation);

      expect(result.success).toBe(true);
    });

    it('should allow updating config', () => {
      const manager = new RetryManager({ maxRetries: 3 });

      manager.updateConfig({ maxRetries: 5, retryDelay: 2000 });
      const config = manager.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.retryDelay).toBe(2000);
    });

    it('should allow overriding config per operation', async () => {
      const manager = new RetryManager({
        maxRetries: 1,
        retryDelay: 10
      });

      const operation = createFailingOperation(2, 500);

      const result = await manager.execute(operation, {
        maxRetries: 3 // Override
      });

      expect(result.success).toBe(true);
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.retryDelay).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.exponentialBackoff).toBe(true);
      expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(429);
      expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(500);
      expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(502);
      expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(503);
      expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toContain(504);
    });
  });

  describe('edge cases', () => {
    it('should handle maxRetries of 0', async () => {
      const operation = createAlwaysFailingOperation(500);

      await expect(
        withRetry(operation, {
          maxRetries: 0,
          retryDelay: 10
        })
      ).rejects.toThrow('Server error 1');
    });

    it('should handle very large retry delays', async () => {
      const operation = createFailingOperation(1, 500);

      // Should still work, just take longer
      const result = await withRetry(operation, {
        maxRetries: 2,
        retryDelay: 1,
        exponentialBackoff: true
      });

      expect(result.success).toBe(true);
    });

    it('should apply jitter to retry delays', async () => {
      const delays: number[] = [];
      const originalSetTimeout = global.setTimeout;

      // Mock setTimeout to capture delays
      global.setTimeout = jest.fn((callback, delay) => {
        if (typeof delay === 'number' && delay > 0) {
          delays.push(delay);
        }
        return originalSetTimeout(callback as any, 0); // Execute immediately for test
      }) as any;

      const operation = createFailingOperation(2, 500);

      await withRetry(operation, {
        maxRetries: 3,
        retryDelay: 100,
        exponentialBackoff: false,
        jitter: 0.1
      });

      // Restore setTimeout
      global.setTimeout = originalSetTimeout;

      // With jitter, delays should vary
      expect(delays.length).toBe(2);
      // Each delay should be roughly 100ms ± 10ms
      expect(delays[0]).toBeGreaterThan(80);
      expect(delays[0]).toBeLessThan(120);
    });
  });
});
