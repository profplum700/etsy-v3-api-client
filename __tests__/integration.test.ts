/**
 * Integration tests for the Etsy API client
 * These tests verify that different components work together correctly
 */

import { EtsyClient } from '../src/client';
import { AuthHelper } from '../src/auth/auth-helper';
import { TokenManager, MemoryTokenStorage } from '../src/auth/token-manager';
import { EtsyRateLimiter } from '../src/rate-limiting';
import { EtsyApiError, EtsyAuthError, EtsyRateLimitError } from '../src/types';

// Mock node-fetch
jest.mock('node-fetch');

describe('Integration Tests', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full OAuth flow from auth helper to client', async () => {
      // Step 1: Create auth helper and get auth URL
      const authHelper = new AuthHelper({
        keystring: 'test-api-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r']
      });

      const authUrl = authHelper.getAuthUrl();
      expect(authUrl).toContain('https://www.etsy.com/oauth/connect');

      // Step 2: Simulate auth callback and token exchange
      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-auth-code', state);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'shops_r listings_r'
        })
      });

      const tokens = await authHelper.getAccessToken();
      expect(tokens.access_token).toBe('test-access-token');

      // Step 3: Create client with obtained tokens
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at
      });

      // Step 4: Use client to make API calls
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          user_id: 123,
          login_name: 'testuser',
          shop_id: 456
        })
      });

      const user = await client.getUser();
      expect(user.user_id).toBe(123);
      expect(user.shop_id).toBe(456);
    });

    it('should handle token refresh during API calls', async () => {
      // Create client with expired token
      const expiredDate = new Date(Date.now() - 1000);
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'expired-token',
        refreshToken: 'test-refresh-token',
        expiresAt: expiredDate
      });

      // Mock token refresh response
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'shops_r listings_r'
        })
      });

      // Mock API call after token refresh
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          user_id: 123,
          login_name: 'testuser'
        })
      });

      const user = await client.getUser();
      
      // Should have refreshed token and made API call
      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(user.user_id).toBe(123);
    });
  });

  describe('Rate Limiting Integration', () => {
    it('should enforce rate limits during API calls', async () => {
      // Setup fresh mock for this test
      const testMockFetch = jest.fn();
      (global as any).fetch = testMockFetch;
      
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        rateLimiting: {
          enabled: true,
          maxRequestsPerSecond: 10,
          maxRequestsPerDay: 10,
          minRequestInterval: 0 // Remove delay for testing
        },
        caching: {
          enabled: false // Disable caching for rate limiting test
        }
      });

      // Mock successful responses
      testMockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ user_id: 123 })
      });

      // Make requests within the daily limit
      await client.getUser();
      await client.getUser();
      await client.getUser();

      // Should have made all requests (under the daily limit of 10)
      expect(testMockFetch).toHaveBeenCalledTimes(3);
      
      // Verify rate limiter is tracking requests
      expect(client.getRemainingRequests()).toBe(7); // 10 - 3 = 7
    });

    it('should throw rate limit error when daily limit exceeded', async () => {
      // Setup fresh mock for this test
      const testMockFetch = jest.fn();
      (global as any).fetch = testMockFetch;
      
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        rateLimiting: {
          enabled: true,
          maxRequestsPerDay: 1,
          minRequestInterval: 0 // Remove delay for testing
        },
        caching: {
          enabled: false // Disable caching for rate limiting test
        }
      });

      testMockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ user_id: 123 })
      });

      // First request should succeed
      await client.getUser();

      // Second request should fail with rate limit error
      await expect(client.getUser()).rejects.toThrow(EtsyRateLimitError);
    });
  });


  describe('Storage Integration', () => {
    it('should persist and load tokens using storage', async () => {
      const storage = new MemoryTokenStorage();
      
      const tokenManager = new TokenManager({
        keystring: 'test-api-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000)
      }, storage);

      // Get initial tokens
      const initialTokens = tokenManager.getCurrentTokens();
      expect(initialTokens?.access_token).toBe('test-token');

      // Mock token refresh
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'shops_r listings_r'
        })
      });

      // Refresh tokens
      const refreshedTokens = await tokenManager.refreshToken();
      expect(refreshedTokens.access_token).toBe('new-access-token');

      // Verify tokens were saved to storage
      const savedTokens = await storage.load();
      expect(savedTokens?.access_token).toBe('new-access-token');
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle API errors gracefully throughout the stack', async () => {
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        rateLimiting: {
          enabled: true,
          minRequestInterval: 0 // Remove delay for testing
        }
      });

      // Mock API error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: jest.fn().mockResolvedValue('User not found')
      });

      await expect(client.getUser()).rejects.toThrow(EtsyApiError);
      await expect(client.getUser()).rejects.toThrow('Etsy API error: 404 Not Found');
    });

    it('should handle auth errors during token refresh', async () => {
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'expired-token',
        refreshToken: 'invalid-refresh-token',
        expiresAt: new Date(Date.now() - 1000) // Expired
      });

      // Mock failed token refresh
      mockFetch.mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: jest.fn().mockResolvedValue('Invalid refresh token')
      });

      await expect(client.getUser()).rejects.toThrow(EtsyAuthError);
    });

    it('should handle network errors consistently', async () => {
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        rateLimiting: {
          enabled: true,
          minRequestInterval: 0 // Remove delay for testing
        }
      });

      // Mock network error
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getUser()).rejects.toThrow(EtsyApiError);
      await expect(client.getUser()).rejects.toThrow('Request failed: Network error');
    });
  });

  describe('Caching Integration', () => {
    it('should cache API responses correctly', async () => {
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        caching: {
          enabled: true,
          ttl: 300 // 5 minutes
        }
      });

      const mockUser = { user_id: 123, login_name: 'testuser' };
      
      // Mock API response
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUser)
      });

      // First call - should hit API
      const user1 = await client.getUser();
      expect(user1).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Second call - should use cache
      const user2 = await client.getUser();
      expect(user2).toEqual(mockUser);
      expect(mockFetch).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should clear cache when requested', async () => {
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expiresAt: new Date(Date.now() + 3600000),
        caching: {
          enabled: true,
          ttl: 300
        },
        rateLimiting: {
          enabled: true,
          minRequestInterval: 0 // Remove delay for testing
        }
      });

      const mockUser = { user_id: 123, login_name: 'testuser' };
      
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockUser)
      });

      // First call
      await client.getUser();
      expect(mockFetch).toHaveBeenCalledTimes(1);

      // Clear cache
      await client.clearCache();

      // Second call - should hit API again
      await client.getUser();
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  describe('End-to-End Workflow', () => {
    it('should complete full workflow from auth to API calls', async () => {
      // Step 1: Authentication
      const authHelper = new AuthHelper({
        keystring: 'test-api-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r']
      });

      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-code', state);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'shops_r listings_r'
        })
      });

      const tokens = await authHelper.getAccessToken();

      // Step 2: Create client
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at,
        rateLimiting: {
          enabled: true,
          minRequestInterval: 0 // Remove delay for testing
        }
      });

      // Step 3: Fetch user and shop
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          user_id: 123,
          shop_id: 456
        })
      });

      const user = await client.getUser();

      // Step 4: Fetch listings
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          results: [{
            listing_id: 789,
            title: 'Vintage Botanical Print',
            price: { amount: 2500, divisor: 100, currency_code: 'USD' },
            url: 'https://etsy.com/listing/789',
            images: [{ url_570xN: 'image1.jpg' }],
            when_made: '1950s',
            tags: ['vintage', 'botanical'],
            materials: ['paper']
          }]
        })
      });

      const listings = await client.getListingsByShop(user.shop_id?.toString());

      // Verify complete workflow
      expect(user.user_id).toBe(123);
      expect(user.shop_id).toBe(456);
      expect(listings).toHaveLength(1);
      expect(listings[0].title).toBe('Vintage Botanical Print');

      // Verify all API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });
});