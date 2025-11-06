/**
 * Performance Benchmark Tests
 * Measures API response times and throughput
 */

import { EtsyClient } from '../../src/client';
import { MemoryTokenStorage } from '../../src/auth/token-manager';

describe('Performance Benchmarks', () => {
  let client: EtsyClient;
  let mockFetch: jest.Mock;
  const TEST_SHOP_ID = '12345';

  beforeEach(() => {
    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    const storage = new MemoryTokenStorage();
    storage.save({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_at: Date.now() + 3600000
    });

    client = new EtsyClient(
      {
        apiKey: 'test-key',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['listings_r', 'shops_r']
      },
      storage
    );
  });

  describe('API Response Times', () => {
    it('should fetch shop within acceptable time', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          shop_id: TEST_SHOP_ID,
          shop_name: 'Test Shop'
        })
      });

      const start = performance.now();
      await client.getShop(TEST_SHOP_ID);
      const duration = performance.now() - start;

      // Should complete within 100ms (mocked)
      expect(duration).toBeLessThan(100);
    });

    it('should handle concurrent requests efficiently', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          shop_id: TEST_SHOP_ID,
          shop_name: 'Test Shop'
        })
      });

      const start = performance.now();

      // Make 10 concurrent requests
      await Promise.all(
        Array(10)
          .fill(null)
          .map(() => client.getShop(TEST_SHOP_ID))
      );

      const duration = performance.now() - start;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(500);
    });
  });

  describe('Pagination Performance', () => {
    it('should efficiently paginate through large datasets', async () => {
      // Mock paginated responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            count: 250,
            results: Array(100).fill({ listing_id: '123' })
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            count: 250,
            results: Array(100).fill({ listing_id: '123' })
          })
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({
            count: 250,
            results: Array(50).fill({ listing_id: '123' })
          })
        });

      const start = performance.now();

      // Fetch all pages
      let allListings = [];
      let offset = 0;
      const limit = 100;

      while (true) {
        const response = await client.getListingsByShop(TEST_SHOP_ID, {
          limit,
          offset
        });

        allListings.push(...response.results);

        if (response.results.length < limit) break;
        offset += limit;
      }

      const duration = performance.now() - start;

      expect(allListings.length).toBe(250);
      expect(duration).toBeLessThan(1000); // Should paginate quickly
    });
  });

  describe('Caching Performance', () => {
    it('should improve response time with caching', async () => {
      const cachedClient = new EtsyClient(
        {
          apiKey: 'test-key',
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['listings_r'],
          cache: {
            enabled: true,
            ttl: 60000
          }
        },
        new MemoryTokenStorage()
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          shop_id: TEST_SHOP_ID,
          shop_name: 'Test Shop'
        })
      });

      // First call - no cache
      const start1 = performance.now();
      await cachedClient.getShop(TEST_SHOP_ID);
      const duration1 = performance.now() - start1;

      // Second call - from cache
      const start2 = performance.now();
      await cachedClient.getShop(TEST_SHOP_ID);
      const duration2 = performance.now() - start2;

      // Cached call should be faster
      expect(duration2).toBeLessThan(duration1);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Only one actual API call
    });
  });

  describe('Rate Limiting Performance', () => {
    it('should throttle requests to meet rate limits', async () => {
      const rateLimitedClient = new EtsyClient(
        {
          apiKey: 'test-key',
          redirectUri: 'http://localhost:3000/callback',
          scopes: ['listings_r'],
          rateLimit: {
            maxRequests: 5,
            windowMs: 1000
          }
        },
        new MemoryTokenStorage()
      );

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ shop_id: TEST_SHOP_ID })
      });

      const start = performance.now();

      // Make 10 requests (should be throttled to 5/second)
      for (let i = 0; i < 10; i++) {
        await rateLimitedClient.getShop(TEST_SHOP_ID);
      }

      const duration = performance.now() - start;

      // Should take at least 1 second due to rate limiting
      expect(duration).toBeGreaterThan(1000);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory on repeated requests', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ shop_id: TEST_SHOP_ID })
      });

      const initialMemory = process.memoryUsage().heapUsed;

      // Make many requests
      for (let i = 0; i < 100; i++) {
        await client.getShop(TEST_SHOP_ID);
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be minimal (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});

describe('Load Testing', () => {
  it('should handle high concurrency', async () => {
    const mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    const storage = new MemoryTokenStorage();
    storage.save({
      access_token: 'test-token',
      refresh_token: 'test-refresh',
      expires_at: Date.now() + 3600000
    });

    const client = new EtsyClient(
      {
        apiKey: 'test-key',
        redirectUri: 'http://localhost:3000/callback',
        scopes: ['listings_r']
      },
      storage
    );

    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ shop_id: '12345' })
    });

    const concurrency = 50;
    const start = performance.now();

    await Promise.all(
      Array(concurrency)
        .fill(null)
        .map(() => client.getShop('12345'))
    );

    const duration = performance.now() - start;
    const requestsPerSecond = (concurrency / duration) * 1000;

    console.log(`Throughput: ${requestsPerSecond.toFixed(2)} req/s`);

    expect(requestsPerSecond).toBeGreaterThan(50); // At least 50 req/s
  });
});
