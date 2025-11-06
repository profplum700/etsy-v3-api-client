/**
 * Unit tests for EtsyClient
 */

import { EtsyClient } from '../src/client';
import { EtsyApiError, EtsyClientConfig } from '../src/types';
import { TokenManager } from '../src/auth/token-manager';
import { EtsyRateLimiter } from '../src/rate-limiting';

// Mock dependencies
jest.mock('../src/auth/token-manager');
jest.mock('../src/rate-limiting');


describe('EtsyClient', () => {
  let mockConfig: EtsyClientConfig;
  let mockTokenManager: jest.Mocked<TokenManager>;
  let mockRateLimiter: jest.Mocked<EtsyRateLimiter>;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock configuration
    mockConfig = {
      keystring: 'test-api-key',
      accessToken: 'test-access-token',
      refreshToken: 'test-refresh-token',
      expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
      baseUrl: 'https://api.etsy.com/v3/application'
    };

    // Mock TokenManager
    mockTokenManager = {
      getAccessToken: jest.fn().mockResolvedValue('test-access-token'),
      getCurrentTokens: jest.fn().mockReturnValue({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      }),
      isTokenExpired: jest.fn().mockReturnValue(false),
      refreshToken: jest.fn().mockResolvedValue({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      })
    } as unknown as jest.Mocked<TokenManager>;

    // Mock EtsyRateLimiter
    mockRateLimiter = {
      waitForRateLimit: jest.fn().mockResolvedValue(undefined),
      getRemainingRequests: jest.fn().mockReturnValue(9999),
      getRateLimitStatus: jest.fn().mockReturnValue({
        remainingRequests: 9999,
        resetTime: new Date(Date.now() + 86400000),
        canMakeRequest: true
      }),
      canMakeRequest: jest.fn().mockReturnValue(true)
    } as unknown as jest.Mocked<EtsyRateLimiter>;

    // Mock fetch
    mockFetch = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

    // Setup constructor mocks
    (TokenManager as jest.Mock).mockImplementation(() => mockTokenManager);
    (EtsyRateLimiter as jest.Mock).mockImplementation(() => mockRateLimiter);
  });

  describe('constructor', () => {
    it('should initialize with required configuration', () => {
      const client = new EtsyClient(mockConfig);
      expect(client).toBeInstanceOf(EtsyClient);
      expect(TokenManager).toHaveBeenCalledWith(mockConfig);
    });

    it('should use default base URL if not provided', () => {
      const configWithoutBaseUrl = { ...mockConfig };
      delete configWithoutBaseUrl.baseUrl;
      const client = new EtsyClient(configWithoutBaseUrl);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should initialize rate limiter with default settings', () => {
      new EtsyClient(mockConfig);
      expect(EtsyRateLimiter).toHaveBeenCalledWith({
        maxRequestsPerDay: 10000,
        maxRequestsPerSecond: 10,
        minRequestInterval: 100
      });
    });

    it('should initialize rate limiter with custom settings', () => {
      const configWithRateLimit = {
        ...mockConfig,
        rateLimiting: {
          enabled: true,
          maxRequestsPerDay: 5000,
          maxRequestsPerSecond: 5
        }
      };
      new EtsyClient(configWithRateLimit);
      expect(EtsyRateLimiter).toHaveBeenCalledWith({
        maxRequestsPerDay: 5000,
        maxRequestsPerSecond: 5,
        minRequestInterval: 100
      });
    });

    it('should disable rate limiting when specified', () => {
      const configWithDisabledRateLimit = {
        ...mockConfig,
        rateLimiting: {
          enabled: false
        }
      };
      new EtsyClient(configWithDisabledRateLimit);
      expect(EtsyRateLimiter).toHaveBeenCalledWith(undefined);
    });
  });

  describe('makeRequest', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should make successful API request', async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({ user_id: 123, login_name: 'testuser' })
      };
      mockFetch.mockResolvedValue(mockResponse);

      const result = await client.getUser();

      expect(mockRateLimiter.waitForRateLimit).toHaveBeenCalled();
      expect(mockTokenManager.getAccessToken).toHaveBeenCalled();
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'x-api-key': 'test-api-key',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
      expect(result).toEqual({ user_id: 123, login_name: 'testuser' });
    });

    it('should handle API errors properly', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('{"error": "User not found"}')
      };
      mockFetch.mockResolvedValue(mockResponse);

      await expect(client.getUser()).rejects.toThrow(EtsyApiError);
      await expect(client.getUser()).rejects.toThrow('Etsy API error: 404 Not Found');
    });

    it('should handle fetch errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getUser()).rejects.toThrow(EtsyApiError);
      await expect(client.getUser()).rejects.toThrow('Request failed: Network error');
    });

    
  });

  describe('getUser', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should fetch current user', async () => {
      const mockUser = { user_id: 123, login_name: 'testuser' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUser)
      });

      const result = await client.getUser();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.any(Object)
      );
      expect(result).toEqual(mockUser);
    });
  });

  describe('getShop', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should fetch shop by ID', async () => {
      const mockShop = { shop_id: 456, shop_name: 'Test Shop' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockShop)
      });

      const result = await client.getShop('456');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456',
        expect.any(Object)
      );
      expect(result).toEqual(mockShop);
    });

    it('should fetch current user shop when no ID provided', async () => {
      const mockUser = { user_id: 123, shop_id: 456 };
      const mockShop = { shop_id: 456, shop_name: 'Test Shop' };
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockShop)
        });

      const result = await client.getShop();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456',
        expect.any(Object)
      );
      expect(result).toEqual(mockShop);
    });

    it('should throw error when user has no shop', async () => {
      const mockUser = { user_id: 123 }; // No shop_id
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUser)
      });

      await expect(client.getShop()).rejects.toThrow(EtsyApiError);
      await expect(client.getShop()).rejects.toThrow('User does not have a shop');
    });
  });

  describe('getShopByOwnerUserId', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should fetch shop by user ID', async () => {
      const mockShop = { shop_id: 456, shop_name: 'Test Shop' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockShop)
      });

      const result = await client.getShopByOwnerUserId('123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/123/shops',
        expect.any(Object)
      );
      expect(result).toEqual(mockShop);
    });
  });

  describe('getListingsByShop', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should fetch listings by shop ID', async () => {
      const mockListings = [
        { listing_id: 1, title: 'Test Listing 1' },
        { listing_id: 2, title: 'Test Listing 2' }
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const result = await client.getListingsByShop('456');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456/listings?state=active',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });

    it('should fetch listings with parameters', async () => {
      const mockListings = [{ listing_id: 1, title: 'Test Listing' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const params = {
        state: 'draft' as const,
        limit: 10,
        offset: 0,
        sort_on: 'created' as const,
        sort_order: 'down' as const,
        includes: ['images']
      };

      const result = await client.getListingsByShop('456', params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456/listings?state=draft&limit=10&offset=0&sort_on=created&sort_order=down&includes=images',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });

    it('should use current user shop when no shop ID provided', async () => {
      const mockUser = { user_id: 123, shop_id: 456 };
      const mockListings = [{ listing_id: 1, title: 'Test Listing' }];
      
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue(mockUser)
        })
        .mockResolvedValueOnce({
          ok: true,
          json: jest.fn().mockResolvedValue({ results: mockListings })
        });

      const result = await client.getListingsByShop();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.any(Object)
      );
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/shops/456/listings?state=active',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });
  });

  describe('getListing', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should fetch listing by ID', async () => {
      const mockListing = { listing_id: 123, title: 'Test Listing' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await client.getListing('123');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/123',
        expect.any(Object)
      );
      expect(result).toEqual(mockListing);
    });

    it('should fetch listing with includes', async () => {
      const mockListing = { listing_id: 123, title: 'Test Listing' };
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockListing)
      });

      const result = await client.getListing('123', ['images', 'inventory']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/123?includes=images,inventory',
        expect.any(Object)
      );
      expect(result).toEqual(mockListing);
    });
  });

  describe('findAllListingsActive', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should search active listings', async () => {
      const mockListings = [
        { listing_id: 1, title: 'Test Listing 1' },
        { listing_id: 2, title: 'Test Listing 2' }
      ];
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const result = await client.findAllListingsActive();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/active?',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });

    it('should search with parameters', async () => {
      const mockListings = [{ listing_id: 1, title: 'Test Listing' }];
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: mockListings })
      });

      const params = {
        keywords: 'vintage print',
        category: 'art',
        limit: 20,
        offset: 0,
        sort_on: 'price' as const,
        sort_order: 'up' as const,
        min_price: 10,
        max_price: 100,
        tags: ['vintage', 'print'],
        location: 'US',
        shop_location: 'New York'
      };

      const result = await client.findAllListingsActive(params);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/listings/active?keywords=vintage+print&category=art&limit=20&offset=0&sort_on=price&sort_order=up&min_price=10&max_price=100&tags=vintage%2Cprint&location=US&shop_location=New+York',
        expect.any(Object)
      );
      expect(result).toEqual(mockListings);
    });
  });


  describe('utility methods', () => {
    let client: EtsyClient;

    beforeEach(() => {
      client = new EtsyClient(mockConfig);
    });

    it('should get remaining requests', () => {
      const result = client.getRemainingRequests();
      expect(mockRateLimiter.getRemainingRequests).toHaveBeenCalled();
      expect(result).toBe(9999);
    });

    it('should get rate limit status', () => {
      const result = client.getRateLimitStatus();
      expect(mockRateLimiter.getRateLimitStatus).toHaveBeenCalled();
      expect(result).toEqual({
        remainingRequests: 9999,
        resetTime: expect.any(Date),
        canMakeRequest: true
      });
    });

    it('should get current tokens', () => {
      const result = client.getCurrentTokens();
      expect(mockTokenManager.getCurrentTokens).toHaveBeenCalled();
      expect(result).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: expect.any(Date),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      });
    });

    it('should check if token is expired', () => {
      const result = client.isTokenExpired();
      expect(mockTokenManager.isTokenExpired).toHaveBeenCalled();
      expect(result).toBe(false);
    });

    it('should refresh token', async () => {
      const result = await client.refreshToken();
      expect(mockTokenManager.refreshToken).toHaveBeenCalled();
      expect(result).toEqual({
        access_token: 'new-access-token',
        refresh_token: 'new-refresh-token',
        expires_at: expect.any(Date),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      });
    });
  });

  describe('caching', () => {
    it('should initialize with default cache when caching enabled', () => {
      const configWithCache = {
        ...mockConfig,
        caching: {
          enabled: true,
          ttl: 1800
        }
      };
      const client = new EtsyClient(configWithCache);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should disable caching when specified', () => {
      const configWithoutCache = {
        ...mockConfig,
        caching: {
          enabled: false
        }
      };
      const client = new EtsyClient(configWithoutCache);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should clear cache', async () => {
      const client = new EtsyClient(mockConfig);
      await client.clearCache();
      // Should not throw any errors
    });
  });
});