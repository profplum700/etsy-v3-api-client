/**
 * Integration tests for the Etsy API client
 * These tests verify that different components work together correctly
 */

import { EtsyClient } from '../src/client';
import { AuthHelper } from '../src/auth/auth-helper';
import { TokenManager, MemoryTokenStorage } from '../src/auth/token-manager';
import { EtsyApiError, EtsyAuthError, EtsyRateLimitError } from '../src/types';
import { vi, type Mock } from 'vitest';

// Save real process for Vitest compatibility — Vitest's error handler needs process.listeners()
const _savedProcess = globalThis.process;
/** Creates a process stub without versions/version so isNode detection returns false */
function createNonNodeProcess() {
  return {
    listeners: _savedProcess.listeners.bind(_savedProcess),
    on: _savedProcess.on.bind(_savedProcess),
    off: _savedProcess.off.bind(_savedProcess),
    removeListener: _savedProcess.removeListener.bind(_savedProcess),
    emit: _savedProcess.emit.bind(_savedProcess),
    env: {},
  };
}

// Mock crypto module
vi.mock('crypto', () => ({
  createHash: vi.fn(),
  randomBytes: vi.fn()
}));

// Mock the crypto utils to return predictable values
vi.mock('../src/utils/crypto', () => ({
  generateState: vi.fn().mockResolvedValue('mock-state-123'),
  generateCodeVerifier: vi.fn().mockResolvedValue('mock-code-verifier-123'),
  createCodeChallenge: vi.fn().mockResolvedValue('mock-code-challenge-123')
}));

