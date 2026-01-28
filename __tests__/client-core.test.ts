/**
 * Core EtsyClient tests - constructor, makeRequest, caching, utility methods
 */

import { type Mock } from 'vitest';
import { EtsyClient } from '../src/client';
import { EtsyApiError } from '../src/types';
import { setupClientMocks, MockClientContext } from './helpers/client-test-setup';

describe('EtsyClient Core', () => {
  let ctx: MockClientContext;

  beforeEach(() => {
    vi.clearAllMocks();
    ctx = setupClientMocks();
  });

  describe('constructor', () => {
    it('should initialize with required configuration', () => {
      const client = new EtsyClient(ctx.mockConfig);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should use default base URL if not provided', () => {
      const configWithoutBaseUrl = { ...ctx.mockConfig };
      delete configWithoutBaseUrl.baseUrl;
      const client = new EtsyClient(configWithoutBaseUrl);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should accept rate limiter configuration', () => {
      const configWithRateLimit = {
        ...ctx.mockConfig,
        rateLimiting: {
          enabled: true,
          maxRequestsPerDay: 5000,
          maxRequestsPerSecond: 5
        }
      };
      const client = new EtsyClient(configWithRateLimit);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should accept disabled rate limiting', () => {
      const configWithDisabledRateLimit = {
        ...ctx.mockConfig,
        rateLimiting: {
          enabled: false
        }
      };
      const client = new EtsyClient(configWithDisabledRateLimit);
      expect(client).toBeInstanceOf(EtsyClient);
    });
  });

  describe('makeRequest', () => {
    it('should make successful API request', async () => {
      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ user_id: 123, login_name: 'testuser' }),
        headers: new Headers()
      };
      ctx.mockFetch.mockResolvedValue(mockResponse);

      const result = await ctx.client.getUser();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
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

    it('should use keystring:secret format when sharedSecret is provided', async () => {
      // Create a fresh context with sharedSecret
      const configWithSecret = {
        ...ctx.mockConfig,
        sharedSecret: 'test-shared-secret'
      };

      // Re-setup mocks for this specific test
      const { TokenManager } = await import('../src/auth/token-manager');
      const { EtsyRateLimiter } = await import('../src/rate-limiting');

      const mockTokenManager = {
        getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
        getCurrentTokens: vi.fn().mockReturnValue({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          expires_at: new Date(Date.now() + 3600000),
          token_type: 'Bearer',
          scope: 'shops_r listings_r'
        }),
        isTokenExpired: vi.fn().mockReturnValue(false),
        refreshToken: vi.fn()
      };

      const mockRateLimiter = {
        waitForRateLimit: vi.fn().mockResolvedValue(undefined),
        getRemainingRequests: vi.fn().mockReturnValue(9999),
        getRateLimitStatus: vi.fn().mockReturnValue({
          remainingRequests: 9999,
          resetTime: new Date(Date.now() + 86400000),
          canMakeRequest: true,
          isFromHeaders: false
        }),
        canMakeRequest: vi.fn().mockReturnValue(true),
        updateFromHeaders: vi.fn(),
        resetRetryCount: vi.fn(),
        handleRateLimitResponse: vi.fn().mockResolvedValue({ shouldRetry: false, delayMs: 1000 }),
        setApproachingLimitCallback: vi.fn(),
        setWarningThreshold: vi.fn()
      };

      (TokenManager as Mock).mockImplementation(() => mockTokenManager);
      (EtsyRateLimiter as Mock).mockImplementation(() => mockRateLimiter);

      const clientWithSecret = new EtsyClient(configWithSecret);

      const mockResponse = {
        ok: true,
        json: vi.fn().mockResolvedValue({ user_id: 123, login_name: 'testuser' }),
        headers: new Headers()
      };
      ctx.mockFetch.mockResolvedValue(mockResponse);

      await clientWithSecret.getUser();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/users/me',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-access-token',
            'x-api-key': 'test-api-key:test-shared-secret',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          })
        })
      );
    });

    it('should handle API errors properly', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: vi.fn().mockResolvedValue('{"error": "User not found"}'),
        headers: new Headers()
      };
      ctx.mockFetch.mockResolvedValue(mockResponse);

      await expect(ctx.client.getUser()).rejects.toThrow(EtsyApiError);
      await expect(ctx.client.getUser()).rejects.toThrow('Etsy API error: 404 Not Found');
    });

    it('should handle fetch errors', async () => {
      ctx.mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(ctx.client.getUser()).rejects.toThrow(EtsyApiError);
      await expect(ctx.client.getUser()).rejects.toThrow('Request failed: Network error');
    });
  });

  describe('utility methods', () => {
    it('should have getRemainingRequests method', () => {
      const result = ctx.client.getRemainingRequests();
      expect(typeof result).toBe('number');
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it('should have getRateLimitStatus method', () => {
      const result = ctx.client.getRateLimitStatus();
      expect(result).toHaveProperty('remainingRequests');
      expect(result).toHaveProperty('canMakeRequest');
      expect(typeof result.remainingRequests).toBe('number');
      expect(typeof result.canMakeRequest).toBe('boolean');
    });

    it('should have getCurrentTokens method', () => {
      const result = ctx.client.getCurrentTokens();
      expect(result).toHaveProperty('access_token');
      expect(result).toHaveProperty('refresh_token');
      expect(result).toHaveProperty('expires_at');
      expect(result).toHaveProperty('token_type');
    });

    it('should have isTokenExpired method', () => {
      const result = ctx.client.isTokenExpired();
      expect(typeof result).toBe('boolean');
    });
  });

  describe('caching', () => {
    it('should initialize with default cache when caching enabled', () => {
      const configWithCache = {
        ...ctx.mockConfig,
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
        ...ctx.mockConfig,
        caching: {
          enabled: false
        }
      };
      const client = new EtsyClient(configWithoutCache);
      expect(client).toBeInstanceOf(EtsyClient);
    });

    it('should clear cache', async () => {
      await ctx.client.clearCache();
      // Should not throw any errors
    });
  });

  describe('ping', () => {
    it('should ping the API', async () => {
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(1234567890),
        headers: new Headers({ 'content-length': '10' })
      });

      const result = await ctx.client.ping();

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/openapi-ping',
        expect.any(Object)
      );
      expect(result).toBe(1234567890);
    });
  });

  describe('tokenScopes', () => {
    it('should get token scopes', async () => {
      const mockScopes = { scopes: ['shops_r', 'listings_r', 'listings_w'] };
      ctx.mockFetch.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(mockScopes),
        headers: new Headers({ 'content-length': '100' })
      });

      const result = await ctx.client.tokenScopes({ token: 'test-token-123' });

      expect(ctx.mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/application/scopes',
        expect.objectContaining({
          method: 'POST',
          body: 'token=test-token-123'
        })
      );
      expect(result).toEqual(mockScopes);
    });
  });
});
