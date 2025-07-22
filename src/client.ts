/**
 * Etsy API v3 Client
 * Environment-agnostic client with OAuth 2.0 authentication
 */

import { 
  EtsyClientConfig, 
  EtsyApiResponse, 
  EtsyUser, 
  EtsyShop, 
  EtsyShopSection,
  EtsyListing,
  EtsyListingImage,
  EtsyListingInventory,
  ListingParams,
  SearchParams,
  EtsyApiError,
  EtsyAuthError,
  LoggerInterface,
  CacheStorage
} from './types';
import { TokenManager } from './auth/token-manager';
import { EtsyRateLimiter } from './rate-limiting';

/**
 * Default logger implementation
 */
class DefaultLogger implements LoggerInterface {
  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    console.log(`[INFO] ${message}`, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(`[WARN] ${message}`, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    console.error(`[ERROR] ${message}`, ...args);
  }
}

/**
 * Simple in-memory cache implementation
 */
class MemoryCache implements CacheStorage {
  private cache = new Map<string, { value: string; expires: number }>();

  async get(key: string): Promise<string | null> {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set(key: string, value: string, ttl: number = 3600): Promise<void> {
    const expires = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }
}

/**
 * Main Etsy API v3 Client
 */
export class EtsyClient {
  private tokenManager: TokenManager;
  private rateLimiter: EtsyRateLimiter;
  private baseUrl: string;
  private logger: LoggerInterface;
  private cache?: CacheStorage;
  private cacheTtl!: number;
  private keystring: string;

  constructor(config: EtsyClientConfig) {
    this.tokenManager = new TokenManager(config);
    this.baseUrl = config.baseUrl || 'https://api.etsy.com/v3/application';
    this.logger = new DefaultLogger();
    this.keystring = config.keystring;
    
    // Set up rate limiting
    if (config.rateLimiting?.enabled !== false) {
      this.rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: config.rateLimiting?.maxRequestsPerDay || 10000,
        maxRequestsPerSecond: config.rateLimiting?.maxRequestsPerSecond || 10,
        minRequestInterval: config.rateLimiting?.minRequestInterval ?? 100
      });
    } else {
      this.rateLimiter = new EtsyRateLimiter(undefined);
    }

    // Set up caching
    if (config.caching?.enabled !== false) {
      this.cache = config.caching?.storage || new MemoryCache();
      this.cacheTtl = config.caching?.ttl || 3600;
    }
  }

