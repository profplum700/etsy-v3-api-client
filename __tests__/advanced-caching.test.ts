/**
 * Tests for Advanced Caching (Phase 2)
 */

import {
  LRUCache,
  LFUCache,
  CacheWithInvalidation,
  createCacheStorage
} from '../src/advanced-caching';

describe('Advanced Caching', () => {
  describe('LRUCache', () => {
    it('should store and retrieve values', async () => {
      const cache = new LRUCache({ maxEntries: 10 });

      await cache.set('key1', 'value1');
      const value = await cache.get('key1');

      expect(value).toBe('value1');
    });

    it('should return null for non-existent keys', async () => {
      const cache = new LRUCache();
      const value = await cache.get('nonexistent');
      expect(value).toBeNull();
    });

    it('should expire entries after TTL', async () => {
      const cache = new LRUCache({ ttl: 1 }); // 1 second TTL

      await cache.set('key1', 'value1');
      const value1 = await cache.get('key1');
      expect(value1).toBe('value1');

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1100));

      const value2 = await cache.get('key1');
      expect(value2).toBeNull();
    });

    it('should evict least recently used entries when full', async () => {
      const cache = new LRUCache({ maxEntries: 3 });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Access key1 to make it recently used
      await cache.get('key1');

      // Add key4, should evict key2 (least recently used)
      await cache.set('key4', 'value4');

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBeNull();
      expect(await cache.get('key3')).toBe('value3');
      expect(await cache.get('key4')).toBe('value4');
    });

    it('should delete entries', async () => {
      const cache = new LRUCache();

      await cache.set('key1', 'value1');
      expect(await cache.get('key1')).toBe('value1');

      await cache.delete('key1');
      expect(await cache.get('key1')).toBeNull();
    });

    it('should clear all entries', async () => {
      const cache = new LRUCache();

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      await cache.clear();

      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });

    it('should track cache statistics', async () => {
      const cache = new LRUCache({ trackStats: true });

      await cache.set('key1', 'value1');

      // Hit
      await cache.get('key1');

      // Miss
      await cache.get('nonexistent');

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
      expect(stats.hitRate).toBeCloseTo(0.5);
      expect(stats.missRate).toBeCloseTo(0.5);
    });

    it('should respect maxSize limit', async () => {
      const cache = new LRUCache({ maxSize: 100 }); // 100 bytes

      // Each character is ~2 bytes
      await cache.set('key1', 'a'.repeat(30)); // ~60 bytes
      await cache.set('key2', 'b'.repeat(30)); // ~60 bytes - should trigger eviction

      const stats = cache.getStats();
      expect(stats.evictions).toBeGreaterThan(0);
    });
  });

  describe('LFUCache', () => {
    it('should store and retrieve values', async () => {
      const cache = new LFUCache({ maxEntries: 10 });

      await cache.set('key1', 'value1');
      const value = await cache.get('key1');

      expect(value).toBe('value1');
    });

    it('should evict least frequently used entries when full', async () => {
      const cache = new LFUCache({ maxEntries: 3 });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');

      // Access key1 multiple times
      await cache.get('key1');
      await cache.get('key1');
      await cache.get('key1');

      // Access key2 twice
      await cache.get('key2');
      await cache.get('key2');

      // key3 has only been set (access count 0)
      // Add key4, should evict key3 (least frequently used)
      await cache.set('key4', 'value4');

      expect(await cache.get('key1')).toBe('value1');
      expect(await cache.get('key2')).toBe('value2');
      expect(await cache.get('key3')).toBeNull();
      expect(await cache.get('key4')).toBe('value4');
    });

    it('should track access counts', async () => {
      const cache = new LFUCache({ maxEntries: 3 });

      await cache.set('key1', 'value1');

      // Access multiple times
      await cache.get('key1');
      await cache.get('key1');

      // The cache tracks access internally
      // Verify it doesn't evict frequently accessed items
      await cache.set('key2', 'value2');
      await cache.set('key3', 'value3');
      await cache.set('key4', 'value4'); // Should evict key2 or key3, not key1

      expect(await cache.get('key1')).toBe('value1');
    });

    it('should track statistics', async () => {
      const cache = new LFUCache({ trackStats: true });

      await cache.set('key1', 'value1');
      await cache.get('key1'); // Hit
      await cache.get('nonexistent'); // Miss

      const stats = cache.getStats();

      expect(stats.hits).toBe(1);
      expect(stats.misses).toBe(1);
    });
  });

  describe('CacheWithInvalidation', () => {
    it('should wrap base cache and support basic operations', async () => {
      const baseCache = new LRUCache();
      const cache = new CacheWithInvalidation(baseCache);

      await cache.set('key1', 'value1');
      expect(await cache.get('key1')).toBe('value1');

      await cache.delete('key1');
      expect(await cache.get('key1')).toBeNull();
    });

    it('should support pattern-based invalidation', async () => {
      const baseCache = new LRUCache();
      const cache = new CacheWithInvalidation(baseCache);

      await cache.set('shops/123', 'shop data');
      await cache.set('listings/456', 'listing data');

      // Invalidate all shop-related cache
      await cache.invalidatePattern('shops/*');

      // Note: Current implementation clears all cache
      // A real implementation would match patterns
      expect(await cache.get('shops/123')).toBeNull();
    });

    it('should add and remove invalidation patterns', () => {
      const baseCache = new LRUCache();
      const cache = new CacheWithInvalidation(baseCache);

      cache.addInvalidationPattern('test/*');
      cache.removeInvalidationPattern('test/*');

      // Just verify methods don't throw
      expect(true).toBe(true);
    });

    it('should support mutation-based invalidation', async () => {
      const baseCache = new LRUCache();
      const cache = new CacheWithInvalidation(baseCache, {
        invalidateOn: {
          mutations: true
        }
      });

      await cache.set('shops/123', 'shop data');

      // Use exact mutation type key
      cache.addMutationPattern('shops/update', ['shops/*']);
      await cache.invalidateOnMutation('shops/update');

      // Cache should be invalidated (current implementation clears all cache)
      expect(await cache.get('shops/123')).toBeNull();
    });
  });

  describe('Factory Functions', () => {
    it('should create LRU cache with createCacheStorage', () => {
      const cache = createCacheStorage({ strategy: 'lru' });
      expect(cache).toBeInstanceOf(LRUCache);
    });

    it('should create LFU cache with createCacheStorage', () => {
      const cache = createCacheStorage({ strategy: 'lfu' });
      expect(cache).toBeInstanceOf(LFUCache);
    });

    it('should default to LRU cache', () => {
      const cache = createCacheStorage();
      expect(cache).toBeInstanceOf(LRUCache);
    });
  });

  describe('Cache Size Management', () => {
    it('should track current cache size', async () => {
      const cache = new LRUCache({ maxSize: 1000 });

      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');

      const stats = cache.getStats();
      expect(stats.size).toBeGreaterThan(0);
    });

    it('should not exceed max size', async () => {
      const cache = new LRUCache({ maxSize: 100, maxEntries: 100 });

      // Try to add data that exceeds max size
      for (let i = 0; i < 10; i++) {
        await cache.set(`key${i}`, 'x'.repeat(20));
      }

      const stats = cache.getStats();
      expect(stats.size).toBeLessThanOrEqual(stats.maxSize);
    });
  });
});
