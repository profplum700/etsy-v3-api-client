/**
 * Advanced Caching Module
 * Provides LRU, LFU, and TTL caching strategies with cache invalidation
 */

import { CacheStorage } from './types';

// ============================================================================
// Types
// ============================================================================

export type CacheStrategy = 'lru' | 'lfu' | 'ttl' | 'custom';

export interface AdvancedCachingConfig {
  /**
   * Caching strategy to use
   * @default 'lru'
   */
  strategy?: CacheStrategy;

  /**
   * Time-to-live for cache entries in seconds
   * @default 3600 (1 hour)
   */
  ttl?: number;

  /**
   * Maximum cache size in bytes
   * @default 10485760 (10MB)
   */
  maxSize?: number;

  /**
   * Maximum number of entries
   * @default 1000
   */
  maxEntries?: number;

  /**
   * Cache invalidation configuration
   */
  invalidateOn?: {
    /**
     * Auto-invalidate related reads after writes
     * @default true
     */
    mutations?: boolean;

    /**
     * Cache key patterns to invalidate on write
     * @example ['shops/*', 'listings/*']
     */
    patterns?: string[];
  };

  /**
   * Enable statistics tracking
   * @default true
   */
  trackStats?: boolean;
}

export interface CacheEntry {
  key: string;
  value: string;
  expires: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
  created: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  missRate: number;
  size: number;
  entryCount: number;
  evictions: number;
  maxSize: number;
  maxEntries: number;
}

// ============================================================================
// LRU Cache Implementation
// ============================================================================

/**
 * Least Recently Used (LRU) Cache
 * Evicts least recently accessed items when cache is full
 */
export class LRUCache implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxEntries: number;
  private ttl: number;
  private currentSize: number = 0;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private trackStats: boolean;

  constructor(config: AdvancedCachingConfig = {}) {
    this.maxSize = config.maxSize ?? 10485760; // 10MB default
    this.maxEntries = config.maxEntries ?? 1000;
    this.ttl = (config.ttl ?? 3600) * 1000; // Convert to milliseconds
    this.trackStats = config.trackStats ?? true;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Update access time for LRU
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    if (this.trackStats) this.stats.hits++;
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const size = this.estimateSize(value);
    const expiryTime = ttl ? ttl * 1000 : this.ttl;
    const now = Date.now();

    // Remove existing entry if present
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }

    // Evict entries if necessary
    while (
      (this.currentSize + size > this.maxSize || this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      await this.evictLRU();
    }

    // Add new entry
    const entry: CacheEntry = {
      key,
      value,
      expires: now + expiryTime,
      size,
      accessCount: 0,
      lastAccessed: now,
      created: now
    };

    this.cache.set(key, entry);
    this.currentSize += size;
  }

  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.currentSize = 0;
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Evict the least recently used entry
   */
  private async evictLRU(): Promise<void> {
    // The first entry in Map is the least recently used (oldest)
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey);
      if (entry) {
        this.currentSize -= entry.size;
      }
      this.cache.delete(firstKey);
      if (this.trackStats) this.stats.evictions++;
    }
  }

  /**
   * Estimate size of a string in bytes
   */
  private estimateSize(str: string): number {
    return str.length * 2; // Rough estimate: 2 bytes per character
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
      size: this.currentSize,
      entryCount: this.cache.size,
      evictions: this.stats.evictions,
      maxSize: this.maxSize,
      maxEntries: this.maxEntries
    };
  }
}

// ============================================================================
// LFU Cache Implementation
// ============================================================================

/**
 * Least Frequently Used (LFU) Cache
 * Evicts least frequently accessed items when cache is full
 */