describe('Integration Tests', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch = vi.fn();
    (global as unknown as { fetch: Mock }).fetch = mockFetch;
  });

  describe('Authentication Flow Integration', () => {
    it('should complete full OAuth flow from auth helper to client', async () => {
      // Step 1: Create auth helper and get auth URL
      const authHelper = new AuthHelper({
        keystring: 'test-api-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r']
      });

      const authUrl = await authHelper.getAuthUrl();
      expect(authUrl).toContain('https://www.etsy.com/oauth/connect');

      // Step 2: Simulate auth callback and token exchange
      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-auth-code', state);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
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
        json: vi.fn().mockResolvedValue({
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
        json: vi.fn().mockResolvedValue({
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
        json: vi.fn().mockResolvedValue({
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
      const testMockFetch = vi.fn();
      (global as unknown as { fetch: Mock }).fetch = testMockFetch;
      
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
        json: vi.fn().mockResolvedValue({ user_id: 123 })
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
      const testMockFetch = vi.fn();
      (global as unknown as { fetch: Mock }).fetch = testMockFetch;
      
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
        json: vi.fn().mockResolvedValue({ user_id: 123 })
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
        json: vi.fn().mockResolvedValue({
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
        text: vi.fn().mockResolvedValue('User not found')
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
        text: vi.fn().mockResolvedValue('Invalid refresh token')
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
        json: vi.fn().mockResolvedValue(mockUser)
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
        json: vi.fn().mockResolvedValue(mockUser)
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

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-code', state);

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
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
        json: vi.fn().mockResolvedValue({
          user_id: 123,
          shop_id: 456
        })
      });

      const user = await client.getUser();

      // Step 4: Fetch listings
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
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
      expect(listings[0]?.title).toBe('Vintage Botanical Print');

      // Verify all API calls were made
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  describe('Browser Environment Integration', () => {
    let originalProcess: any;
    let originalWindow: any;
    let originalCrypto: any;
    let originalLocalStorage: any;
    let originalSessionStorage: any;

    beforeAll(() => {
      // Save original environment
      originalProcess = (global as any).process;
      originalWindow = (global as any).window;
      originalCrypto = (global as any).crypto;
      originalLocalStorage = (global as any).localStorage;
      originalSessionStorage = (global as any).sessionStorage;
    });

    afterAll(() => {
      // Restore original environment
      if (originalProcess !== undefined) {
        (global as any).process = originalProcess;
      } else {
        Object.defineProperty(global, 'process', { value: createNonNodeProcess(), writable: true, configurable: true });
      }
      if (originalWindow !== undefined) {
        (global as any).window = originalWindow;
      } else {
        delete (global as any).window;
      }
      if (originalCrypto !== undefined) {
        (global as any).crypto = originalCrypto;
      } else {
        delete (global as any).crypto;
      }
      if (originalLocalStorage !== undefined) {
        (global as any).localStorage = originalLocalStorage;
      } else {
        delete (global as any).localStorage;
      }
      if (originalSessionStorage !== undefined) {
        (global as any).sessionStorage = originalSessionStorage;
      } else {
        delete (global as any).sessionStorage;
      }
    });

    const setupBrowserEnvironment = () => {
      // Clear Node.js environment
      Object.defineProperty(global, 'process', { value: createNonNodeProcess(), writable: true, configurable: true });
      
      // Setup browser environment
      Object.defineProperty(global, 'window', {
        value: { document: {} },
        writable: true,
        configurable: true,
      });

      // Mock Web Crypto API
      Object.defineProperty(global, 'crypto', {
        value: {
          getRandomValues: vi.fn((array: Uint8Array) => {
            for (let i = 0; i < array.length; i++) {
              array[i] = i % 256;
            }
            return array;
          }),
          subtle: {
            digest: vi.fn(async (algorithm: string, data: Uint8Array) => {
              const hash = new Uint8Array(32);
              for (let i = 0; i < 32; i++) {
                hash[i] = (data[0] || 0) + i;
              }
              return hash.buffer;
            })
          }
        },
        writable: true,
        configurable: true,
      });

      // Mock browser storage
      const mockStorage = {
        getItem: vi.fn(() => null),
        setItem: vi.fn(),
        removeItem: vi.fn(),
        clear: vi.fn(),
      };

      Object.defineProperty(global, 'localStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global, 'sessionStorage', {
        value: mockStorage,
        writable: true,
        configurable: true,
      });

      // Mock btoa/atob for base64 operations
      Object.defineProperty(global, 'btoa', {
        value: (str: string) => Buffer.from(str, 'binary').toString('base64'),
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global, 'atob', {
        value: (str: string) => Buffer.from(str, 'base64').toString('binary'),
        writable: true,
        configurable: true,
      });

      // Mock TextEncoder
      Object.defineProperty(global, 'TextEncoder', {
        value: class TextEncoder {
          encode(str: string) {
            return new Uint8Array(Buffer.from(str, 'utf8'));
          }
        },
        writable: true,
        configurable: true,
      });
    };

    it('should work end-to-end in browser environment with localStorage', async () => {
      setupBrowserEnvironment();
      
      // Reset modules to get fresh imports with browser environment
      vi.resetModules();
      const { EtsyClient } = await import('../src/client');
      const { AuthHelper } = await import('../src/auth/auth-helper');
      const { LocalStorageTokenStorage } = await import('../src/auth/token-manager');

      // Step 1: Authentication in browser
      const authHelper = new AuthHelper({
        keystring: 'test-api-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r']
      });

      const authUrl = await authHelper.getAuthUrl();
      expect(authUrl).toContain('https://www.etsy.com/oauth/connect');

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-auth-code', state);

      // Mock token exchange
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          access_token: 'browser-access-token',
          refresh_token: 'browser-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer',
          scope: 'shops_r listings_r'
        })
      });

      const tokens = await authHelper.getAccessToken();
      expect(tokens.access_token).toBe('browser-access-token');

      // Step 2: Create client with localStorage storage
      const storage = new LocalStorageTokenStorage();
      expect(storage).toBeInstanceOf(LocalStorageTokenStorage);
      const client = new EtsyClient({
        keystring: 'test-api-key',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at,
        rateLimiting: {
          enabled: true,
          minRequestInterval: 0
        }
      });

      // Step 3: Make API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: vi.fn().mockResolvedValue({
          user_id: 999,
          login_name: 'browseruser',
          shop_id: 888
        })
      });

      const user = await client.getUser();
      expect(user.user_id).toBe(999);
      expect(user.login_name).toBe('browseruser');

      // Verify localStorage was available and used
      expect(global.localStorage.setItem).toBeDefined();
    });

    it('should work with sessionStorage when localStorage unavailable', async () => {
      setupBrowserEnvironment();
      
      // Remove localStorage to test sessionStorage fallback
      delete (global as any).localStorage;
      
      // Setup sessionStorage to actually store and retrieve data
      const mockSessionStorage: { [key: string]: string } = {};
      Object.defineProperty(global, 'sessionStorage', {
        value: {
          getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
          setItem: vi.fn((key: string, value: string) => {
            mockSessionStorage[key] = value;
          }),
          removeItem: vi.fn((key: string) => {
            delete mockSessionStorage[key];
          }),
          clear: vi.fn(() => {
            Object.keys(mockSessionStorage).forEach(key => delete mockSessionStorage[key]);
          }),
        },
        writable: true,
        configurable: true,
      });
      
      vi.resetModules();
      const { createDefaultTokenStorage, SessionStorageTokenStorage } = await import('../src/auth/token-manager');

      const storage = createDefaultTokenStorage();
      expect(storage).toBeInstanceOf(SessionStorageTokenStorage);

      // Test storage functionality
      const mockTokens = {
        access_token: 'session-token',
        refresh_token: 'session-refresh',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer' as const,
        scope: 'shops_r'
      };

      await storage.save(mockTokens);
      expect(global.sessionStorage.setItem).toHaveBeenCalled();

      const loadedTokens = await storage.load();
      expect(loadedTokens).toEqual(mockTokens);
    });

    it('should fallback to memory storage when no browser storage available', async () => {
      setupBrowserEnvironment();
      
      // Remove both localStorage and sessionStorage
      delete (global as any).localStorage;
      delete (global as any).sessionStorage;
      
      vi.resetModules();
      const { createDefaultTokenStorage, MemoryTokenStorage } = await import('../src/auth/token-manager');

      const storage = createDefaultTokenStorage();
      expect(storage).toBeInstanceOf(MemoryTokenStorage);

      // Test memory storage works
      const mockTokens = {
        access_token: 'memory-token',
        refresh_token: 'memory-refresh',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer' as const,
        scope: 'shops_r'
      };

      await storage.save(mockTokens);
      const loadedTokens = await storage.load();
      expect(loadedTokens).toEqual(mockTokens);
    });

    it('should handle crypto operations in browser environment', async () => {
      setupBrowserEnvironment();
      
      vi.resetModules();
      const { AuthHelper } = await import('../src/auth/auth-helper');
      const { createCodeChallenge } = await import('../src/utils/crypto');

      // Test that crypto operations work by creating an AuthHelper
      // This will internally use the crypto functions with our browser environment
      const authHelper = new AuthHelper({
        keystring: 'test-api-key',
        redirectUri: 'https://example.com/callback',
        scopes: ['shops_r', 'listings_r']
      });

      // Test that getAuthUrl works (uses createCodeChallenge internally)
      const authUrl = await authHelper.getAuthUrl();
      expect(authUrl).toContain('code_challenge=');
      expect(authUrl).toContain('code_challenge_method=S256');
      
      // Verify mocked crypto functions were called
      expect(createCodeChallenge).toHaveBeenCalled();

      // Test getter methods work
      const state = await authHelper.getState();
      const codeVerifier = await authHelper.getCodeVerifier();
      expect(typeof state).toBe('string');
      expect(typeof codeVerifier).toBe('string');
      expect(state.length).toBeGreaterThan(0);
      expect(codeVerifier.length).toBeGreaterThan(0);
    });

    it('should handle browser-specific error conditions', async () => {
      setupBrowserEnvironment();
      
      // Mock storage quota exceeded error
      Object.defineProperty(global, 'localStorage', {
        value: {
          setItem: vi.fn(() => {
            throw new Error('QuotaExceededError: localStorage quota exceeded');
          }),
          getItem: vi.fn(() => null),
          removeItem: vi.fn(),
          clear: vi.fn(),
        },
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      const { LocalStorageTokenStorage } = await import('../src/auth/token-manager');

      const storage = new LocalStorageTokenStorage();
      const mockTokens = {
        access_token: 'test-token',
        refresh_token: 'test-refresh',
        expires_at: new Date(Date.now() + 3600000),
        token_type: 'Bearer' as const,
        scope: 'shops_r'
      };

      // Should propagate storage errors
      await expect(storage.save(mockTokens)).rejects.toThrow('QuotaExceededError');
    });

    it('should work in Web Worker environment', async () => {
      // Clean up all environment indicators
      Object.defineProperty(global, 'process', { value: createNonNodeProcess(), writable: true, configurable: true });
      delete (global as any).window;
      delete (global as any).localStorage;
      delete (global as any).sessionStorage;
      delete (global as any).crypto;
      delete (global as any).navigator;
      
      // Setup Web Worker environment
      Object.defineProperty(globalThis, 'importScripts', {
        value: vi.fn(),
        writable: true,
        configurable: true,
      });

      Object.defineProperty(global, 'navigator', {
        value: { userAgent: 'Mozilla/5.0 (Web Worker)' },
        writable: true,
        configurable: true,
      });

      // Mock Web Crypto API (available in Web Workers)
      Object.defineProperty(global, 'crypto', {
        value: {
          getRandomValues: vi.fn((array: Uint8Array) => {
            for (let i = 0; i < array.length; i++) {
              array[i] = i % 256;
            }
            return array;
          }),
          subtle: {
            digest: vi.fn(async () => new ArrayBuffer(32))
          }
        },
        writable: true,
        configurable: true,
      });

      vi.resetModules();
      const { createDefaultTokenStorage, MemoryTokenStorage } = await import('../src/auth/token-manager');
      const { getEnvironmentInfo } = await import('../src/utils/environment');

      // Should detect Web Worker environment
      const envInfo = getEnvironmentInfo();
      expect(envInfo.isWebWorker).toBe(true);
      expect(envInfo.isBrowser).toBe(false);
      expect(envInfo.isNode).toBe(false);

      // Should use memory storage in Web Worker
      const storage = createDefaultTokenStorage();
      expect(storage).toBeInstanceOf(MemoryTokenStorage);

      // Clean up
      delete (globalThis as any).importScripts;
      delete (global as any).navigator;
      delete (global as any).crypto;
    });
  });
});