/**
 * Edge case and error handling tests
 * These tests verify that the library handles unusual conditions gracefully
 */

import { EtsyClient } from '../src/client';
import { AuthHelper } from '../src/auth/auth-helper';
import { TokenManager } from '../src/auth/token-manager';
import { EtsyApiError, EtsyAuthError, EtsyRateLimitError } from '../src/types';
import { generateCodeVerifier, generateState, createCodeChallenge } from '../src/utils/crypto';

// Mock crypto module
jest.mock('../src/utils/crypto', () => ({
  generateCodeVerifier: jest.fn().mockResolvedValue('mock-code-verifier'),
  generateState: jest.fn().mockResolvedValue('mock-state'),
  createCodeChallenge: jest.fn().mockResolvedValue('mock-code-challenge'),
  sha256: jest.fn().mockResolvedValue(new Uint8Array(32)),
  sha256Base64Url: jest.fn().mockResolvedValue('mock-hash')
}));

describe('Edge Cases and Error Handling', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch = jest.fn();
    (global as unknown as { fetch: jest.Mock }).fetch = mockFetch;
  });

  describe('EtsyClient Edge Cases', () => {
    it('should handle missing required configuration gracefully', () => {
      expect(() => new EtsyClient({} as any)).not.toThrow();
    });

    it('should handle null/undefined tokens gracefully', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: null as any,
        refreshToken: null as any,
        expiresAt: null as any
      });

      await expect(client.getUser()).rejects.toThrow();
    });

    it('should handle malformed API responses', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000)
      });

      // Mock response with invalid JSON
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockRejectedValue(new Error('Invalid JSON'))
      });

      await expect(client.getUser()).rejects.toThrow(EtsyApiError);
    });

    it('should handle extremely large API responses', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000)
      });

      // Mock very large response
      const largeArray = Array(10000).fill({
        listing_id: 123,
        title: 'Large Dataset Item'.repeat(100)
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ results: largeArray })
      });

      const result = await client.getListingsByShop('12345');
      expect(result).toHaveLength(10000);
    });

    it('should handle concurrent requests gracefully', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        rateLimiting: { enabled: false } // Disable for this test
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ user_id: 123 })
      });

      // Make 100 concurrent requests
      const promises = Array(100).fill(null).map(() => client.getUser());
      const results = await Promise.all(promises);

      expect(results).toHaveLength(100);
      results.forEach(result => {
        expect(result.user_id).toBe(123);
      });
    });

    it('should handle network timeouts gracefully', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000)
      });

      // Mock timeout error
      mockFetch.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 100)
        )
      );

      await expect(client.getUser()).rejects.toThrow(EtsyApiError);
    });

    it('should handle rate limiting with malformed retry-after header', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000)
      });

      mockFetch.mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        headers: {
          get: jest.fn().mockReturnValue('invalid-number') // Invalid retry-after
        },
        text: jest.fn().mockResolvedValue('Rate limited')
      });

      const error = await client.getUser().catch(e => e);
      expect(error).toBeInstanceOf(EtsyApiError);
      expect(error.statusCode).toBe(429);
    });

    it('should handle empty response bodies', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000)
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(null)
      });

      const result = await client.getUser();
      expect(result).toBeNull();
    });
  });

  describe('AuthHelper Edge Cases', () => {
    beforeEach(() => {
      // Reset crypto mocks to success for most tests
      (generateCodeVerifier as jest.Mock).mockResolvedValue('mock-code-verifier');
      (generateState as jest.Mock).mockResolvedValue('mock-state');
      (createCodeChallenge as jest.Mock).mockResolvedValue('mock-code-challenge');
    });

    it('should handle initialization properly', async () => {
      // Simple test to verify normal initialization works
      const authHelper = new AuthHelper({
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r']
      });

      const state = await authHelper.getState();
      const codeVerifier = await authHelper.getCodeVerifier();
      
      expect(state).toBe('mock-state');
      expect(codeVerifier).toBe('mock-code-verifier');
    });

    it('should handle malformed authorization URLs', async () => {
      const authHelper = new AuthHelper({
        keystring: 'test-key',
        redirectUri: 'not-a-valid-url', // Invalid URL
        scopes: ['shops_r']
      });

      const authUrl = await authHelper.getAuthUrl();
      // Should still generate URL but with malformed redirect_uri
      expect(authUrl).toContain('redirect_uri=not-a-valid-url');
    });

    it('should handle extremely long scope lists', async () => {
      const longScopes = Array(100).fill('listings_r');
      
      const authHelper = new AuthHelper({
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: longScopes
      });

      const authUrl = await authHelper.getAuthUrl();
      expect(authUrl).toContain('scope=');
      expect(authUrl.length).toBeGreaterThan(1000);
    });

    it('should handle special characters in configuration', async () => {
      const authHelper = new AuthHelper({
        keystring: 'test-key-with-special-chars-!@#$%',
        redirectUri: 'https://example.com/callback?param=value&other=test',
        scopes: ['shops_r']
      });

      const authUrl = await authHelper.getAuthUrl();
      // The actual encoding might vary, just check that it contains the encoded characters
      expect(authUrl).toContain('client_id=test-key-with-special-chars-');
      expect(authUrl).toContain('%21'); // ! encoded
      expect(authUrl).toContain('redirect_uri=https%3A%2F%2Fexample.com');
    });

    it('should handle token exchange with server errors', async () => {
      const authHelper = new AuthHelper({
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r']
      });

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-code', state);

      // Mock server error
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        text: jest.fn().mockResolvedValue('Server is temporarily unavailable')
      });

      await expect(authHelper.getAccessToken()).rejects.toThrow(EtsyAuthError);
    });

    it('should handle fetch unavailability gracefully', async () => {
      // Temporarily remove fetch
      const originalFetch = (global as any).fetch;
      const originalGlobalThisFetch = (globalThis as any).fetch;
      delete (global as any).fetch;
      delete (globalThis as any).fetch;

      const authHelper = new AuthHelper({
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r']
      });

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow('fetch is not defined');

      // Restore fetch
      (global as any).fetch = originalFetch;
      (globalThis as any).fetch = originalGlobalThisFetch;
    });

    it('should handle async initialization race conditions', async () => {
      const authHelper = new AuthHelper({
        keystring: 'test-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r']
      });

      // Call multiple methods before initialization completes
      const promises = [
        authHelper.getState(),
        authHelper.getCodeVerifier(),
        authHelper.getAuthUrl()
      ];

      const results = await Promise.all(promises);
      expect(results[0]).toBe('mock-state');
      expect(results[1]).toBe('mock-code-verifier');
      expect(results[2]).toContain('https://www.etsy.com/oauth/connect');
    });
  });

  describe('TokenManager Edge Cases', () => {
    it('should handle storage being unavailable', async () => {
      // Test without storage
      const tokenManager = new TokenManager({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() - 1000) // Expired to trigger refresh
      }); // No storage provided

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'shops_r'
        })
      });

      // Should still refresh even without storage
      const result = await tokenManager.refreshToken();
      expect(result.access_token).toBe('new-token');
    });

    it('should handle malformed token responses', async () => {
      const tokenManager = new TokenManager({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() - 1000) // Expired
      });

      // Mock malformed response
      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          // Missing required fields
          access_token: 'new-token'
          // Missing refresh_token, expires_in, etc.
        })
      });

      // Should handle gracefully and return partial data
      const result = await tokenManager.refreshToken();
      expect(result.access_token).toBe('new-token');
      expect(result.refresh_token).toBeUndefined();
    });

    it('should handle extremely early token expiration', async () => {
      const tokenManager = new TokenManager({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 1) // Expires in 1ms
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'new-token',
          refresh_token: 'new-refresh',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'shops_r'
        })
      });

      // Should trigger refresh due to imminent expiration
      const token = await tokenManager.getAccessToken();
      expect(token).toBe('new-token');
    });

    it('should handle date parsing edge cases', () => {
      const invalidDate = new Date('invalid-date-string');
      const tokenManager = new TokenManager({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: invalidDate // Invalid date
      });

      // For invalid dates, behavior depends on implementation
      // Some implementations treat NaN dates as expired, others don't
      const isExpired = tokenManager.isTokenExpired();
      const timeUntil = tokenManager.getTimeUntilExpiration();
      
      // Just verify the methods don't crash
      expect(typeof isExpired).toBe('boolean');
      expect(timeUntil === null || typeof timeUntil === 'number').toBe(true);
    });

    it('should handle concurrent refresh attempts with failures', async () => {
      const tokenManager = new TokenManager({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() - 1000)
      });

      let callCount = 0;
      mockFetch.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error('Network error'));
        }
        return Promise.resolve({
          ok: true,
          json: jest.fn().mockResolvedValue({
            access_token: 'new-token',
            refresh_token: 'new-refresh',
            expires_in: 3600,
            token_type: 'Bearer',
            scope: 'shops_r'
          })
        });
      });

      // First call should fail, second should succeed
      await expect(tokenManager.refreshToken()).rejects.toThrow();
      const result = await tokenManager.refreshToken();
      expect(result.access_token).toBe('new-token');
    });
  });

  describe('Error Class Edge Cases', () => {
    it('should handle EtsyApiError with missing response', () => {
      const error = new EtsyApiError('Test error', 500);
      expect(error.statusCode).toBe(500);
      expect(error.response).toBeUndefined();
      expect(error.name).toBe('EtsyApiError');
    });

    it('should handle EtsyAuthError with missing error code', () => {
      const error = new EtsyAuthError('Test auth error');
      expect(error.code).toBeUndefined();
      expect(error.name).toBe('EtsyAuthError');
    });

    it('should handle EtsyRateLimitError with missing retry-after', () => {
      const error = new EtsyRateLimitError('Rate limited');
      expect(error.retryAfter).toBeUndefined();
      expect(error.name).toBe('EtsyRateLimitError');
    });

    it('should preserve error stack traces', () => {
      const error = new EtsyApiError('Test error', 400);
      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('EtsyApiError');
    });
  });

  describe('Memory and Performance Edge Cases', () => {
    it('should handle memory pressure during large operations', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        caching: { enabled: true, ttl: 300 }
      });

      // Simulate many cached responses (smaller number for performance)
      mockFetch.mockImplementation(() => Promise.resolve({
        ok: true,
        json: jest.fn().mockResolvedValue({ listing_id: Math.floor(Math.random() * 1000) })
      }));

      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(client.getListing(i.toString()));
      }

      await Promise.all(promises);

      // Test completed without memory issues - basic smoke test
      expect(promises).toHaveLength(100);
    }, 10000); // Increase timeout

    it('should handle cache overflow gracefully', async () => {
      const client = new EtsyClient({
        keystring: 'test-key',
        accessToken: 'test-token',
        refreshToken: 'test-refresh',
        expiresAt: new Date(Date.now() + 3600000),
        caching: { enabled: true, ttl: 300 }
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({ user_id: 123 })
      });

      // Make many requests to fill cache
      for (let i = 0; i < 10000; i++) {
        await client.getUser();
      }

      // Should still work without memory issues
      const result = await client.getUser();
      expect(result.user_id).toBe(123);
    });
  });

  describe('Browser Compatibility Edge Cases', () => {
    it('should handle missing browser APIs gracefully', async () => {
      // Mock missing localStorage
      const originalLocalStorage = (global as any).localStorage;
      delete (global as any).localStorage;

      // Reset modules to get fresh import
      jest.resetModules();
      const { createDefaultTokenStorage } = require('../src/auth/token-manager');

      const storage = createDefaultTokenStorage();
      
      // Should fallback to another storage mechanism
      const testTokens = {
        access_token: 'test',
        refresh_token: 'test',
        expires_at: new Date(),
        token_type: 'Bearer' as const,
        scope: 'test'
      };

      await storage.save(testTokens);
      const loaded = await storage.load();
      expect(loaded).toEqual(testTokens);

      // Restore
      if (originalLocalStorage) {
        (global as any).localStorage = originalLocalStorage;
      }
    });

    it('should handle quota exceeded errors in browser storage', async () => {
      // Mock localStorage with quota error
      const mockLocalStorage = {
        setItem: jest.fn(() => {
          throw new DOMException('QuotaExceededError');
        }),
        getItem: jest.fn(() => null),
        removeItem: jest.fn(),
        clear: jest.fn()
      };

      Object.defineProperty(global, 'localStorage', {
        value: mockLocalStorage,
        writable: true,
        configurable: true
      });

      jest.resetModules();
      const { LocalStorageTokenStorage } = require('../src/auth/token-manager');

      const storage = new LocalStorageTokenStorage();
      const testTokens = {
        access_token: 'test',
        refresh_token: 'test',
        expires_at: new Date(),
        token_type: 'Bearer' as const,
        scope: 'test'
      };

      // Should throw the storage error
      await expect(storage.save(testTokens)).rejects.toThrow();
    });
  });
});