export class LFUCache implements CacheStorage {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private maxEntries: number;
  private ttl: number;
  private currentSize: number = 0;
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0
  };
  private trackStats: boolean;

  constructor(config: AdvancedCachingConfig = {}) {
    this.maxSize = config.maxSize ?? 10485760; // 10MB default
    this.maxEntries = config.maxEntries ?? 1000;
    this.ttl = (config.ttl ?? 3600) * 1000; // Convert to milliseconds
    this.trackStats = config.trackStats ?? true;
  }

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);

    if (!entry) {
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      if (this.trackStats) this.stats.misses++;
      return null;
    }

    // Update access count for LFU
    entry.accessCount++;
    entry.lastAccessed = Date.now();

    if (this.trackStats) this.stats.hits++;
    return entry.value;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const size = this.estimateSize(value);
    const expiryTime = ttl ? ttl * 1000 : this.ttl;
    const now = Date.now();

    // Remove existing entry if present
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
      this.cache.delete(key);
    }

    // Evict entries if necessary
    while (
      (this.currentSize + size > this.maxSize || this.cache.size >= this.maxEntries) &&
      this.cache.size > 0
    ) {
      await this.evictLFU();
    }

    // Add new entry
    const entry: CacheEntry = {
      key,
      value,
      expires: now + expiryTime,
      size,
      accessCount: 0,
      lastAccessed: now,
      created: now
    };

    this.cache.set(key, entry);
    this.currentSize += size;
  }

  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
    }
  }

  async clear(): Promise<void> {
    this.cache.clear();
    this.currentSize = 0;
    this.stats = { hits: 0, misses: 0, evictions: 0 };
  }

  /**
   * Evict the least frequently used entry
   */
  private async evictLFU(): Promise<void> {
    let minAccessCount = Infinity;
    let keyToEvict: string | null = null;

    // Find entry with lowest access count
    for (const [key, entry] of this.cache.entries()) {
      if (entry.accessCount < minAccessCount) {
        minAccessCount = entry.accessCount;
        keyToEvict = key;
      }
    }

    if (keyToEvict) {
      const entry = this.cache.get(keyToEvict);
      if (entry) {
        this.currentSize -= entry.size;
      }
      this.cache.delete(keyToEvict);
      if (this.trackStats) this.stats.evictions++;
    }
  }

  /**
   * Estimate size of a string in bytes
   */
  private estimateSize(str: string): number {
    return str.length * 2; // Rough estimate: 2 bytes per character
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      missRate: total > 0 ? this.stats.misses / total : 0,
      size: this.currentSize,
      entryCount: this.cache.size,
      evictions: this.stats.evictions,
      maxSize: this.maxSize,
      maxEntries: this.maxEntries
    };
  }
}

// ============================================================================
// Cache with Invalidation Patterns
// ============================================================================

/**
 * Cache with pattern-based invalidation
 * Supports invalidating cache entries by pattern matching
 */
export class CacheWithInvalidation implements CacheStorage {
  private baseCache: CacheStorage;
  private invalidationPatterns: Set<string>;
  private mutationPatterns: Map<string, string[]>;

  constructor(baseCache: CacheStorage, config: AdvancedCachingConfig = {}) {
    this.baseCache = baseCache;
    this.invalidationPatterns = new Set(config.invalidateOn?.patterns || []);
    this.mutationPatterns = new Map();

    // Set up automatic mutation invalidation patterns
    if (config.invalidateOn?.mutations !== false) {
      // When a shop is updated, invalidate shop cache
      this.mutationPatterns.set('shops/*/update', ['shops/*']);
      // When a listing is updated, invalidate listing cache
      this.mutationPatterns.set('listings/*/update', ['listings/*']);
      // When a receipt is updated, invalidate receipt cache
      this.mutationPatterns.set('receipts/*/update', ['receipts/*']);
    }
  }

  async get(key: string): Promise<string | null> {
    return this.baseCache.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    return this.baseCache.set(key, value, ttl);
  }

  async delete(key: string): Promise<void> {
    return this.baseCache.delete(key);
  }

  async clear(): Promise<void> {
    return this.baseCache.clear();
  }

