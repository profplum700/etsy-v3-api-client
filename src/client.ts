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
  GetListingParams,
  GetListingInventoryParams,
  ListingParams,
  ListingIncludes,
  SearchParams,
  EtsyApiError,
  EtsyAuthError,
  EtsyRateLimitError,
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
  GetShopReceiptParams,
  GetShopReceiptsParams,
  GetShopReceiptTransactionsParams,
  UpdateShopReceiptParams,
  EtsyShippingProfile,
  EtsyShippingProfileDestination,
  EtsyShippingProfileUpgrade,
  CreateShippingProfileParams,
  UpdateShippingProfileParams,
  CreateShippingProfileDestinationParams,
  UpdateShippingProfileDestinationParams,
  GetShippingProfileDestinationsParams,
  CreateReceiptShipmentParams,
  EtsyPaymentAccountLedgerEntry,
  EtsyPayment,
  GetPaymentAccountLedgerEntriesParams,
  EtsyBuyerTaxonomyNode,
  EtsyBuyerTaxonomyProperty,
  EtsyListingProperty,
  EtsyShopProductionPartner,
  ApproachingLimitCallback,
  UpdateListingPropertyParams,
  EtsyReview,
  GetReviewsParams,
  // New types for missing endpoints
  EtsyShopProcessingProfile,
  CreateReadinessStateParams,
  UpdateReadinessStateParams,
  GetReadinessStateParams,
  EtsyShopReturnPolicy,
  CreateReturnPolicyParams,
  UpdateReturnPolicyParams,
  ConsolidateReturnPoliciesParams,
  EtsyShopHolidayPreference,
  UpdateHolidayPreferencesParams,
  EtsyListingFile,
  EtsyListingVideo,
  EtsyListingTranslation,
  CreateListingTranslationParams,
  UpdateListingTranslationParams,
  EtsyListingVariationImage,
  UpdateVariationImagesParams,
  EtsyUserAddress,
  EtsyShippingCarrier,
  FindShopsParams,
  GetListingsByIdsParams,
  FindActiveListingsByShopParams,
  GetFeaturedListingsParams,
  GetListingsByShopReceiptParams,
  GetListingsBySectionParams,
  GetListingsByReturnPolicyParams,
  CreateShippingProfileUpgradeParams,
  UpdateShippingProfileUpgradeParams,
  GetTransactionsByListingParams,
  GetTransactionsByShopParams,
  GetLedgerEntryPaymentsParams,
  EtsyListingProduct,
  EtsyListingOffering,
  TokenScopesParams,
  TokenScopesResponse
} from './types';
import { TokenManager } from './auth/token-manager';
import { EtsyRateLimiter } from './rate-limiting';
import { assertFetchSupport, isNode } from './utils/environment';
import {
  BulkOperationManager,
  BulkOperationConfig,
  BulkOperationSummary,
  BulkUpdateListingOperation,
  BulkImageUploadOperation
} from './bulk-operations';
import {
  ValidationOptions,
  CreateListingSchema,
  UpdateListingSchema,
  UpdateShopSchema,
  validateOrThrow
} from './validation';

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
  private sharedSecret?: string;
  private bulkOperationManager: BulkOperationManager;

  constructor(config: EtsyClientConfig) {
    this.tokenManager = new TokenManager(config);
    this.baseUrl = config.baseUrl || 'https://api.etsy.com/v3/application';
    this.logger = new DefaultLogger();
    this.keystring = config.keystring;
    this.sharedSecret = config.sharedSecret;
    
    // Set up rate limiting
    if (config.rateLimiting?.enabled !== false) {
      this.rateLimiter = new EtsyRateLimiter({
        maxRequestsPerDay: config.rateLimiting?.maxRequestsPerDay || 10000,
        maxRequestsPerSecond: config.rateLimiting?.maxRequestsPerSecond || 10,
        minRequestInterval: config.rateLimiting?.minRequestInterval ?? 100,
        // New retry and callback options
        maxRetries: config.rateLimiting?.maxRetries,
        baseDelayMs: config.rateLimiting?.baseDelayMs,
        maxDelayMs: config.rateLimiting?.maxDelayMs,
        jitter: config.rateLimiting?.jitter,
        qpdWarningThreshold: config.rateLimiting?.qpdWarningThreshold,
        onApproachingLimit: config.rateLimiting?.onApproachingLimit
      });
    } else {
      this.rateLimiter = new EtsyRateLimiter(undefined);
    }

    // Set up caching
    if (config.caching?.enabled !== false) {
      this.cache = config.caching?.storage || new MemoryCache();
      this.cacheTtl = config.caching?.ttl || 3600;
    }

    // Set up bulk operations manager
    this.bulkOperationManager = new BulkOperationManager({
      concurrency: 5,
      stopOnError: false
    });
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

    // Execute request with retry loop for 429 errors
    return this.executeWithRetry<T>(url, { ...requestOptions, headers }, cacheKey, useCache);
  }

  /**
   * Execute request with automatic retry for 429 responses
   */
  private async executeWithRetry<T>(
    url: string,
    options: RequestInit,
    cacheKey: string,
    useCache: boolean
  ): Promise<T> {
    while (true) {
      try {
        const response = await this.fetch(url, options);

        // Handle 429 Rate Limited
        if (response.status === 429) {
          const { shouldRetry, delayMs } = await this.rateLimiter.handleRateLimitResponse(
            response.headers
          );

          if (shouldRetry) {
            this.logger.warn(`Rate limited. Retrying in ${delayMs}ms...`);
            await this.sleep(delayMs);
            continue; // Retry the request
          }
          // If shouldRetry is false, handleRateLimitResponse will have thrown
        }

        // Handle other errors
        if (!response.ok) {
          const errorText = await response.text();
          throw new EtsyApiError(
            `Etsy API error: ${response.status} ${response.statusText}`,
            response.status,
            errorText
          );
        }

        // SUCCESS: Update rate limiter with response headers
        this.rateLimiter.updateFromHeaders(response.headers);
        this.rateLimiter.resetRetryCount();

        // Handle 204 No Content responses (typically from DELETE operations)
        // These responses have no body, so calling response.json() would throw SyntaxError
        if (response.status === 204) {
          return undefined as T;
        }

        // Also check for empty content-length if headers are available
        const contentLength = response.headers?.get?.('content-length');
        if (contentLength === '0') {
          return undefined as T;
        }

        const data = await response.json();

        // Cache successful GET requests
        if (useCache && this.cache && options.method === 'GET') {
          await this.cache.set(cacheKey, JSON.stringify(data), this.cacheTtl);
        }

        return data;
      } catch (error) {
        // Re-throw rate limit errors (they've already been handled)
        if (error instanceof EtsyRateLimitError) {
          throw error;
        }
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
  }

  /**
   * Sleep helper for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private buildFormBody(params: Record<string, unknown> | object): URLSearchParams {
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(params as Record<string, unknown>)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        for (const item of value) {
          if (item === undefined || item === null) continue;
          body.append(key, String(item));
        }
      } else {
        body.append(key, String(value));
      }
    }
    return body;
  }

  /**
   * Get API key in the format required by Etsy.
   * If sharedSecret is provided, returns "keystring:secret" format.
   * Otherwise, returns just the keystring for backwards compatibility.
   */
  private getApiKey(): string {
    if (this.sharedSecret) {
      return `${this.keystring}:${this.sharedSecret}`;
    }
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
    if (params.legacy !== undefined) {
      searchParams.set('legacy', params.legacy.toString());
    }

    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/shops/${targetShopId}/listings?${searchParams.toString()}`
    );

    return response.results;
  }

  /**
   * Get single listing details
   */
  public async getListing(
    listingId: string,
    params?: GetListingParams | ListingIncludes[]
  ): Promise<EtsyListing> {
    const resolvedParams = Array.isArray(params)
      ? { includes: params }
      : params;
    const searchParams = new URLSearchParams();
    if (resolvedParams?.includes) {
      searchParams.set('includes', resolvedParams.includes.join(','));
    }
    if (resolvedParams?.language) {
      searchParams.set('language', resolvedParams.language);
    }
    if (resolvedParams?.legacy !== undefined) {
      searchParams.set('legacy', resolvedParams.legacy.toString());
    }
    if (resolvedParams?.allow_suggested_title !== undefined) {
      searchParams.set(
        'allow_suggested_title',
        resolvedParams.allow_suggested_title.toString()
      );
    }
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    return this.makeRequest<EtsyListing>(`/listings/${listingId}${suffix}`);
  }

  /**
   * Search for active listings
   */
  public async findAllListingsActive(params: SearchParams = {}): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    
    if (params.keywords) searchParams.set('keywords', params.keywords);
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.sort_on) searchParams.set('sort_on', params.sort_on);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params.min_price !== undefined) searchParams.set('min_price', params.min_price.toString());
    if (params.max_price !== undefined) searchParams.set('max_price', params.max_price.toString());
    if (params.taxonomy_id !== undefined) {
      searchParams.set('taxonomy_id', params.taxonomy_id.toString());
    }
    if (params.shop_location) searchParams.set('shop_location', params.shop_location);
    if (params.legacy !== undefined) {
      searchParams.set('legacy', params.legacy.toString());
    }

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
  public async getListingInventory(
    listingId: string,
    params: GetListingInventoryParams = {}
  ): Promise<EtsyListingInventory> {
    const searchParams = new URLSearchParams();
    if (params.show_deleted !== undefined) {
      searchParams.set('show_deleted', params.show_deleted.toString());
    }
    if (params.includes) {
      searchParams.set('includes', params.includes);
    }
    if (params.legacy !== undefined) {
      searchParams.set('legacy', params.legacy.toString());
    }
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    return this.makeRequest<EtsyListingInventory>(
      `/listings/${listingId}/inventory${suffix}`
    );
  }

  // ===========================================================================
  // Review Methods
  // ===========================================================================

  /**
   * Get reviews for a listing
   * Endpoint: GET /v3/application/listings/{listing_id}/reviews
   * Scopes: feedback_r
   */
  public async getReviewsByListing(
    listingId: string,
    params: GetReviewsParams = {}
  ): Promise<EtsyReview[]> {
    const searchParams = new URLSearchParams();

    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.min_created !== undefined) {
      searchParams.set('min_created', params.min_created.toString());
    }
    if (params.max_created !== undefined) {
      searchParams.set('max_created', params.max_created.toString());
    }

    const response = await this.makeRequest<EtsyApiResponse<EtsyReview>>(
      `/listings/${listingId}/reviews?${searchParams.toString()}`
    );

    return response.results;
  }

  /**
   * Get reviews for a shop
   * Endpoint: GET /v3/application/shops/{shop_id}/reviews
   * Scopes: feedback_r
   */
  public async getReviewsByShop(
    shopId: string,
    params: GetReviewsParams = {}
  ): Promise<EtsyReview[]> {
    const searchParams = new URLSearchParams();

    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.min_created !== undefined) {
      searchParams.set('min_created', params.min_created.toString());
    }
    if (params.max_created !== undefined) {
      searchParams.set('max_created', params.max_created.toString());
    }

    const response = await this.makeRequest<EtsyApiResponse<EtsyReview>>(
      `/shops/${shopId}/reviews?${searchParams.toString()}`
    );

    return response.results;
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
    const user = await this.getUser();
    const response = await this.makeRequest<EtsyApiResponse<EtsyShop>>(
      `/users/${user.user_id}/shops`
    );
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
  public async updateShop(shopId: string, params: UpdateShopParams, options?: ValidationOptions): Promise<EtsyShop> {
    // Validate request if enabled
    if (options?.validate) {
      const schema = options.validateSchema || UpdateShopSchema;
      const throwOnError = options.throwOnValidationError !== false;

      if (throwOnError) {
        validateOrThrow(params, schema, 'Invalid shop update parameters');
      } else {
        const result = schema.validate(params);
        if (!result.valid) {
          this.logger.warn('Shop update validation failed', result.errors);
        }
      }
    }

    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShop>(
      `/shops/${shopId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopSection>(
      `/shops/${shopId}/sections`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopSection>(
      `/shops/${shopId}/sections/${sectionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
  public async createDraftListing(
    shopId: string,
    params: CreateDraftListingParams,
    options?: ValidationOptions & { legacy?: boolean }
  ): Promise<EtsyListing> {
    // Validate request if enabled
    if (options?.validate) {
      const schema = options.validateSchema || CreateListingSchema;
      const throwOnError = options.throwOnValidationError !== false;

      if (throwOnError) {
        validateOrThrow(params, schema, 'Invalid listing parameters');
      } else {
        const result = schema.validate(params);
        if (!result.valid) {
          this.logger.warn('Listing validation failed', result.errors);
        }
      }
    }

    const legacy = options?.legacy;
    const query = legacy !== undefined ? `?legacy=${legacy}` : '';
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyListing>(
      `/shops/${shopId}/listings${query}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    params: UpdateListingParams,
    options?: ValidationOptions & { legacy?: boolean }
  ): Promise<EtsyListing> {
    // Validate request if enabled
    if (options?.validate) {
      const schema = options.validateSchema || UpdateListingSchema;
      const throwOnError = options.throwOnValidationError !== false;

      if (throwOnError) {
        validateOrThrow(params, schema, 'Invalid listing update parameters');
      } else {
        const result = schema.validate(params);
        if (!result.valid) {
          this.logger.warn('Listing update validation failed', result.errors);
        }
      }
    }

    const legacy = options?.legacy;
    const query = legacy !== undefined ? `?legacy=${legacy}` : '';
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyListing>(
      `/shops/${shopId}/listings/${listingId}${query}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    params: UpdateListingInventoryParams,
    options?: { legacy?: boolean }
  ): Promise<EtsyListingInventory> {
    const legacy = options?.legacy;
    const query = legacy !== undefined ? `?legacy=${legacy}` : '';
    return this.makeRequest<EtsyListingInventory>(
      `/listings/${listingId}/inventory${query}`,
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
    listingId: string,
    imageId: string
  ): Promise<EtsyListingImage> {
    return this.makeRequest<EtsyListingImage>(
      `/listings/${listingId}/images/${imageId}`
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
  // Bulk Operations (Phase 2)
  // ============================================================================

  /**
   * Bulk update multiple listings
   * Processes updates with concurrency control and progress tracking
   *
   * @param shopId Shop ID
   * @param operations Array of listing update operations
   * @param config Optional bulk operation configuration
   * @returns Summary of bulk operation results
   *
   * @example
   * ```typescript
   * const results = await client.bulkUpdateListings('123', [
   *   { listingId: '456', updates: { title: 'New Title 1' } },
   *   { listingId: '789', updates: { title: 'New Title 2' } }
   * ], {
   *   concurrency: 5,
   *   onProgress: (completed, total) => {
   *     console.log(`${completed}/${total} completed`);
   *   }
   * });
   * ```
   */
  public async bulkUpdateListings(
    shopId: string,
    operations: BulkUpdateListingOperation[],
    config?: BulkOperationConfig
  ): Promise<BulkOperationSummary<EtsyListing>> {
    const manager = config ? new BulkOperationManager(config) : this.bulkOperationManager;

    return manager.executeBulk(
      operations,
      async (operation) => {
        return this.updateListing(
          shopId,
          operation.listingId.toString(),
          operation.updates
        );
      },
      (operation) => operation.listingId
    );
  }

  /**
   * Bulk upload images to a listing
   * Processes uploads with concurrency control and progress tracking
   *
   * @param shopId Shop ID
   * @param listingId Listing ID
   * @param images Array of image upload operations
   * @param config Optional bulk operation configuration
   * @returns Summary of bulk operation results
   *
   * @example
   * ```typescript
   * const results = await client.bulkUploadImages('123', '456', [
   *   { file: image1, rank: 1, altText: 'Front view' },
   *   { file: image2, rank: 2, altText: 'Side view' },
   *   { file: image3, rank: 3, altText: 'Detail' }
   * ]);
   * ```
   */
  public async bulkUploadImages(
    shopId: string,
    listingId: string,
    images: BulkImageUploadOperation[],
    config?: BulkOperationConfig
  ): Promise<BulkOperationSummary<EtsyListingImage>> {
    const manager = config ? new BulkOperationManager(config) : this.bulkOperationManager;

    return manager.executeBulk(
      images,
      async (image) => {
        return this.uploadListingImage(
          shopId,
          listingId,
          image.file as Blob | Buffer,
          {
            rank: image.rank,
            alt_text: image.altText
          }
        );
      }
    );
  }

  /**
   * Set concurrency for bulk operations
   * @param concurrency Number of concurrent operations (1-10)
   */
  public setBulkOperationConcurrency(concurrency: number): void {
    this.bulkOperationManager.setConcurrency(Math.max(1, Math.min(10, concurrency)));
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
    if (params?.was_canceled !== undefined) searchParams.set('was_canceled', params.was_canceled.toString());
    if (params?.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());

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
  public async getShopReceipt(
    shopId: string,
    receiptId: string,
    params: GetShopReceiptParams = {}
  ): Promise<EtsyShopReceipt> {
    const searchParams = new URLSearchParams();
    if (params.legacy !== undefined) {
      searchParams.set('legacy', params.legacy.toString());
    }
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    return this.makeRequest<EtsyShopReceipt>(
      `/shops/${shopId}/receipts/${receiptId}${suffix}`
    );
  }

  /**
   * Update a shop receipt
   * Endpoint: PUT /v3/application/shops/{shop_id}/receipts/{receipt_id}
   * Scopes: transactions_w
   */
  public async updateShopReceipt(
    shopId: string,
    receiptId: string,
    params: UpdateShopReceiptParams,
    options?: { legacy?: boolean }
  ): Promise<EtsyShopReceipt> {
    const legacy = options?.legacy;
    const query = legacy !== undefined ? `?legacy=${legacy}` : '';
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopReceipt>(
      `/shops/${shopId}/receipts/${receiptId}${query}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    receiptId: string,
    params: GetShopReceiptTransactionsParams = {}
  ): Promise<EtsyShopReceiptTransaction[]> {
    const searchParams = new URLSearchParams();
    if (params.legacy !== undefined) {
      searchParams.set('legacy', params.legacy.toString());
    }
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<
      EtsyApiResponse<EtsyShopReceiptTransaction>
    >(`/shops/${shopId}/receipts/${receiptId}/transactions${suffix}`);

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
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShippingProfile>(
      `/shops/${shopId}/shipping-profiles`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShippingProfile>(
      `/shops/${shopId}/shipping-profiles/${profileId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    profileId: string,
    params: GetShippingProfileDestinationsParams = {}
  ): Promise<EtsyShippingProfileDestination[]> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) {
      searchParams.set('limit', params.limit.toString());
    }
    if (params.offset !== undefined) {
      searchParams.set('offset', params.offset.toString());
    }
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyShippingProfileDestination>>(
      `/shops/${shopId}/shipping-profiles/${profileId}/destinations${suffix}`
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
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShippingProfileDestination>(
      `/shops/${shopId}/shipping-profiles/${profileId}/destinations`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShippingProfileDestination>(
      `/shops/${shopId}/shipping-profiles/${profileId}/destinations/${destinationId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
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
    params: CreateReceiptShipmentParams,
    options?: { legacy?: boolean }
  ): Promise<EtsyShopReceiptShipment> {
    const legacy = options?.legacy;
    const query = legacy !== undefined ? `?legacy=${legacy}` : '';
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopReceiptShipment>(
      `/shops/${shopId}/receipts/${receiptId}/tracking${query}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
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
   * Get payments for a shop
   * Endpoint: GET /v3/application/shops/{shop_id}/payments
   * Scopes: transactions_r
   */
  public async getPayments(
    shopId: string,
    paymentIds: number[]
  ): Promise<EtsyPayment[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('payment_ids', paymentIds.join(','));
    const response = await this.makeRequest<EtsyApiResponse<EtsyPayment>>(
      `/shops/${shopId}/payments?${searchParams.toString()}`
    );
    return response.results;
  }

  /**
   * Get a single payment for a shop
   * Endpoint: GET /v3/application/shops/{shop_id}/payments
   * Scopes: transactions_r
   */
  public async getShopPayment(
    shopId: string,
    paymentId: string
  ): Promise<EtsyPayment> {
    const payments = await this.getPayments(shopId, [Number(paymentId)]);
    if (payments.length === 0) {
      throw new EtsyApiError('Payment not found', 404);
    }
    return payments[0]!;
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

  /**
   * Update a listing property
   * Endpoint: PUT /v3/application/shops/{shop_id}/listings/{listing_id}/properties/{property_id}
   * Scopes: listings_w
   */
  public async updateListingProperty(
    params: UpdateListingPropertyParams
  ): Promise<EtsyListingProperty> {
    const { shopId, listingId, propertyId, valueIds, values, scaleId } = params;

    // Build form-urlencoded body
    const body = new URLSearchParams();
    body.append('value_ids', valueIds.map(id => id.toString()).join(','));
    body.append('values', values.join(','));
    if (scaleId !== undefined) {
      body.append('scale_id', scaleId.toString());
    }

    const url = `${this.baseUrl}/shops/${shopId}/listings/${listingId}/properties/${propertyId}`;
    await this.rateLimiter.waitForRateLimit();
    const accessToken = await this.tokenManager.getAccessToken();

    const response = await this.fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'x-api-key': this.getApiKey(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: body.toString()
    });

    // Update rate limiter from response headers
    this.rateLimiter.updateFromHeaders(response.headers);
    this.rateLimiter.resetRetryCount();

    if (!response.ok) {
      const errorText = await response.text();
      throw new EtsyApiError(
        `Failed to update listing property: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    return response.json();
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
  // Shop Processing Profiles (Readiness State) Methods
  // ============================================================================

  /**
   * Create a shop readiness state definition (processing profile)
   * Endpoint: POST /v3/application/shops/{shop_id}/readiness-state-definitions
   * Scopes: shops_w
   */
  public async createShopReadinessStateDefinition(
    shopId: string,
    params: CreateReadinessStateParams
  ): Promise<EtsyShopProcessingProfile> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopProcessingProfile>(
      `/shops/${shopId}/readiness-state-definitions`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  /**
   * Get all shop readiness state definitions (processing profiles)
   * Endpoint: GET /v3/application/shops/{shop_id}/readiness-state-definitions
   * Scopes: shops_r
   */
  public async getShopReadinessStateDefinitions(
    shopId: string,
    params: GetReadinessStateParams = {}
  ): Promise<EtsyShopProcessingProfile[]> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopProcessingProfile>>(
      `/shops/${shopId}/readiness-state-definitions${suffix}`
    );
    return response.results;
  }

  /**
   * Get a specific shop readiness state definition
   * Endpoint: GET /v3/application/shops/{shop_id}/readiness-state-definitions/{id}
   * Scopes: shops_r
   */
  public async getShopReadinessStateDefinition(
    shopId: string,
    definitionId: string
  ): Promise<EtsyShopProcessingProfile> {
    return this.makeRequest<EtsyShopProcessingProfile>(
      `/shops/${shopId}/readiness-state-definitions/${definitionId}`
    );
  }

  /**
   * Update a shop readiness state definition
   * Endpoint: PUT /v3/application/shops/{shop_id}/readiness-state-definitions/{id}
   * Scopes: shops_w
   */
  public async updateShopReadinessStateDefinition(
    shopId: string,
    definitionId: string,
    params: UpdateReadinessStateParams
  ): Promise<EtsyShopProcessingProfile> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopProcessingProfile>(
      `/shops/${shopId}/readiness-state-definitions/${definitionId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  /**
   * Delete a shop readiness state definition
   * Endpoint: DELETE /v3/application/shops/{shop_id}/readiness-state-definitions/{id}
   * Scopes: shops_w
   */
  public async deleteShopReadinessStateDefinition(
    shopId: string,
    definitionId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/readiness-state-definitions/${definitionId}`,
      { method: 'DELETE' },
      false
    );
  }

  // ============================================================================
  // Shop Return Policy Methods
  // ============================================================================

  /**
   * Create a shop return policy
   * Endpoint: POST /v3/application/shops/{shop_id}/policies/return
   * Scopes: shops_w
   */
  public async createShopReturnPolicy(
    shopId: string,
    params: CreateReturnPolicyParams
  ): Promise<EtsyShopReturnPolicy> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopReturnPolicy>(
      `/shops/${shopId}/policies/return`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  /**
   * Get all shop return policies
   * Endpoint: GET /v3/application/shops/{shop_id}/policies/return
   * Scopes: shops_r
   */
  public async getShopReturnPolicies(shopId: string): Promise<EtsyShopReturnPolicy[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopReturnPolicy>>(
      `/shops/${shopId}/policies/return`
    );
    return response.results;
  }

  /**
   * Get a specific shop return policy
   * Endpoint: GET /v3/application/shops/{shop_id}/policies/return/{id}
   * Scopes: shops_r
   */
  public async getShopReturnPolicy(
    shopId: string,
    returnPolicyId: string
  ): Promise<EtsyShopReturnPolicy> {
    return this.makeRequest<EtsyShopReturnPolicy>(
      `/shops/${shopId}/policies/return/${returnPolicyId}`
    );
  }

  /**
   * Update a shop return policy
   * Endpoint: PUT /v3/application/shops/{shop_id}/policies/return/{id}
   * Scopes: shops_w
   */
  public async updateShopReturnPolicy(
    shopId: string,
    returnPolicyId: string,
    params: UpdateReturnPolicyParams
  ): Promise<EtsyShopReturnPolicy> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopReturnPolicy>(
      `/shops/${shopId}/policies/return/${returnPolicyId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  /**
   * Delete a shop return policy
   * Endpoint: DELETE /v3/application/shops/{shop_id}/policies/return/{id}
   * Scopes: shops_w
   */
  public async deleteShopReturnPolicy(
    shopId: string,
    returnPolicyId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/policies/return/${returnPolicyId}`,
      { method: 'DELETE' },
      false
    );
  }

  /**
   * Consolidate shop return policies
   * Endpoint: POST /v3/application/shops/{shop_id}/policies/return/consolidate
   * Scopes: shops_w
   */
  public async consolidateShopReturnPolicies(
    shopId: string,
    params: ConsolidateReturnPoliciesParams
  ): Promise<EtsyShopReturnPolicy> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopReturnPolicy>(
      `/shops/${shopId}/policies/return/consolidate`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  // ============================================================================
  // Shop Holiday Preferences Methods
  // ============================================================================

  /**
   * Get shop holiday preferences
   * Endpoint: GET /v3/application/shops/{shop_id}/holiday-preferences
   * Scopes: shops_r
   */
  public async getHolidayPreferences(shopId: string): Promise<EtsyShopHolidayPreference[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopHolidayPreference>>(
      `/shops/${shopId}/holiday-preferences`
    );
    return response.results;
  }

  /**
   * Update a shop holiday preference
   * Endpoint: PUT /v3/application/shops/{shop_id}/holiday-preferences/{holiday_id}
   * Scopes: shops_w
   */
  public async updateHolidayPreferences(
    shopId: string,
    holidayId: string,
    params: UpdateHolidayPreferencesParams
  ): Promise<EtsyShopHolidayPreference> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShopHolidayPreference>(
      `/shops/${shopId}/holiday-preferences/${holidayId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  // ============================================================================
  // Listing File Methods
  // ============================================================================

  /**
   * Upload a listing file
   * Endpoint: POST /v3/application/shops/{shop_id}/listings/{listing_id}/files
   * Scopes: listings_w
   */
  public async uploadListingFile(
    shopId: string,
    listingId: string,
    fileData: Blob | Buffer,
    params?: { name?: string; rank?: number; listing_file_id?: number }
  ): Promise<EtsyListingFile> {
    const formData = new FormData();
    formData.append('file', fileData as Blob);
    if (params?.name) formData.append('name', params.name);
    if (params?.rank !== undefined) formData.append('rank', params.rank.toString());
    if (params?.listing_file_id !== undefined) formData.append('listing_file_id', params.listing_file_id.toString());

    const url = `${this.baseUrl}/shops/${shopId}/listings/${listingId}/files`;
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
        `Failed to upload file: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    return response.json();
  }

  /**
   * Get all listing files
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/{listing_id}/files
   * Scopes: listings_r
   */
  public async getAllListingFiles(
    shopId: string,
    listingId: string
  ): Promise<EtsyListingFile[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyListingFile>>(
      `/shops/${shopId}/listings/${listingId}/files`
    );
    return response.results;
  }

  /**
   * Get a specific listing file
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/{listing_id}/files/{file_id}
   * Scopes: listings_r
   */
  public async getListingFile(
    shopId: string,
    listingId: string,
    fileId: string
  ): Promise<EtsyListingFile> {
    return this.makeRequest<EtsyListingFile>(
      `/shops/${shopId}/listings/${listingId}/files/${fileId}`
    );
  }

  /**
   * Delete a listing file
   * Endpoint: DELETE /v3/application/shops/{shop_id}/listings/{listing_id}/files/{file_id}
   * Scopes: listings_d
   */
  public async deleteListingFile(
    shopId: string,
    listingId: string,
    fileId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/listings/${listingId}/files/${fileId}`,
      { method: 'DELETE' },
      false
    );
  }

  // ============================================================================
  // Listing Video Methods
  // ============================================================================

  /**
   * Upload a listing video
   * Endpoint: POST /v3/application/shops/{shop_id}/listings/{listing_id}/videos
   * Scopes: listings_w
   */
  public async uploadListingVideo(
    shopId: string,
    listingId: string,
    videoData: Blob | Buffer,
    params?: { name?: string; video_id?: number }
  ): Promise<EtsyListingVideo> {
    const formData = new FormData();
    formData.append('video', videoData as Blob);
    if (params?.name) formData.append('name', params.name);
    if (params?.video_id !== undefined) formData.append('video_id', params.video_id.toString());

    const url = `${this.baseUrl}/shops/${shopId}/listings/${listingId}/videos`;
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
        `Failed to upload video: ${response.status} ${response.statusText}`,
        response.status,
        errorText
      );
    }

    return response.json();
  }

  /**
   * Get listing videos
   * Endpoint: GET /v3/application/listings/{listing_id}/videos
   */
  public async getListingVideos(listingId: string): Promise<EtsyListingVideo[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyListingVideo>>(
      `/listings/${listingId}/videos`
    );
    return response.results;
  }

  /**
   * Get a specific listing video
   * Endpoint: GET /v3/application/listings/{listing_id}/videos/{video_id}
   */
  public async getListingVideo(
    listingId: string,
    videoId: string
  ): Promise<EtsyListingVideo> {
    return this.makeRequest<EtsyListingVideo>(
      `/listings/${listingId}/videos/${videoId}`
    );
  }

  /**
   * Delete a listing video
   * Endpoint: DELETE /v3/application/shops/{shop_id}/listings/{listing_id}/videos/{video_id}
   * Scopes: listings_d
   */
  public async deleteListingVideo(
    shopId: string,
    listingId: string,
    videoId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/listings/${listingId}/videos/${videoId}`,
      { method: 'DELETE' },
      false
    );
  }

  // ============================================================================
  // Listing Translation Methods
  // ============================================================================

  /**
   * Create a listing translation
   * Endpoint: POST /v3/application/shops/{shop_id}/listings/{listing_id}/translations/{language}
   * Scopes: listings_w
   */
  public async createListingTranslation(
    shopId: string,
    listingId: string,
    language: string,
    params: CreateListingTranslationParams
  ): Promise<EtsyListingTranslation> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyListingTranslation>(
      `/shops/${shopId}/listings/${listingId}/translations/${language}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  /**
   * Get a listing translation
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/{listing_id}/translations/{language}
   * Scopes: listings_r
   */
  public async getListingTranslation(
    shopId: string,
    listingId: string,
    language: string
  ): Promise<EtsyListingTranslation> {
    return this.makeRequest<EtsyListingTranslation>(
      `/shops/${shopId}/listings/${listingId}/translations/${language}`
    );
  }

  /**
   * Update a listing translation
   * Endpoint: PUT /v3/application/shops/{shop_id}/listings/{listing_id}/translations/{language}
   * Scopes: listings_w
   */
  public async updateListingTranslation(
    shopId: string,
    listingId: string,
    language: string,
    params: UpdateListingTranslationParams
  ): Promise<EtsyListingTranslation> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyListingTranslation>(
      `/shops/${shopId}/listings/${listingId}/translations/${language}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  // ============================================================================
  // Listing Variation Image Methods
  // ============================================================================

  /**
   * Get listing variation images
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/{listing_id}/variation-images
   * Scopes: listings_r
   */
  public async getListingVariationImages(
    shopId: string,
    listingId: string
  ): Promise<EtsyListingVariationImage[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyListingVariationImage>>(
      `/shops/${shopId}/listings/${listingId}/variation-images`
    );
    return response.results;
  }

  /**
   * Update variation images for a listing
   * Endpoint: POST /v3/application/shops/{shop_id}/listings/{listing_id}/variation-images
   * Scopes: listings_w
   */
  public async updateVariationImages(
    shopId: string,
    listingId: string,
    params: UpdateVariationImagesParams
  ): Promise<EtsyListingVariationImage[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyListingVariationImage>>(
      `/shops/${shopId}/listings/${listingId}/variation-images`,
      {
        method: 'POST',
        body: JSON.stringify(params)
      },
      false
    );
    return response.results;
  }

  // ============================================================================
  // Additional Listing Methods
  // ============================================================================

  /**
   * Find all active listings by shop
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/active
   */
  public async findAllActiveListingsByShop(
    shopId: string,
    params: FindActiveListingsByShopParams = {}
  ): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.sort_on) searchParams.set('sort_on', params.sort_on);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params.keywords) searchParams.set('keywords', params.keywords);
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/shops/${shopId}/listings/active${suffix}`
    );
    return response.results;
  }

  /**
   * Get featured listings by shop
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/featured
   */
  public async getFeaturedListingsByShop(
    shopId: string,
    params: GetFeaturedListingsParams = {}
  ): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/shops/${shopId}/listings/featured${suffix}`
    );
    return response.results;
  }

  /**
   * Get listings by listing IDs (batch)
   * Endpoint: GET /v3/application/listings/batch
   */
  public async getListingsByListingIds(
    params: GetListingsByIdsParams
  ): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('listing_ids', params.listing_ids.join(','));
    if (params.includes) searchParams.set('includes', params.includes.join(','));
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/listings/batch?${searchParams.toString()}`
    );
    return response.results;
  }

  /**
   * Get listings by shop receipt
   * Endpoint: GET /v3/application/shops/{shop_id}/receipts/{receipt_id}/listings
   * Scopes: transactions_r
   */
  public async getListingsByShopReceipt(
    shopId: string,
    receiptId: string,
    params: GetListingsByShopReceiptParams = {}
  ): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/shops/${shopId}/receipts/${receiptId}/listings${suffix}`
    );
    return response.results;
  }

  /**
   * Get a single listing property
   * Endpoint: GET /v3/application/listings/{listing_id}/properties/{property_id}
   */
  public async getListingProperty(
    listingId: string,
    propertyId: string
  ): Promise<EtsyListingProperty> {
    return this.makeRequest<EtsyListingProperty>(
      `/listings/${listingId}/properties/${propertyId}`
    );
  }

  /**
   * Delete a listing property
   * Endpoint: DELETE /v3/application/shops/{shop_id}/listings/{listing_id}/properties/{property_id}
   * Scopes: listings_w
   */
  public async deleteListingProperty(
    shopId: string,
    listingId: string,
    propertyId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/listings/${listingId}/properties/${propertyId}`,
      { method: 'DELETE' },
      false
    );
  }

  /**
   * Get a listing product
   * Endpoint: GET /v3/application/listings/{listing_id}/inventory/products/{product_id}
   */
  public async getListingProduct(
    listingId: string,
    productId: string
  ): Promise<EtsyListingProduct> {
    return this.makeRequest<EtsyListingProduct>(
      `/listings/${listingId}/inventory/products/${productId}`
    );
  }

  /**
   * Get a listing offering
   * Endpoint: GET /v3/application/listings/{listing_id}/products/{product_id}/offerings/{offering_id}
   */
  public async getListingOffering(
    listingId: string,
    productId: string,
    offeringId: string
  ): Promise<EtsyListingOffering> {
    return this.makeRequest<EtsyListingOffering>(
      `/listings/${listingId}/products/${productId}/offerings/${offeringId}`
    );
  }

  /**
   * Get listings by shop section ID
   * Endpoint: GET /v3/application/shops/{shop_id}/shop-sections/listings
   */
  public async getListingsByShopSectionId(
    shopId: string,
    params: GetListingsBySectionParams
  ): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('shop_section_ids', params.shop_section_ids.join(','));
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.sort_on) searchParams.set('sort_on', params.sort_on);
    if (params.sort_order) searchParams.set('sort_order', params.sort_order);
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/shops/${shopId}/shop-sections/listings?${searchParams.toString()}`
    );
    return response.results;
  }

  /**
   * Get listings by shop return policy
   * Endpoint: GET /v3/application/shops/{shop_id}/policies/return/{id}/listings
   */
  public async getListingsByShopReturnPolicy(
    shopId: string,
    returnPolicyId: string,
    params: GetListingsByReturnPolicyParams = {}
  ): Promise<EtsyListing[]> {
    const searchParams = new URLSearchParams();
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyListing>>(
      `/shops/${shopId}/policies/return/${returnPolicyId}/listings${suffix}`
    );
    return response.results;
  }

  // ============================================================================
  // Additional Shop Methods
  // ============================================================================

  /**
   * Find shops by name
   * Endpoint: GET /v3/application/shops
   */
  public async findShops(params: FindShopsParams): Promise<EtsyShop[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('shop_name', params.shop_name);
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    const response = await this.makeRequest<EtsyApiResponse<EtsyShop>>(
      `/shops?${searchParams.toString()}`
    );
    return response.results;
  }

  // ============================================================================
  // Additional Shipping Methods
  // ============================================================================

  /**
   * Create a shipping profile upgrade
   * Endpoint: POST /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades
   * Scopes: shops_w
   */
  public async createShopShippingProfileUpgrade(
    shopId: string,
    profileId: string,
    params: CreateShippingProfileUpgradeParams
  ): Promise<EtsyShippingProfileUpgrade> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShippingProfileUpgrade>(
      `/shops/${shopId}/shipping-profiles/${profileId}/upgrades`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  /**
   * Update a shipping profile upgrade
   * Endpoint: PUT /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades/{upgrade_id}
   * Scopes: shops_w
   */
  public async updateShopShippingProfileUpgrade(
    shopId: string,
    profileId: string,
    upgradeId: string,
    params: UpdateShippingProfileUpgradeParams
  ): Promise<EtsyShippingProfileUpgrade> {
    const body = this.buildFormBody(params);
    return this.makeRequest<EtsyShippingProfileUpgrade>(
      `/shops/${shopId}/shipping-profiles/${profileId}/upgrades/${upgradeId}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
  }

  /**
   * Delete a shipping profile upgrade
   * Endpoint: DELETE /v3/application/shops/{shop_id}/shipping-profiles/{shipping_profile_id}/upgrades/{upgrade_id}
   * Scopes: shops_w
   */
  public async deleteShopShippingProfileUpgrade(
    shopId: string,
    profileId: string,
    upgradeId: string
  ): Promise<void> {
    await this.makeRequest<void>(
      `/shops/${shopId}/shipping-profiles/${profileId}/upgrades/${upgradeId}`,
      { method: 'DELETE' },
      false
    );
  }

  /**
   * Get shipping carriers
   * Endpoint: GET /v3/application/shipping-carriers
   */
  public async getShippingCarriers(originCountryIso: string): Promise<EtsyShippingCarrier[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('origin_country_iso', originCountryIso);
    const response = await this.makeRequest<EtsyApiResponse<EtsyShippingCarrier>>(
      `/shipping-carriers?${searchParams.toString()}`
    );
    return response.results;
  }

  // ============================================================================
  // Additional Transaction Methods
  // ============================================================================

  /**
   * Get shop receipt transactions by listing
   * Endpoint: GET /v3/application/shops/{shop_id}/listings/{listing_id}/transactions
   * Scopes: transactions_r
   */
  public async getShopReceiptTransactionsByListing(
    shopId: string,
    listingId: string,
    params: GetTransactionsByListingParams = {}
  ): Promise<EtsyShopReceiptTransaction[]> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopReceiptTransaction>>(
      `/shops/${shopId}/listings/${listingId}/transactions${suffix}`
    );
    return response.results;
  }

  /**
   * Get shop receipt transactions by shop
   * Endpoint: GET /v3/application/shops/{shop_id}/transactions
   * Scopes: transactions_r
   */
  public async getShopReceiptTransactionsByShop(
    shopId: string,
    params: GetTransactionsByShopParams = {}
  ): Promise<EtsyShopReceiptTransaction[]> {
    const searchParams = new URLSearchParams();
    if (params.limit !== undefined) searchParams.set('limit', params.limit.toString());
    if (params.offset !== undefined) searchParams.set('offset', params.offset.toString());
    if (params.legacy !== undefined) searchParams.set('legacy', params.legacy.toString());
    const query = searchParams.toString();
    const suffix = query ? `?${query}` : '';
    const response = await this.makeRequest<EtsyApiResponse<EtsyShopReceiptTransaction>>(
      `/shops/${shopId}/transactions${suffix}`
    );
    return response.results;
  }

  // ============================================================================
  // Additional Payment Methods
  // ============================================================================

  /**
   * Get payment account ledger entry payments
   * Endpoint: GET /v3/application/shops/{shop_id}/payment-account/ledger-entries/payments
   * Scopes: transactions_r
   */
  public async getPaymentAccountLedgerEntryPayments(
    shopId: string,
    params: GetLedgerEntryPaymentsParams
  ): Promise<EtsyPayment[]> {
    const searchParams = new URLSearchParams();
    searchParams.set('ledger_entry_ids', params.ledger_entry_ids.join(','));
    const response = await this.makeRequest<EtsyApiResponse<EtsyPayment>>(
      `/shops/${shopId}/payment-account/ledger-entries/payments?${searchParams.toString()}`
    );
    return response.results;
  }

  /**
   * Get shop payment by receipt ID
   * Endpoint: GET /v3/application/shops/{shop_id}/receipts/{receipt_id}/payments
   * Scopes: transactions_r
   */
  public async getShopPaymentByReceiptId(
    shopId: string,
    receiptId: string
  ): Promise<EtsyPayment[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyPayment>>(
      `/shops/${shopId}/receipts/${receiptId}/payments`
    );
    return response.results;
  }

  // ============================================================================
  // Additional User Methods
  // ============================================================================

  /**
   * Get the authenticated user (alias for getUser using /users/me)
   * Endpoint: GET /v3/application/users/me
   */
  public async getMe(): Promise<EtsyUser> {
    return this.makeRequest<EtsyUser>('/users/me');
  }

  /**
   * Get user addresses
   * Endpoint: GET /v3/application/user/addresses
   */
  public async getUserAddresses(): Promise<EtsyUserAddress[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyUserAddress>>(
      '/user/addresses'
    );
    return response.results;
  }

  /**
   * Get a specific user address
   * Endpoint: GET /v3/application/user/addresses/{user_address_id}
   */
  public async getUserAddress(userAddressId: string): Promise<EtsyUserAddress> {
    return this.makeRequest<EtsyUserAddress>(
      `/user/addresses/${userAddressId}`
    );
  }

  /**
   * Delete a user address
   * Endpoint: DELETE /v3/application/user/addresses/{user_address_id}
   */
  public async deleteUserAddress(userAddressId: string): Promise<void> {
    await this.makeRequest<void>(
      `/user/addresses/${userAddressId}`,
      { method: 'DELETE' },
      false
    );
  }

  // ============================================================================
  // Additional Taxonomy Methods
  // ============================================================================

  /**
   * Get properties by buyer taxonomy ID
   * Endpoint: GET /v3/application/buyer-taxonomy/nodes/{taxonomy_id}/properties
   */
  public async getPropertiesByBuyerTaxonomyId(
    taxonomyId: number
  ): Promise<EtsyBuyerTaxonomyProperty[]> {
    const response = await this.makeRequest<EtsyApiResponse<EtsyBuyerTaxonomyProperty>>(
      `/buyer-taxonomy/nodes/${taxonomyId}/properties`
    );
    return response.results;
  }

  // ============================================================================
  // Other Endpoints
  // ============================================================================

  /**
   * Ping the Etsy API
   * Endpoint: GET /v3/application/openapi-ping
   */
  public async ping(): Promise<number> {
    return this.makeRequest<number>('/openapi-ping', {}, false);
  }

  /**
   * Get token scopes
   * Endpoint: POST /v3/application/scopes
   */
  public async tokenScopes(params: TokenScopesParams): Promise<TokenScopesResponse> {
    const body = this.buildFormBody(params);
    return this.makeRequest<TokenScopesResponse>(
      '/scopes',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString()
      },
      false
    );
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
   * Set callback to be notified when approaching daily rate limit
   * @param callback - Function called when usage exceeds warning threshold
   * @param threshold - Optional percentage threshold (0-100), default 80
   */
  public onApproachingRateLimit(
    callback: ApproachingLimitCallback,
    threshold?: number
  ): void {
    if (threshold !== undefined) {
      this.rateLimiter.setWarningThreshold(threshold);
    }
    this.rateLimiter.setApproachingLimitCallback(callback);
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