  /**
   * Make an authenticated request to the Etsy API
   */
  private async makeRequest<T>(
    endpoint: string, 
    options: RequestInit = {},
    useCache: boolean = true
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    
    // Set default method to GET if not specified
    const requestOptions: RequestInit = {
      method: 'GET',
      ...options
    };
    
    const cacheKey = `${url}:${JSON.stringify(requestOptions)}`;
    
    // Check cache first
    if (useCache && this.cache && requestOptions.method === 'GET') {
      const cached = await this.cache.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    // Wait for rate limit
    await this.rateLimiter.waitForRateLimit();

    // Get access token
    const accessToken = await this.tokenManager.getAccessToken();

    // Prepare request
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'x-api-key': this.getApiKey(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...requestOptions.headers
    };

    try {
      const response = await this.fetch(url, {
        ...requestOptions,
        headers
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new EtsyApiError(
          `Etsy API error: ${response.status} ${response.statusText}`,
          response.status,
          errorText
        );
      }

      const data = await response.json();
      
      // Cache successful GET requests
      if (useCache && this.cache && requestOptions.method === 'GET') {
        await this.cache.set(cacheKey, JSON.stringify(data), this.cacheTtl);
      }
      
      return data;
    } catch (error) {
      if (error instanceof EtsyApiError || error instanceof EtsyAuthError) {
        throw error;
      }
      throw new EtsyApiError(
        `Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        0,
        error
      );
    }
  }

  /**
   * Get API key
   */
  private getApiKey(): string {
    return this.keystring;
  }

  // ============================================================================
  // User and Shop Methods
  // ============================================================================

  /**
   * Get current user information
   */
  public async getUser(): Promise<EtsyUser> {
    return this.makeRequest<EtsyUser>('/users/me');
  }

  /**
   * Get shop information
   */
  public async getShop(shopId?: string): Promise<EtsyShop> {
    if (shopId) {
      return this.makeRequest<EtsyShop>(`/shops/${shopId}`);
    }
    
    // Get current user's shop
    const user = await this.getUser();
    if (!user.shop_id) {
      throw new EtsyApiError('User does not have a shop', 404);
    }
    
    return this.makeRequest<EtsyShop>(`/shops/${user.shop_id}`);
  }

  /**
   * Get shop by owner user ID
   */
  public async getShopByOwnerUserId(userId: string): Promise<EtsyShop> {
    return this.makeRequest<EtsyShop>(`/users/${userId}/shops`);
  }

  // ============================================================================
  // Shop Section Methods
  // ============================================================================

  /**
   * Get shop sections
   */
  public async getShopSections(shopId?: string): Promise<EtsyShopSection[]> {
    let targetShopId = shopId;
    
    if (!targetShopId) {
      const user = await this.getUser();
      if (!user.shop_id) {
        throw new EtsyApiError('User does not have a shop', 404);
      }
      targetShopId = user.shop_id.toString();
    }

    const response = await this.makeRequest<EtsyApiResponse<EtsyShopSection>>(
      `/shops/${targetShopId}/sections`
    );

    this.logger.info(`Found ${response.results.length} shop sections`);
    return response.results;
  }

  /**
   * Get single shop section
   */
  public async getShopSection(shopId: string, sectionId: string): Promise<EtsyShopSection> {
    return this.makeRequest<EtsyShopSection>(`/shops/${shopId}/sections/${sectionId}`);
  }

  // ============================================================================
  // Listing Methods
  // ============================================================================

  /**
   * Get listings from a shop
   */
  public async getListingsByShop(
    shopId?: string, 
    params: ListingParams = {}
  ): Promise<EtsyListing[]> {
    let targetShopId = shopId;
    
    if (!targetShopId) {
      const user = await this.getUser();
      if (!user.shop_id) {
        throw new EtsyApiError('User does not have a shop', 404);
      }
      targetShopId = user.shop_id.toString();
    }

    const searchParams = new URLSearchParams();
    searchParams.set('state', params.state || 'active');
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.sort_on) searchParams.set('sort_on', params.sort_on);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params.includes) searchParams.set('includes', params.includes.join(','));

    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/shops/${targetShopId}/listings?${searchParams.toString()}`
    );

    return response.results;
  }

  /**
   * Get single listing details
   */
  public async getListing(listingId: string, includes?: string[]): Promise<EtsyListing> {
    const params = includes ? `?includes=${includes.join(',')}` : '';
    return this.makeRequest<EtsyListing>(`/listings/${listingId}${params}`);
  }

  /**
   * Search for active listings
   */
  public async findAllListingsActive(params: SearchParams = {}): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    
    if (params.keywords) searchParams.set('keywords', params.keywords);
    if (params.category) searchParams.set('category', params.category);
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.sort_on) searchParams.set('sort_on', params.sort_on);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params.min_price !== undefined) searchParams.set('min_price', params.min_price.toString());
    if (params.max_price !== undefined) searchParams.set('max_price', params.max_price.toString());
    if (params.tags) searchParams.set('tags', params.tags.join(','));
    if (params.location) searchParams.set('location', params.location);
    if (params.shop_location) searchParams.set('shop_location', params.shop_location);

    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/listings/active?${searchParams.toString()}`
    );

    return response.results;
  }

  /**
   * Get listing images
   */
  public async getListingImages(listingId: string): Promise<EtsyListingImage[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyListingImage>>(
      `/listings/${listingId}/images`
    );

    return response.results;
  }

  /**
   * Get listing inventory
   */
  public async getListingInventory(listingId: string): Promise<EtsyListingInventory> {
    return this.makeRequest<EtsyListingInventory>(`/listings/${listingId}/inventory`);
  }


  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get rate limiting info
   */
  public getRemainingRequests(): number {
    return this.rateLimiter.getRemainingRequests();
  }

  /**
   * Get rate limit status
   */
  public getRateLimitStatus() {
    return this.rateLimiter.getRateLimitStatus();
  }

  /**
   * Clear cache
   */
  public async clearCache(): Promise<void> {
    if (this.cache) {
      await this.cache.clear();
    }
  }

  /**
   * Get current tokens
   */
  public getCurrentTokens() {
    return this.tokenManager.getCurrentTokens();
  }

  /**
   * Check if token is expired
   */
  public isTokenExpired(): boolean {
    return this.tokenManager.isTokenExpired();
  }

  /**
   * Refresh token manually
   */
  public async refreshToken() {
    return this.tokenManager.refreshToken();
  }

  /**
   * Fetch implementation that works in both Node.js and browser
   */
  private async fetch(url: string, options: RequestInit): Promise<Response> {
    if (typeof fetch === 'undefined') {
      throw new EtsyAuthError(
        'Fetch is not available. Please provide a fetch implementation or use Node.js 18+ or a modern browser.',
        'FETCH_NOT_AVAILABLE'
      );
    }
    return fetch(url, options);
  }
}