  /**
   * Invalidate cache entries matching a pattern
   * @param _pattern Glob-style pattern (e.g., 'shops/*', 'listings/123/*')
   */
  async invalidatePattern(_pattern: string): Promise<void> {
    // For simple memory cache, we would need to iterate through keys
    // For production, this would be implemented based on the cache backend
    // For now, we just clear the entire cache
    // A real implementation would track keys and match against patterns
    await this.baseCache.clear();
  }

  /**
   * Invalidate cache based on mutation type
   * @param mutationType Type of mutation (e.g., 'shops/123/update')
   */
  async invalidateOnMutation(mutationType: string): Promise<void> {
    const patterns = this.mutationPatterns.get(mutationType);
    if (patterns) {
      for (const pattern of patterns) {
        await this.invalidatePattern(pattern);
      }
    }
  }

  /**
   * Add an invalidation pattern
   */
  addInvalidationPattern(pattern: string): void {
    this.invalidationPatterns.add(pattern);
  }

  /**
   * Remove an invalidation pattern
   */
  removeInvalidationPattern(pattern: string): void {
    this.invalidationPatterns.delete(pattern);
  }

  /**
   * Add a mutation-to-pattern mapping
   */
  addMutationPattern(mutationType: string, patterns: string[]): void {
    this.mutationPatterns.set(mutationType, patterns);
  }
}

// ============================================================================
// Redis Cache Backend (Interface)
// ============================================================================

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db?: number;
  keyPrefix?: string;
}

/**
 * Redis cache backend
 * This is an interface/stub for Redis integration
 * Actual Redis client would be provided by the user to avoid dependencies
 */
/**
 * Redis client interface type (to avoid any)
 * Users should provide a client that implements this interface
 */
export interface RedisClientLike {
  get(key: string): Promise<string | null>;
  setex(key: string, ttl: number, value: string): Promise<void>;
  del(...keys: string[]): Promise<void>;
  keys(pattern: string): Promise<string[]>;
}

export class RedisCacheStorage implements CacheStorage {
  private config: RedisConfig;
  private client: RedisClientLike;
  private keyPrefix: string;

  constructor(config: RedisConfig, client: RedisClientLike) {
    this.config = config;
    this.keyPrefix = config.keyPrefix || 'etsy:';

    if (!client) {
      throw new Error(
        'Redis client must be provided. Install a Redis client library (e.g., ioredis) and pass the client instance.'
      );
    }

    this.client = client;
  }

  async get(key: string): Promise<string | null> {
    try {
      const value = await this.client.get(this.keyPrefix + key);
      return value;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  async set(key: string, value: string, ttl: number = 3600): Promise<void> {
    try {
      await this.client.setex(this.keyPrefix + key, ttl, value);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.del(this.keyPrefix + key);
    } catch (error) {
      console.error('Redis delete error:', error);
    }
  }

  async clear(): Promise<void> {
    try {
      // Delete all keys with the prefix
      const keys = await this.client.keys(this.keyPrefix + '*');
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
    } catch (error) {
      console.error('Redis clear error:', error);
    }
  }

  /**
   * Get Redis client instance
   */
  getClient(): RedisClientLike {
    return this.client;
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a cache storage instance based on strategy
 */
export function createCacheStorage(config: AdvancedCachingConfig = {}): CacheStorage {
  const strategy = config.strategy || 'lru';

  switch (strategy) {
    case 'lru':
      return new LRUCache(config);
    case 'lfu':
      return new LFUCache(config);
    case 'ttl':
      // TTL strategy uses LRU with strict TTL
      return new LRUCache(config);
    default:
      return new LRUCache(config);
  }
}

/**
 * Create a cache with invalidation patterns
 */
export function createCacheWithInvalidation(
  baseCache: CacheStorage,
  config: AdvancedCachingConfig = {}
): CacheWithInvalidation {
  return new CacheWithInvalidation(baseCache, config);
}

/**
 * Create a Redis cache storage
 */
export function createRedisCacheStorage(config: RedisConfig, client: RedisClientLike): RedisCacheStorage {
  return new RedisCacheStorage(config, client);
}
