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
  EtsySellerTaxonomyNode,
  ListingParams,
  SearchParams,
  EtsyApiError,
  EtsyAuthError,
  EtsyTokens,
  RateLimitStatus,
  LoggerInterface,
  CacheStorage,
  UpdateShopParams,
  CreateShopSectionParams,
  UpdateShopSectionParams,
  CreateDraftListingParams,
  UpdateListingParams,
  UpdateListingInventoryParams,
  EtsyShopReceipt,
  EtsyShopReceiptTransaction,
  EtsyShopReceiptShipment,
  GetShopReceiptsParams,
  UpdateShopReceiptParams,
  EtsyShippingProfile,
  EtsyShippingProfileDestination,
  EtsyShippingProfileUpgrade,
  CreateShippingProfileParams,
  UpdateShippingProfileParams,
  CreateShippingProfileDestinationParams,
  UpdateShippingProfileDestinationParams,
  CreateReceiptShipmentParams,
  EtsyPaymentAccountLedgerEntry,
  EtsyPayment,
  GetPaymentAccountLedgerEntriesParams,
  EtsyBuyerTaxonomyNode,
  EtsyBuyerTaxonomyProperty,
  EtsyListingProperty,
  EtsyShopProductionPartner
} from './types';
import { TokenManager } from './auth/token-manager';
import { EtsyRateLimiter } from './rate-limiting';
import { assertFetchSupport, isNode } from './utils/environment';

/**
 * Default logger implementation
 */
