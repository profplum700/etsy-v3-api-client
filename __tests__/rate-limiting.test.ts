/**
 * Unit tests for EtsyRateLimiter
 */

import { EtsyRateLimiter, defaultRateLimiter } from '../src/rate-limiting';
import { EtsyRateLimitError } from '../src/types';

describe('EtsyRateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const rateLimiter = new EtsyRateLimiter();
      const config = rateLimiter.getConfig();
      
      expect(config.maxRequestsPerDay).toBe(5000);
      expect(config.maxRequestsPerSecond).toBe(5);
      expect(config.minRequestInterval).toBe(200);
    });

    it('should initialize with custom configuration', () => {
      const customConfig = {
        maxRequestsPerDay: 5000,
        maxRequestsPerSecond: 5,
        minRequestInterval: 200
      };
      
      const rateLimiter = new EtsyRateLimiter(customConfig);
      const config = rateLimiter.getConfig();
      
      expect(config.maxRequestsPerDay).toBe(5000);
      expect(config.maxRequestsPerSecond).toBe(5);
      expect(config.minRequestInterval).toBe(200);
    });

    it('should merge partial configuration with defaults', () => {
      const partialConfig = {
        maxRequestsPerDay: 8000
      };
      
      const rateLimiter = new EtsyRateLimiter(partialConfig);
      const config = rateLimiter.getConfig();
      
      expect(config.maxRequestsPerDay).toBe(8000);
      expect(config.maxRequestsPerSecond).toBe(5); // default
      expect(config.minRequestInterval).toBe(200); // default
    });

    it('should ignore undefined overrides so retry defaults stay finite', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerSecond: 3,
        minRequestInterval: 350,
        maxRetries: undefined,
        baseDelayMs: undefined,
        maxDelayMs: undefined,
        jitter: undefined,
        qpdWarningThreshold: undefined,
      });

      const retry = await rateLimiter.handleRateLimitResponse({ 'x-remaining-today': '5000' });

      expect(Number.isFinite(retry.delayMs)).toBe(true);
      expect(retry.delayMs).toBeGreaterThan(0);
      expect(rateLimiter.getConfig().maxRetries).toBe(3);
      expect(rateLimiter.getConfig().baseDelayMs).toBe(1000);
    });
  });

  describe('waitForRateLimit', () => {
    it('should allow request when under limits', async () => {
      const rateLimiter = new EtsyRateLimiter();
      
      // Should not throw or wait
      await rateLimiter.waitForRateLimit();
      
      expect(rateLimiter.getRemainingRequests()).toBe(4999);
    });

    it('should wait for minimum interval between requests', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 200
      });

      // Make first request
      await rateLimiter.waitForRateLimit();

      // Start second request immediately - should wait
      const waitPromise = rateLimiter.waitForRateLimit();

      // Fast-forward time to simulate waiting
      vi.advanceTimersByTime(200);

      await waitPromise;

      expect(rateLimiter.getRemainingRequests()).toBe(4998);
    });

    it('should serialize concurrent reservations at the configured interval', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 100 });
      const startedAt = Date.now();
      const dispatchTimes: number[] = [];
      const requests = Array.from({ length: 5 }, async () => {
        await rateLimiter.waitForRateLimit();
        dispatchTimes.push(Date.now());
      });

      await vi.runAllTimersAsync();
      await Promise.all(requests);

      expect(dispatchTimes).toEqual([0, 100, 200, 300, 400].map((offset) => startedAt + offset));
      expect(rateLimiter.getRemainingRequests()).toBe(4995);
    });

    it('should apply Retry-After to queued requests and keep it as a strict minimum', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 100,
        baseDelayMs: 100,
        jitter: 0,
      });
      await rateLimiter.waitForRateLimit();
      const startedAt = Date.now();
      const dispatchedAt: number[] = [];
      const request = rateLimiter.waitForRateLimit().then(() => dispatchedAt.push(Date.now()));
      await Promise.resolve();
      await vi.advanceTimersByTimeAsync(50);
      const retry = await rateLimiter.handleRateLimitResponse({ 'retry-after': '2' });
      expect(retry.delayMs).toBe(2000);

      await vi.advanceTimersByTimeAsync(1999);
      expect(dispatchedAt).toEqual([]);
      await vi.advanceTimersByTimeAsync(1);
      await request;
      expect(dispatchedAt).toEqual([startedAt + 2050]);
    });

    it('should never jitter below Etsy Retry-After', async () => {
      const randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0);
      const rateLimiter = new EtsyRateLimiter({
        baseDelayMs: 1000,
        jitter: 0.5,
      });

      const retry = await rateLimiter.handleRateLimitResponse({ 'retry-after': '10' });

      expect(retry.delayMs).toBeGreaterThanOrEqual(10000);
      randomSpy.mockRestore();
    });

    it('should throw error when daily limit exceeded', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 2,
        minRequestInterval: 0 // Remove time delay for testing
      });

      // Make two requests to reach limit
      await rateLimiter.waitForRateLimit();
      await rateLimiter.waitForRateLimit();

      // Third request should throw error
      await expect(rateLimiter.waitForRateLimit()).rejects.toThrow(EtsyRateLimitError);
      await expect(rateLimiter.waitForRateLimit()).rejects.toThrow('Daily rate limit exhausted');
    });

    it('should keep each request charged for 24 hours instead of resetting at midnight', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1,
        minRequestInterval: 0 // Remove delay for testing
      });

      const firstRequestAt = Date.now();
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(0);

      vi.setSystemTime(firstRequestAt + 24 * 60 * 60 * 1000 - 1);
      expect(rateLimiter.getRemainingRequests()).toBe(0);
      expect(rateLimiter.getRateLimitStatus().resetTime.getTime()).toBe(firstRequestAt + 24 * 60 * 60 * 1000);
      await expect(rateLimiter.waitForRateLimit()).rejects.toThrow('rolling 24-hour window');

      vi.setSystemTime(firstRequestAt + 24 * 60 * 60 * 1000);
      expect(rateLimiter.getRemainingRequests()).toBe(1);
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return correct status information', () => {
      const rateLimiter = new EtsyRateLimiter();
      const status = rateLimiter.getRateLimitStatus();
      
      expect(status.remainingRequests).toBe(5000);
      expect(status.resetTime).toBeInstanceOf(Date);
      expect(status.canMakeRequest).toBe(true);
    });

    it('should update status after requests', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 0 // Remove delay for testing
      });
      
      await rateLimiter.waitForRateLimit();
      
      const status = rateLimiter.getRateLimitStatus();
      expect(status.remainingRequests).toBe(4999);
      expect(status.canMakeRequest).toBe(true);
    });

    it('should show cannot make request when at limit', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1
      });
      
      await rateLimiter.waitForRateLimit();
      
      const status = rateLimiter.getRateLimitStatus();
      expect(status.remainingRequests).toBe(0);
      expect(status.canMakeRequest).toBe(false);
    });

    it('should show cannot make request when interval not met', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 1000
      });
      
      await rateLimiter.waitForRateLimit();
      
      const status = rateLimiter.getRateLimitStatus();
      expect(status.canMakeRequest).toBe(false);
    });
  });

  describe('getRemainingRequests', () => {
    it('should return initial remaining requests', () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 5000
      });
      
      expect(rateLimiter.getRemainingRequests()).toBe(5000);
    });

    it('should decrease after requests', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 0 // Remove delay for testing
      });
      
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(4999);

      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(4998);
    });

    it('should not go below zero', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1
      });
      
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(0);
    });
  });

  describe('reset', () => {
    it('should reset all counters and timers', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 0 // Remove delay for testing
      });
      
      // Make some requests
      await rateLimiter.waitForRateLimit();
      await rateLimiter.waitForRateLimit();
      
      expect(rateLimiter.getRemainingRequests()).toBe(4998);

      // Reset
      rateLimiter.reset();

      expect(rateLimiter.getRemainingRequests()).toBe(5000);
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    it('should reset daily counter', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1
      });
      
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(0);
      
      rateLimiter.reset();
      expect(rateLimiter.getRemainingRequests()).toBe(1);
    });
  });

  describe('canMakeRequest', () => {
    it('should return true when under limits', () => {
      const rateLimiter = new EtsyRateLimiter();
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    it('should return false when daily limit exceeded', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1
      });
      
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.canMakeRequest()).toBe(false);
    });

    it('should return false when minimum interval not met', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 1000
      });
      
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.canMakeRequest()).toBe(false);
      
      // Fast-forward time
      vi.advanceTimersByTime(1000);
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });
  });

  describe('getTimeUntilNextRequest', () => {
    it('should return 0 when request can be made immediately', () => {
      const rateLimiter = new EtsyRateLimiter();
      expect(rateLimiter.getTimeUntilNextRequest()).toBe(0);
    });

    it('should return remaining time when minimum interval not met', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 1000
      });
      
      await rateLimiter.waitForRateLimit();
      
      const timeUntilNext = rateLimiter.getTimeUntilNextRequest();
      expect(timeUntilNext).toBeGreaterThan(0);
      expect(timeUntilNext).toBeLessThanOrEqual(1000);
      
      // Fast-forward time
      vi.advanceTimersByTime(500);
      const timeUntilNext2 = rateLimiter.getTimeUntilNextRequest();
      expect(timeUntilNext2).toBeLessThan(timeUntilNext);
    });

    it('should return 0 when minimum interval has passed', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 500
      });
      
      await rateLimiter.waitForRateLimit();
      
      // Fast-forward time beyond minimum interval
      vi.advanceTimersByTime(500);
      
      expect(rateLimiter.getTimeUntilNextRequest()).toBe(0);
    });
  });

  describe('getConfig', () => {
    it('should return a copy of the configuration', () => {
      const customConfig = {
        maxRequestsPerDay: 5000,
        maxRequestsPerSecond: 5,
        minRequestInterval: 200
      };

      const rateLimiter = new EtsyRateLimiter(customConfig);
      const config1 = rateLimiter.getConfig();
      const config2 = rateLimiter.getConfig();

      // Check custom values are set
      expect(config1.maxRequestsPerDay).toBe(5000);
      expect(config1.maxRequestsPerSecond).toBe(5);
      expect(config1.minRequestInterval).toBe(200);
      expect(config1).not.toBe(config2); // Should be different objects
      expect(config1).toEqual(config2); // But with same values
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple rapid requests correctly', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 100
      });
      
      const promises = Array.from({ length: 5 }, () => rateLimiter.waitForRateLimit());
      await vi.runAllTimersAsync();
      await Promise.all(promises);
      
      // Should have processed all requests
      expect(rateLimiter.getRemainingRequests()).toBe(4995);
    });

    it('should handle error scenarios gracefully', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1
      });
      
      // Make one request to reach limit
      await rateLimiter.waitForRateLimit();
      
      // Try to make another request - should throw
      const error = await rateLimiter.waitForRateLimit().catch(e => e);
      expect(error).toBeInstanceOf(EtsyRateLimitError);
      expect(error.retryAfter).toBeDefined();
      expect(error.retryAfter).toBeGreaterThan(0);
    });

    it('should maintain separate state for different instances', async () => {
      const rateLimiter1 = new EtsyRateLimiter({
        minRequestInterval: 0 // Remove delay for testing
      });
      const rateLimiter2 = new EtsyRateLimiter({
        minRequestInterval: 0 // Remove delay for testing
      });
      
      await rateLimiter1.waitForRateLimit();
      await rateLimiter1.waitForRateLimit();
      
      expect(rateLimiter1.getRemainingRequests()).toBe(4998);
      expect(rateLimiter2.getRemainingRequests()).toBe(5000);
    });
  });

  describe('edge cases', () => {
    it('should handle zero minimum interval', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 0
      });
      
      // Should allow immediate requests
      await rateLimiter.waitForRateLimit();
      await rateLimiter.waitForRateLimit();
      
      expect(rateLimiter.getRemainingRequests()).toBe(4998);
    });

    it('should handle very large daily limits', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1000000,
        minRequestInterval: 0 // Remove delay for testing
      });
      
      await rateLimiter.waitForRateLimit();
      
      expect(rateLimiter.getRemainingRequests()).toBe(999999);
      expect(rateLimiter.canMakeRequest()).toBe(true);
    });

    it('should handle very small daily limits', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 0
      });
      
      await expect(rateLimiter.waitForRateLimit()).rejects.toThrow(EtsyRateLimitError);
    });
  });
  describe('updateFromHeaders', () => {
    it('should parse rate limit headers from Headers object', () => {
      const rateLimiter = new EtsyRateLimiter();
      const headers = new Headers({
        'x-limit-per-second': '150',
        'x-remaining-this-second': '149',
        'x-limit-per-day': '100000',
        'x-remaining-today': '99998'
      });

      rateLimiter.updateFromHeaders(headers);
      const status = rateLimiter.getRateLimitStatus();

      expect(status.isFromHeaders).toBe(true);
      expect(status.limitPerSecond).toBe(150);
      expect(status.remainingThisSecond).toBe(149);
      expect(status.limitPerDay).toBe(100000);
      expect(status.remainingRequests).toBe(99998);
    });

    it('should parse rate limit headers from plain object (case-insensitive)', () => {
      const rateLimiter = new EtsyRateLimiter();
      const headers = {
        'X-Limit-Per-Second': '150',
        'X-Remaining-This-Second': '149',
        'X-Limit-Per-Day': '100000',
        'X-Remaining-Today': '99998'
      };

      rateLimiter.updateFromHeaders(headers);
      const status = rateLimiter.getRateLimitStatus();

      expect(status.isFromHeaders).toBe(true);
      expect(status.limitPerSecond).toBe(150);
    });

    it('should handle missing headers gracefully', () => {
      const rateLimiter = new EtsyRateLimiter();
      const headers = new Headers({});

      rateLimiter.updateFromHeaders(headers);
      const status = rateLimiter.getRateLimitStatus();

      expect(status.isFromHeaders).toBe(false);
      expect(status.remainingRequests).toBe(5000); // Fallback to config
    });

    it('should handle invalid header values', () => {
      const rateLimiter = new EtsyRateLimiter();
      const headers = { 'x-remaining-today': 'not-a-number' };

      rateLimiter.updateFromHeaders(headers);
      const status = rateLimiter.getRateLimitStatus();

      expect(status.isFromHeaders).toBe(false);
    });
  });

  describe('onApproachingLimit callback', () => {
    it('should fire callback when threshold exceeded', () => {
      const mockCallback = vi.fn();
      const rateLimiter = new EtsyRateLimiter({
        qpdWarningThreshold: 80,
        onApproachingLimit: mockCallback
      });

      // Simulate 85% usage (15000 remaining of 100000)
      const headers = {
        'x-limit-per-day': '100000',
        'x-remaining-today': '15000'
      };

      rateLimiter.updateFromHeaders(headers);

      expect(mockCallback).toHaveBeenCalledWith(15000, 100000, 85);
    });

    it('should not fire callback when under threshold', () => {
      const mockCallback = vi.fn();
      const rateLimiter = new EtsyRateLimiter({
        qpdWarningThreshold: 80,
        onApproachingLimit: mockCallback
      });

      // Simulate 50% usage
      const headers = {
        'x-limit-per-day': '100000',
        'x-remaining-today': '50000'
      };

      rateLimiter.updateFromHeaders(headers);

      expect(mockCallback).not.toHaveBeenCalled();
    });

    it('should allow setting callback after construction', () => {
      const rateLimiter = new EtsyRateLimiter({
        qpdWarningThreshold: 80
      });
      const mockCallback = vi.fn();

      rateLimiter.setApproachingLimitCallback(mockCallback);

      const headers = {
        'x-limit-per-day': '100000',
        'x-remaining-today': '10000' // 90% used
      };

      rateLimiter.updateFromHeaders(headers);

      expect(mockCallback).toHaveBeenCalled();
    });
  });

  describe('handleRateLimitResponse', () => {
    it('should return retry info for QPS limit', async () => {
      const rateLimiter = new EtsyRateLimiter({ maxRetries: 3, jitter: 0 });
      const headers = {
        'retry-after': '2',
        'x-remaining-today': '50000'
      };

      const result = await rateLimiter.handleRateLimitResponse(headers);

      expect(result.shouldRetry).toBe(true);
      expect(result.delayMs).toBeGreaterThanOrEqual(1000);
    });

    it('should throw immediately when QPD exhausted', async () => {
      const rateLimiter = new EtsyRateLimiter();
      const headers = {
        'retry-after': '3600',
        'x-remaining-today': '0'
      };

      await expect(rateLimiter.handleRateLimitResponse(headers))
        .rejects.toThrow(EtsyRateLimitError);

      try {
        await rateLimiter.handleRateLimitResponse(headers);
      } catch (e) {
        const error = e as EtsyRateLimitError;
        expect(error.errorType).toBe('qpd_exhausted');
        expect(error.isRetryable()).toBe(false);
      }
    });

    it('should honor Retry-After and require a fresh response before restoring exhausted quota', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });

      await expect(rateLimiter.handleRateLimitResponse({
        'retry-after': '1',
        'x-remaining-today': '0',
      })).rejects.toMatchObject({ errorType: 'qpd_exhausted', _retryAfter: 1 });

      await vi.advanceTimersByTimeAsync(999);
      expect(rateLimiter.getRemainingRequests()).toBe(0);
      await vi.advanceTimersByTimeAsync(1);
      const probeId = await rateLimiter.acquireRequestSlot();
      expect(rateLimiter.getRemainingRequests()).toBe(0);
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '4999' }, probeId);
      expect(rateLimiter.getRemainingRequests()).toBe(4999);
    });

    it('should probe a shared exhausted quota before the local 24-hour window expires', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1,
        minRequestInterval: 0,
      });
      const firstRequestAt = Date.now();

      const firstReservation = await rateLimiter.acquireRequestSlot();
      rateLimiter.updateFromHeaders({
        'x-limit-per-day': '1',
        'x-remaining-today': '0',
      }, firstReservation);

      expect(rateLimiter.getRateLimitStatus().resetTime.getTime())
        .toBe(firstRequestAt + 60_000);

      let nextRequestStarted = false;
      const nextRequest = rateLimiter.acquireRequestSlot().then((reservationId) => {
        nextRequestStarted = true;
        return reservationId;
      });
      await vi.advanceTimersByTimeAsync(60_000 - 1);
      expect(nextRequestStarted).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      const probeId = await nextRequest;
      expect(nextRequestStarted).toBe(true);
      expect(rateLimiter.getRemainingRequests()).toBe(0);
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '1' }, probeId);
      expect(rateLimiter.getRemainingRequests()).toBe(1);
    });

    it('should let only one guarded recovery probe run at a time', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '0' });
      await vi.advanceTimersByTimeAsync(60_000);

      const probeId = await rateLimiter.acquireRequestSlot();
      let secondProbeStarted = false;
      const secondRequest = rateLimiter.acquireRequestSlot().then((id) => {
        secondProbeStarted = true;
        return id;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(secondProbeStarted).toBe(false);

      rateLimiter.updateFromHeaders({ 'x-remaining-today': '2' }, probeId);
      const secondId = await secondRequest;
      expect(secondProbeStarted).toBe(true);
      expect(rateLimiter.getRemainingRequests()).toBe(1);
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '1' }, secondId);
    });

    it('should not let an older response increase a newer remaining-quota observation', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });
      const olderRequestId = await rateLimiter.acquireRequestSlot();
      const newerRequestId = await rateLimiter.acquireRequestSlot();

      rateLimiter.updateFromHeaders({ 'x-remaining-today': '4' }, newerRequestId);
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '5' }, olderRequestId);

      expect(rateLimiter.getRemainingRequests()).toBe(4);
    });

    it('should not reopen positive quota from a delayed response with a higher reservation ID', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });
      const earlierRequestId = await rateLimiter.acquireRequestSlot();
      const laterRequestId = await rateLimiter.acquireRequestSlot();

      // Etsy may process the higher-ID request first (remaining 2), then the
      // earlier request (remaining 1), even if the response order is reversed.
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '1' }, earlierRequestId);
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '2' }, laterRequestId);

      expect(rateLimiter.getRemainingRequests()).toBe(1);
    });

    it('should not reopen exhausted QPD from a later-arriving response with a higher reservation ID', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });
      const earlierRequestId = await rateLimiter.acquireRequestSlot();
      const laterRequestId = await rateLimiter.acquireRequestSlot();

      // Etsy may process the higher-ID request first, then the earlier request.
      // Its response arrives first with zero remaining; the delayed response
      // must not restore a stale positive count based on client dispatch order.
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '0' }, earlierRequestId);
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '1' }, laterRequestId);

      expect(rateLimiter.getRemainingRequests()).toBe(0);
    });

    it('should reopen exhausted QPD after an uncorrelated convenience-API recovery probe', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '0' });
      await vi.advanceTimersByTimeAsync(60_000);

      await rateLimiter.waitForRateLimit();
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '7' });

      expect(rateLimiter.getRemainingRequests()).toBe(7);
    });

    it('should hold the last known QPD slot until the in-flight response reconciles it', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '1' });
      const firstReservation = await rateLimiter.acquireRequestSlot();

      let secondStarted = false;
      const secondRequest = rateLimiter.acquireRequestSlot().then((id) => {
        secondStarted = true;
        return id;
      });
      await vi.advanceTimersByTimeAsync(0);
      expect(secondStarted).toBe(false);
      expect(rateLimiter.getRemainingRequests()).toBe(0);

      rateLimiter.updateFromHeaders({ 'x-remaining-today': '1' }, firstReservation);
      const secondReservation = await secondRequest;
      expect(secondStarted).toBe(true);
      expect(rateLimiter.getRemainingRequests()).toBe(0);

      rateLimiter.releaseRequestSlot(secondReservation);
      expect(rateLimiter.getRemainingRequests()).toBe(0);
      expect(rateLimiter.canMakeRequest()).toBe(true); // A single probe checks whether the lost response was charged.
    });

    it('should isolate retry counts for concurrent logical requests', async () => {
      const rateLimiter = new EtsyRateLimiter({ maxRetries: 1, minRequestInterval: 0, jitter: 0 });

      await expect(rateLimiter.handleRateLimitResponse({}, undefined, 1))
        .resolves.toMatchObject({ shouldRetry: true });
      rateLimiter.resetRetryCount(); // An unrelated successful request must not reset the first request's budget.
      await expect(rateLimiter.handleRateLimitResponse({}, undefined, 2))
        .rejects.toMatchObject({ errorType: 'qps_exhausted' });
    });

    it('should charge a request locally when its response omits QPD headers', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0 });
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '2' });
      const reservationId = await rateLimiter.acquireRequestSlot();

      rateLimiter.updateFromHeaders({}, reservationId);

      expect(rateLimiter.getRemainingRequests()).toBe(1);
    });

    it('should classify a 429 from its current headers, not a cached zero QPD value', async () => {
      const rateLimiter = new EtsyRateLimiter({ minRequestInterval: 0, jitter: 0 });
      rateLimiter.updateFromHeaders({ 'x-remaining-today': '0' });

      await expect(rateLimiter.handleRateLimitResponse({ 'retry-after': '1' }))
        .resolves.toMatchObject({ shouldRetry: true, delayMs: 1000 });
    });

    it('should throw after max retries exceeded', async () => {
      const rateLimiter = new EtsyRateLimiter({ maxRetries: 2 });
      const headers = { 'x-remaining-today': '50000' };

      // First two calls should return retry info
      await rateLimiter.handleRateLimitResponse(headers);
      await rateLimiter.handleRateLimitResponse(headers);

      // Third call should throw
      await expect(rateLimiter.handleRateLimitResponse(headers))
        .rejects.toThrow('Max retries');
    });

    it('should reset retry count on resetRetryCount()', async () => {
      const rateLimiter = new EtsyRateLimiter({ maxRetries: 2 });
      const headers = { 'x-remaining-today': '50000' };

      await rateLimiter.handleRateLimitResponse(headers);
      await rateLimiter.handleRateLimitResponse(headers);

      rateLimiter.resetRetryCount();

      // Should be able to retry again
      const result = await rateLimiter.handleRateLimitResponse(headers);
      expect(result.shouldRetry).toBe(true);
    });
  });

  describe('backoff calculation', () => {
    it('should use exponential backoff', async () => {
      const rateLimiter = new EtsyRateLimiter({
        baseDelayMs: 1000,
        maxRetries: 5,
        jitter: 0 // Disable jitter for predictable testing
      });
      const headers = { 'x-remaining-today': '50000' };

      const result1 = await rateLimiter.handleRateLimitResponse(headers);
      expect(result1.delayMs).toBe(1000); // 1000 * 2^0

      const result2 = await rateLimiter.handleRateLimitResponse(headers);
      expect(result2.delayMs).toBe(2000); // 1000 * 2^1

      const result3 = await rateLimiter.handleRateLimitResponse(headers);
      expect(result3.delayMs).toBe(4000); // 1000 * 2^2
    });

    it('should respect retry-after header as minimum', async () => {
      const rateLimiter = new EtsyRateLimiter({
        baseDelayMs: 1000,
        jitter: 0
      });
      const headers = {
        'retry-after': '10', // 10 seconds = 10000ms
        'x-remaining-today': '50000'
      };

      const result = await rateLimiter.handleRateLimitResponse(headers);
      expect(result.delayMs).toBe(10000); // retry-after takes precedence
    });

    it('should cap at maxDelayMs', async () => {
      const rateLimiter = new EtsyRateLimiter({
        baseDelayMs: 10000,
        maxDelayMs: 15000,
        maxRetries: 5,
        jitter: 0
      });
      const headers = { 'x-remaining-today': '50000' };

      // After several retries, should hit cap
      await rateLimiter.handleRateLimitResponse(headers); // 10000
      const result2 = await rateLimiter.handleRateLimitResponse(headers); // 20000 -> capped to 15000

      expect(result2.delayMs).toBeLessThanOrEqual(15000);
    });
  });

  describe('header-based limits in waitForRateLimit', () => {
    it('should use header-based QPS limit', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 200 // Default 5 QPS
      });

      // Update with higher limit from headers (150 QPS = ~7ms interval)
      rateLimiter.updateFromHeaders({
        'x-limit-per-second': '150',
        'x-remaining-this-second': '149'
      });

      // The effective interval should now be ~7ms instead of 100ms
      await rateLimiter.waitForRateLimit();
      const timeUntilNext = rateLimiter.getTimeUntilNextRequest();

      // Should be much less than 200ms (likely ~7ms)
      expect(timeUntilNext).toBeLessThan(200);
    });

    it('should use header-based remaining today', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 5000,
        minRequestInterval: 0
      });

      // Update with remaining from headers
      rateLimiter.updateFromHeaders({
        'x-limit-per-day': '100000',
        'x-remaining-today': '5'
      });

      const status = rateLimiter.getRateLimitStatus();
      expect(status.remainingRequests).toBe(5);
    });
  });

  describe('EtsyRateLimitError', () => {
    it('should have correct errorType for QPD exhausted', () => {
      const error = new EtsyRateLimitError('Daily limit exceeded', 3600, 'qpd_exhausted');
      expect(error.errorType).toBe('qpd_exhausted');
      expect(error.isRetryable()).toBe(false);
    });

    it('should have correct errorType for QPS exhausted', () => {
      const error = new EtsyRateLimitError('Rate limit exceeded', 2, 'qps_exhausted');
      expect(error.errorType).toBe('qps_exhausted');
      expect(error.isRetryable()).toBe(true);
    });

    it('should default to unknown errorType', () => {
      const error = new EtsyRateLimitError('Rate limit exceeded', 2);
      expect(error.errorType).toBe('unknown');
      expect(error.isRetryable()).toBe(true);
    });

    it('should maintain backward compatibility', () => {
      // Old-style construction still works
      const error = new EtsyRateLimitError('Rate limit exceeded');
      expect(error.message).toBe('Rate limit exceeded');
      expect(error.name).toBe('EtsyRateLimitError');
      expect(error.retryAfter).toBeUndefined();
    });
  });

  describe('new config defaults', () => {
    it('should have new config fields with defaults', () => {
      const rateLimiter = new EtsyRateLimiter();
      const config = rateLimiter.getConfig();

      expect(config.maxRetries).toBe(3);
      expect(config.baseDelayMs).toBe(1000);
      expect(config.maxDelayMs).toBe(30000);
      expect(config.jitter).toBe(0.1);
      expect(config.qpdWarningThreshold).toBe(80);
    });

    it('should allow custom new config values', () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRetries: 5,
        baseDelayMs: 500,
        maxDelayMs: 10000,
        jitter: 0.2,
        qpdWarningThreshold: 90
      });
      const config = rateLimiter.getConfig();

      expect(config.maxRetries).toBe(5);
      expect(config.baseDelayMs).toBe(500);
      expect(config.maxDelayMs).toBe(10000);
      expect(config.jitter).toBe(0.2);
      expect(config.qpdWarningThreshold).toBe(90);
    });
  });

  describe('backward compatibility', () => {
    it('should work with existing config format', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 8000,
        maxRequestsPerSecond: 5,
        minRequestInterval: 200
      });

      const config = rateLimiter.getConfig();
      expect(config.maxRequestsPerDay).toBe(8000);
      expect(config.maxRequestsPerSecond).toBe(5);
      expect(config.minRequestInterval).toBe(200);
    });

    it('should fall back to config when no headers', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 5000,
        minRequestInterval: 0
      });

      // No headers updated
      const status = rateLimiter.getRateLimitStatus();
      expect(status.isFromHeaders).toBe(false);
      expect(status.remainingRequests).toBe(5000);
    });
  });
});

describe('defaultRateLimiter', () => {
  it('should be an instance of EtsyRateLimiter', () => {
    expect(defaultRateLimiter).toBeInstanceOf(EtsyRateLimiter);
  });

  it('should use default configuration', () => {
    const config = defaultRateLimiter.getConfig();
    expect(config.maxRequestsPerDay).toBe(5000);
    expect(config.maxRequestsPerSecond).toBe(5);
    expect(config.minRequestInterval).toBe(200);
  });
});
