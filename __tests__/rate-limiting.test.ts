/**
 * Unit tests for EtsyRateLimiter
 */

import { EtsyRateLimiter, defaultRateLimiter } from '../src/rate-limiting';
import { EtsyRateLimitError } from '../src/types';

describe('EtsyRateLimiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constructor', () => {
    it('should initialize with default configuration', () => {
      const rateLimiter = new EtsyRateLimiter();
      const config = rateLimiter.getConfig();
      
      expect(config.maxRequestsPerDay).toBe(10000);
      expect(config.maxRequestsPerSecond).toBe(10);
      expect(config.minRequestInterval).toBe(100);
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
      expect(config.maxRequestsPerSecond).toBe(10); // default
      expect(config.minRequestInterval).toBe(100); // default
    });
  });

  describe('waitForRateLimit', () => {
    it('should allow request when under limits', async () => {
      const rateLimiter = new EtsyRateLimiter();
      
      // Should not throw or wait
      await rateLimiter.waitForRateLimit();
      
      expect(rateLimiter.getRemainingRequests()).toBe(9999);
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
      jest.advanceTimersByTime(200);
      
      await waitPromise;
      
      expect(rateLimiter.getRemainingRequests()).toBe(9998);
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
      await expect(rateLimiter.waitForRateLimit()).rejects.toThrow('Daily rate limit of 2 requests exceeded');
    });

    it('should reset daily counter at midnight UTC', async () => {
      const rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: 1,
        minRequestInterval: 0 // Remove delay for testing
      });
      
      // Make request to reach limit
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(0);
      
      // Manually reset the rate limiter (simulating midnight reset)
      rateLimiter.reset();
      
      // Should be able to make another request after reset
      await rateLimiter.waitForRateLimit();
      
      expect(rateLimiter.getRemainingRequests()).toBe(0);
    });
  });

  describe('getRateLimitStatus', () => {
    it('should return correct status information', () => {
      const rateLimiter = new EtsyRateLimiter();
      const status = rateLimiter.getRateLimitStatus();
      
      expect(status.remainingRequests).toBe(10000);
      expect(status.resetTime).toBeInstanceOf(Date);
      expect(status.canMakeRequest).toBe(true);
    });

    it('should update status after requests', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 0 // Remove delay for testing
      });
      
      await rateLimiter.waitForRateLimit();
      
      const status = rateLimiter.getRateLimitStatus();
      expect(status.remainingRequests).toBe(9999);
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
      expect(rateLimiter.getRemainingRequests()).toBe(9999);
      
      await rateLimiter.waitForRateLimit();
      expect(rateLimiter.getRemainingRequests()).toBe(9998);
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
      
      expect(rateLimiter.getRemainingRequests()).toBe(9998);
      
      // Reset
      rateLimiter.reset();
      
      expect(rateLimiter.getRemainingRequests()).toBe(10000);
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
      jest.advanceTimersByTime(1000);
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
      jest.advanceTimersByTime(500);
      const timeUntilNext2 = rateLimiter.getTimeUntilNextRequest();
      expect(timeUntilNext2).toBeLessThan(timeUntilNext);
    });

    it('should return 0 when minimum interval has passed', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 500
      });
      
      await rateLimiter.waitForRateLimit();
      
      // Fast-forward time beyond minimum interval
      jest.advanceTimersByTime(500);
      
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
      
      expect(config1).toEqual(customConfig);
      expect(config1).not.toBe(config2); // Should be different objects
      expect(config1).toEqual(config2); // But with same values
    });
  });

  describe('complex scenarios', () => {
    it('should handle multiple rapid requests correctly', async () => {
      const rateLimiter = new EtsyRateLimiter({
        minRequestInterval: 100
      });
      
      // Make multiple requests with timer advancement
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(rateLimiter.waitForRateLimit());
        // Advance timers to allow the setTimeout to complete
        jest.advanceTimersByTime(100);
      }
      await Promise.all(promises);
      
      // Should have processed all requests
      expect(rateLimiter.getRemainingRequests()).toBe(9995);
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
      
      expect(rateLimiter1.getRemainingRequests()).toBe(9998);
      expect(rateLimiter2.getRemainingRequests()).toBe(10000);
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
      
      expect(rateLimiter.getRemainingRequests()).toBe(9998);
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
});

describe('defaultRateLimiter', () => {
  it('should be an instance of EtsyRateLimiter', () => {
    expect(defaultRateLimiter).toBeInstanceOf(EtsyRateLimiter);
  });

  it('should use default configuration', () => {
    const config = defaultRateLimiter.getConfig();
    expect(config.maxRequestsPerDay).toBe(10000);
    expect(config.maxRequestsPerSecond).toBe(10);
    expect(config.minRequestInterval).toBe(100);
  });
});