class DefaultLogger implements LoggerInterface {
  debug(message: string, ...args: unknown[]): void {
    // Only log debug in development (check both browser and Node.js)
    const isDevelopment = isNode 
      ? process.env.NODE_ENV === 'development'
      : window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1';
    
    if (isDevelopment) {
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
  // Taxonomy Methods
  // ============================================================================

  /**
   * Get seller taxonomy nodes - returns the full hierarchy tree
   * Endpoint: GET /v3/application/seller-taxonomy/nodes
   */
  public async getSellerTaxonomyNodes(): Promise<EtsySellerTaxonomyNode[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsySellerTaxonomyNode>>(
      '/seller-taxonomy/nodes'
    );
    return response.results;
  }

  /**
   * Get shops for the authenticated user
   * Endpoint: GET /v3/application/users/me/shops
   */
  public async getUserShops(): Promise<EtsyShop[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShop>>('/users/me/shops');
    return response.results || [];
  }

  // ============================================================================
  // Shop Management Methods
  // ============================================================================

  /**
   * Update shop settings
   * Endpoint: PUT /v3/application/shops/{shop_id}
   * Scopes: shops_r, shops_w
   */
  public async updateShop(shopId: string, params: UpdateShopParams): Promise<EtsyShop> {
    return this.makeRequest<EtsyShop>(
      `/shops/${shopId}`,
      {
        method: 'PUT',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Create a new shop section
   * Endpoint: POST /v3/application/shops/{shop_id}/sections
   * Scopes: shops_w
   */
  public async createShopSection(shopId: string, params: CreateShopSectionParams): Promise<EtsyShopSection> {
    return this.makeRequest<EtsyShopSection>(
      `/shops/${shopId}/sections`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Update a shop section
   * Endpoint: PUT /v3/application/shops/{shop_id}/sections/{shop_section_id}
   * Scopes: shops_w
   */
  public async updateShopSection(
    shopId: string,
    sectionId: string,
    params: UpdateShopSectionParams
  ): Promise<EtsyShopSection> {
    return this.makeRequest<EtsyShopSection>(
      `/shops/${shopId}/sections/${sectionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Delete a shop section
   * Endpoint: DELETE /v3/application/shops/{shop_id}/sections/{shop_section_id}
   * Scopes: shops_w
   */
  public async deleteShopSection(shopId: string, sectionId: string): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/sections/${sectionId}`,
      { method: 'DELETE' },
      false
    );
  }

  // ============================================================================
  // Listing Write Operations
  // ============================================================================

  /**
   * Create a draft listing
   * Endpoint: POST /v3/application/shops/{shop_id}/listings
   * Scopes: listings_w
   */
  public async createDraftListing(shopId: string, params: CreateDraftListingParams): Promise<EtsyListing> {
    return this.makeRequest<EtsyListing>(
      `/shops/${shopId}/listings`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Update a listing
   * Endpoint: PATCH /v3/application/shops/{shop_id}/listings/{listing_id}
   * Scopes: listings_w
   */
  public async updateListing(
    shopId: string,
    listingId: string,
    params: UpdateListingParams
  ): Promise<EtsyListing> {
    return this.makeRequest<EtsyListing>(
      `/shops/${shopId}/listings/${listingId}`,
      {
        method: 'PATCH',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Delete a listing
   * Endpoint: DELETE /v3/application/listings/{listing_id}
   * Scopes: listings_d
   */
  public async deleteListing(listingId: string): Promise<void> {
    await this.makeRequest<void>(
      `/listings/${listingId}`,
      { method: 'DELETE' },
      false
    );
  }

  /**
   * Update listing inventory
   * Endpoint: PUT /v3/application/listings/{listing_id}/inventory
   * Scopes: listings_w
   */
  public async updateListingInventory(
    listingId: string,
    params: UpdateListingInventoryParams
  ): Promise<EtsyListingInventory> {
    return this.makeRequest<EtsyListingInventory>(
      `/listings/${listingId}/inventory`,
      {
        method: 'PUT',
        body: JSON.stringify(params)
      },
      false
    );
  }

  // ============================================================================
  // Listing Image Methods
  // ============================================================================

  /**
   * Upload a listing image
   * Endpoint: POST /v3/application/shops/{shop_id}/listings/{listing_id}/images
   * Scopes: listings_w
   */
  public async uploadListingImage(
    shopId: string,
    listingId: string,
    imageData: Blob | Buffer,
    params?: { rank?: number; overwrite?: boolean; is_watermarked?: boolean; alt_text?: string }
  ): Promise<EtsyListingImage> {
    const formData = new FormData();
    // TypeScript FormData types don't include Buffer, but it works at runtime
    formData.append('image', imageData as Blob);

    if (params?.rank !== undefined) formData.append('rank', params.rank.toString());
    if (params?.overwrite !== undefined) formData.append('overwrite', params.overwrite.toString());
    if (params?.is_watermarked !== undefined) formData.append('is_watermarked', params.is_watermarked.toString());
    if (params?.alt_text) formData.append('alt_text', params.alt_text);

    const url = `${this.baseUrl}/shops/${shopId}/listings/${listingId}/images`;
    await this.rateLimiter.waitForRateLimit();
    const accessToken = await this.tokenManager.getAccessToken();

    const response = await this.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': this.getApiKey(),
      },
      body: formData
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new EtsyApiError(
        `Failed to upload image: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    return response.json();
  }

  /**
   * Get a specific listing image
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/{listing_id}/images/{listing_image_id}
   * Scopes: listings_r
   */
  public async getListingImage(
    shopId: string,
    listingId: string,
    imageId: string
  ): Promise<EtsyListingImage> {
    return this.makeRequest<EtsyListingImage>(
      `/shops/${shopId}/listings/${listingId}/images/${imageId}`
    );
  }

  /**
   * Delete a listing image
   * Endpoint: DELETE /v3/application/shops/{shop_id}/listings/{listing_id}/images/{listing_image_id}
   * Scopes: listings_d
   */
  public async deleteListingImage(
    shopId: string,
    listingId: string,
    imageId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/listings/${listingId}/images/${imageId}`,
      { method: 'DELETE' },
      false
    );
  }

  // ============================================================================
  // Shop Receipts/Orders Methods
  // ============================================================================

  /**
   * Get shop receipts
   * Endpoint: GET /v3/application/shops/{shop_id}/receipts
   * Scopes: transactions_r
   */
  public async getShopReceipts(
    shopId: string,
    params?: GetShopReceiptsParams
  ): Promise<EtsyShopReceipt[]> {
    const searchParams = new URLSearchParams();

    if (params?.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params?.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params?.sort_on) searchParams.set('sort_on', params.sort_on);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params?.min_created !== undefined) searchParams.set('min_created', params.min_created.toString());
    if (params?.max_created !== undefined) searchParams.set('max_created', params.max_created.toString());
    if (params?.min_last_modified !== undefined) searchParams.set('min_last_modified', params.min_last_modified.toString());
    if (params?.max_last_modified !== undefined) searchParams.set('max_last_modified', params.max_last_modified.toString());
    if (params?.was_paid !== undefined) searchParams.set('was_paid', params.was_paid.toString());
    if (params?.was_shipped !== undefined) searchParams.set('was_shipped', params.was_shipped.toString());
    if (params?.was_delivered !== undefined) searchParams.set('was_delivered', params.was_delivered.toString());

    const response = await this.makeRequest<EtsyApiResponse<EtsyShopReceipt>>(
      `/shops/${shopId}/receipts?${searchParams.toString()}`
    );

    return response.results;
  }

  /**
   * Get a specific shop receipt
   * Endpoint: GET /v3/application/shops/{shop_id}/receipts/{receipt_id}
   * Scopes: transactions_r
   */
  public async getShopReceipt(shopId: string, receiptId: string): Promise<EtsyShopReceipt> {
    return this.makeRequest<EtsyShopReceipt>(`/shops/${shopId}/receipts/${receiptId}`);
  }

  /**
   * Update a shop receipt
   * Endpoint: PUT /v3/application/shops/{shop_id}/receipts/{receipt_id}
   * Scopes: transactions_w
   */
  public async updateShopReceipt(
    shopId: string,
    receiptId: string,
    params: UpdateShopReceiptParams
  ): Promise<EtsyShopReceipt> {
    return this.makeRequest<EtsyShopReceipt>(
      `/shops/${shopId}/receipts/${receiptId}`,
      {
        method: 'PUT',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Get transactions for a shop receipt
   * Endpoint: GET /v3/application/shops/{shop_id}/receipts/{receipt_id}/transactions
   * Scopes: transactions_r
   */
  public async getShopReceiptTransactions(
    shopId: string,
    receiptId: string
  ): Promise<EtsyShopReceiptTransaction[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopReceiptTransaction>>(
      `/shops/${shopId}/receipts/${receiptId}/transactions`
    );

    return response.results;
  }

  /**
   * Get a specific transaction
   * Endpoint: GET /v3/application/shops/{shop_id}/transactions/{transaction_id}
   * Scopes: transactions_r
   */
  public async getShopTransaction(
    shopId: string,
    transactionId: string
  ): Promise<EtsyShopReceiptTransaction> {
    return this.makeRequest<EtsyShopReceiptTransaction>(
      `/shops/${shopId}/transactions/${transactionId}`
    );
  }

  // ============================================================================
  // Shipping Profile Methods
  // ============================================================================

  /**
   * Get all shipping profiles for a shop
   * Endpoint: GET /v3/application/shops/{shop_id}/shipping-profiles
   * Scopes: shops_r
   */
  public async getShopShippingProfiles(shopId: string): Promise<EtsyShippingProfile[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShippingProfile>>(
      `/shops/${shopId}/shipping-profiles`
    );

    return response.results;
  }

  /**
   * Create a shipping profile
   * Endpoint: POST /v3/application/shops/{shop_id}/shipping-profiles
   * Scopes: shops_w
   */
  public async createShopShippingProfile(
    shopId: string,
    params: CreateShippingProfileParams
  ): Promise<EtsyShippingProfile> {
    return this.makeRequest<EtsyShippingProfile>(
      `/shops/${shopId}/shipping-profiles`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Get a specific shipping profile
   * Endpoint: GET /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}
   * Scopes: shops_r
   */
  public async getShopShippingProfile(
    shopId: string,
    profileId: string
  ): Promise<EtsyShippingProfile> {
    return this.makeRequest<EtsyShippingProfile>(
      `/shops/${shopId}/shipping-profiles/${profileId}`
    );
  }

  /**
   * Update a shipping profile
   * Endpoint: PUT /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}
   * Scopes: shops_w
   */
  public async updateShopShippingProfile(
    shopId: string,
    profileId: string,
    params: UpdateShippingProfileParams
  ): Promise<EtsyShippingProfile> {
    return this.makeRequest<EtsyShippingProfile>(
      `/shops/${shopId}/shipping-profiles/${profileId}`,
      {
        method: 'PUT',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Delete a shipping profile
   * Endpoint: DELETE /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}
   * Scopes: shops_w
   */
  public async deleteShopShippingProfile(shopId: string, profileId: string): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/shipping-profiles/${profileId}`,
      { method: 'DELETE' },
      false
    );
  }

  /**
   * Get shipping profile destinations
   * Endpoint: GET /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations
   * Scopes: shops_r
   */
  public async getShopShippingProfileDestinations(
    shopId: string,
    profileId: string
  ): Promise<EtsyShippingProfileDestination[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShippingProfileDestination>>(
      `/shops/${shopId}/shipping-profiles/${profileId}/destinations`
    );

    return response.results;
  }

  /**
   * Create a shipping profile destination
   * Endpoint: POST /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations
   * Scopes: shops_w
   */
  public async createShopShippingProfileDestination(
    shopId: string,
    profileId: string,
    params: CreateShippingProfileDestinationParams
  ): Promise<EtsyShippingProfileDestination> {
    return this.makeRequest<EtsyShippingProfileDestination>(
      `/shops/${shopId}/shipping-profiles/${profileId}/destinations`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Update a shipping profile destination
   * Endpoint: PUT /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations/{shipping_profile_destination_id}
   * Scopes: shops_w
   */
  public async updateShopShippingProfileDestination(
    shopId: string,
    profileId: string,
    destinationId: string,
    params: UpdateShippingProfileDestinationParams
  ): Promise<EtsyShippingProfileDestination> {
    return this.makeRequest<EtsyShippingProfileDestination>(
      `/shops/${shopId}/shipping-profiles/${profileId}/destinations/${destinationId}`,
      {
        method: 'PUT',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Delete a shipping profile destination
   * Endpoint: DELETE /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/destinations/{shipping_profile_destination_id}
   * Scopes: shops_w
   */
  public async deleteShopShippingProfileDestination(
    shopId: string,
    profileId: string,
    destinationId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/shipping-profiles/${profileId}/destinations/${destinationId}`,
      { method: 'DELETE' },
      false
    );
  }

  /**
   * Get shipping profile upgrades
   * Endpoint: GET /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades
   * Scopes: shops_r
   */
  public async getShopShippingProfileUpgrades(
    shopId: string,
    profileId: string
  ): Promise<EtsyShippingProfileUpgrade[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShippingProfileUpgrade>>(
      `/shops/${shopId}/shipping-profiles/${profileId}/upgrades`
    );

    return response.results;
  }

  // ============================================================================
  // Fulfillment/Shipment Methods
  // ============================================================================

  /**
   * Create a receipt shipment (add tracking info)
   * Endpoint: POST /v3/application/shops/{shop_id}/receipts/{receipt_id}/tracking
   * Scopes: transactions_w
   */
  public async createReceiptShipment(
    shopId: string,
    receiptId: string,
    params: CreateReceiptShipmentParams
  ): Promise<EtsyShopReceiptShipment> {
    return this.makeRequest<EtsyShopReceiptShipment>(
      `/shops/${shopId}/receipts/${receiptId}/tracking`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      false
    );
  }

  /**
   * Get shipments for a receipt
   * Endpoint: GET /v3/application/shops/{shop_id}/receipts/{receipt_id}/shipments
   * Scopes: transactions_r
   */
  public async getShopReceiptShipments(
    shopId: string,
    receiptId: string
  ): Promise<EtsyShopReceiptShipment[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopReceiptShipment>>(
      `/shops/${shopId}/receipts/${receiptId}/shipments`
    );

    return response.results;
  }

  // ============================================================================
  // Payment & Ledger Methods
  // ============================================================================

  /**
   * Get payment account ledger entries
   * Endpoint: GET /v3/application/shops/{shop_id}/payment-account/ledger-entries
   * Scopes: transactions_r
   */
  public async getShopPaymentAccountLedgerEntries(
    shopId: string,
    params: GetPaymentAccountLedgerEntriesParams
  ): Promise<EtsyPaymentAccountLedgerEntry[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('min_created', params.min_created.toString());
    searchParams.set('max_created', params.max_created.toString());
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());

    const response = await this.makeRequest<EtsyApiResponse<EtsyPaymentAccountLedgerEntry>>(
      `/shops/${shopId}/payment-account/ledger-entries?${searchParams.toString()}`
    );

    return response.results;
  }

  /**
   * Get payment account ledger entry
   * Endpoint: GET /v3/application/shops/{shop_id}/payment-account/ledger-entries/{ledger_entry_id}
   * Scopes: transactions_r
   */
  public async getShopPaymentAccountLedgerEntry(
    shopId: string,
    entryId: string
  ): Promise<EtsyPaymentAccountLedgerEntry> {
    return this.makeRequest<EtsyPaymentAccountLedgerEntry>(
      `/shops/${shopId}/payment-account/ledger-entries/${entryId}`
    );
  }

  /**
   * Get payment for a shop
   * Endpoint: GET /v3/application/shops/{shop_id}/payment-account/payments/{payment_id}
   * Scopes: transactions_r
   */
  public async getShopPayment(shopId: string, paymentId: string): Promise<EtsyPayment> {
    return this.makeRequest<EtsyPayment>(
      `/shops/${shopId}/payment-account/payments/${paymentId}`
    );
  }

  // ============================================================================
  // Extended Taxonomy Methods
  // ============================================================================

  /**
   * Get buyer taxonomy nodes
   * Endpoint: GET /v3/application/buyer-taxonomy/nodes
   */
  public async getBuyerTaxonomyNodes(): Promise<EtsyBuyerTaxonomyNode[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyBuyerTaxonomyNode>>(
      '/buyer-taxonomy/nodes'
    );
    return response.results;
  }

  /**
   * Get properties for a taxonomy ID
   * Endpoint: GET /v3/application/seller-taxonomy/nodes/{taxonomy_id}/properties
   */
  public async getPropertiesByTaxonomyId(taxonomyId: number): Promise<EtsyBuyerTaxonomyProperty[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyBuyerTaxonomyProperty>>(
      `/seller-taxonomy/nodes/${taxonomyId}/properties`
    );
    return response.results;
  }

  /**
   * Get listing property for a listing
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/{listing_id}/properties
   * Scopes: listings_r
   */
  public async getListingProperties(shopId: string, listingId: string): Promise<EtsyListingProperty[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyListingProperty>>(
      `/shops/${shopId}/listings/${listingId}/properties`
    );
    return response.results;
  }

  // ============================================================================
  // Shop Production Partners
  // ============================================================================

  /**
   * Get shop production partners
   * Endpoint: GET /v3/application/shops/{shop_id}/production-partners
   * Scopes: shops_r
   */
  public async getShopProductionPartners(shopId: string): Promise<EtsyShopProductionPartner[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopProductionPartner>>(
      `/shops/${shopId}/production-partners`
    );
    return response.results;
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
  public getRateLimitStatus(): RateLimitStatus {
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
  public getCurrentTokens(): EtsyTokens | null {
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
  public async refreshToken(): Promise<EtsyTokens> {
    return this.tokenManager.refreshToken();
  }

  /**
   * Fetch implementation that works in both Node.js and browser
   */
  private async fetch(url: string, options: RequestInit): Promise<Response> {
    assertFetchSupport();
    return fetch(url, options);
  }
}