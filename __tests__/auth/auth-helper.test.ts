/**
 * Unit tests for AuthHelper
 */

import { AuthHelper, ETSY_SCOPES, COMMON_SCOPE_COMBINATIONS } from '../../src/auth/auth-helper';
import { EtsyAuthError, AuthHelperConfig } from '../../src/types';
import { createHash, randomBytes } from 'crypto';

// Mock crypto module
jest.mock('crypto', () => ({
  createHash: jest.fn(),
  randomBytes: jest.fn()
}));

// Mock node-fetch
jest.mock('node-fetch');

describe('AuthHelper', () => {
  let mockConfig: AuthHelperConfig;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    mockConfig = {
      keystring: 'test-api-key',
      redirectUri: 'https://example.com/callback',
      scopes: ['shops_r', 'listings_r']
    };

    mockFetch = jest.fn();
    (global as any).fetch = mockFetch;

    // Mock crypto functions
    (randomBytes as jest.Mock).mockReturnValue({
      toString: jest.fn().mockReturnValue('mock-random-string')
    });

    const mockHashInstance = {
      update: jest.fn().mockReturnThis(),
      digest: jest.fn().mockReturnValue('mock-code-challenge')
    };
    (createHash as jest.Mock).mockReturnValue(mockHashInstance);
  });

  describe('constructor', () => {
    it('should initialize with required configuration', () => {
      const authHelper = new AuthHelper(mockConfig);
      expect(authHelper).toBeInstanceOf(AuthHelper);
    });

    it('should generate code verifier and state if not provided', () => {
      const authHelper = new AuthHelper(mockConfig);
      expect(randomBytes).toHaveBeenCalledWith(32);
      expect(authHelper.getCodeVerifier()).toBe('mock-random-string');
      expect(authHelper.getState()).toBe('mock-random-string');
    });

    it('should use provided code verifier and state', () => {
      const configWithPkce = {
        ...mockConfig,
        codeVerifier: 'custom-code-verifier',
        state: 'custom-state'
      };
      const authHelper = new AuthHelper(configWithPkce);
      expect(authHelper.getCodeVerifier()).toBe('custom-code-verifier');
      expect(authHelper.getState()).toBe('custom-state');
    });
  });

  describe('getAuthUrl', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should generate correct authorization URL', () => {
      const url = authHelper.getAuthUrl();
      
      expect(createHash).toHaveBeenCalledWith('sha256');
      expect(url).toContain('https://www.etsy.com/oauth/connect');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test-api-key');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('scope=shops_r+listings_r');
      expect(url).toContain('state=mock-random-string');
      expect(url).toContain('code_challenge=mock-code-challenge');
      expect(url).toContain('code_challenge_method=S256');
    });

    it('should handle URL encoding properly', () => {
      const configWithSpecialChars = {
        ...mockConfig,
        redirectUri: 'https://example.com/callback?param=value&other=test'
      };
      const authHelper = new AuthHelper(configWithSpecialChars);
      const url = authHelper.getAuthUrl();
      
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback%3Fparam%3Dvalue%26other%3Dtest');
    });
  });

  describe('setAuthorizationCode', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should set authorization code with valid state', () => {
      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-auth-code', state);
      // Should not throw any errors
    });

    it('should throw error with invalid state', () => {
      expect(() => {
        authHelper.setAuthorizationCode('test-auth-code', 'invalid-state');
      }).toThrow(EtsyAuthError);
      expect(() => {
        authHelper.setAuthorizationCode('test-auth-code', 'invalid-state');
      }).toThrow('State parameter mismatch');
    });
  });

  describe('getAccessToken', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should throw error if authorization code not set', async () => {
      await expect(authHelper.getAccessToken()).rejects.toThrow(EtsyAuthError);
      await expect(authHelper.getAccessToken()).rejects.toThrow('Authorization code not set');
    });

    it('should successfully exchange code for tokens', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-auth-code', state);

      const result = await authHelper.getAccessToken();

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.etsy.com/v3/public/oauth/token',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
          },
          body: expect.stringContaining('grant_type=authorization_code')
        })
      );

      expect(result).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_at: expect.any(Date),
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      });
    });

    it('should handle token exchange failure', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: jest.fn().mockResolvedValue('Invalid authorization code')
      });

      const state = authHelper.getState();
      authHelper.setAuthorizationCode('invalid-auth-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow(EtsyAuthError);
      await expect(authHelper.getAccessToken()).rejects.toThrow('Token exchange failed: 400 Bad Request');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-auth-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow(EtsyAuthError);
      await expect(authHelper.getAccessToken()).rejects.toThrow('Token exchange failed: Network error');
    });

    it('should handle fetch not available error', async () => {
      // Remove global fetch
      delete (global as any).fetch;
      
      // Mock dynamic import to fail
      jest.doMock('node-fetch', () => {
        throw new Error('node-fetch not available');
      });

      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-auth-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow(EtsyAuthError);
      await expect(authHelper.getAccessToken()).rejects.toThrow('Fetch is not available');
    });
  });

  describe('getter methods', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should return state', () => {
      expect(authHelper.getState()).toBe('mock-random-string');
    });

    it('should return code verifier', () => {
      expect(authHelper.getCodeVerifier()).toBe('mock-random-string');
    });

    it('should return scopes', () => {
      expect(authHelper.getScopes()).toEqual(['shops_r', 'listings_r']);
      // Should return a copy, not the original array
      expect(authHelper.getScopes()).not.toBe(mockConfig.scopes);
    });

    it('should return redirect URI', () => {
      expect(authHelper.getRedirectUri()).toBe('https://example.com/callback');
    });
  });

  describe('crypto functions', () => {
    it('should generate secure random strings', () => {
      // Test with real crypto functions
      jest.unmock('crypto');
      
      const authHelper = new AuthHelper(mockConfig);
      const codeVerifier = authHelper.getCodeVerifier();
      const state = authHelper.getState();
      
      expect(codeVerifier).toBeDefined();
      expect(state).toBeDefined();
      expect(codeVerifier.length).toBeGreaterThan(0);
      expect(state.length).toBeGreaterThan(0);
    });
  });

  describe('fetch method', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should use global fetch when available', async () => {
      const mockTokenResponse = {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expires_in: 3600,
        token_type: 'Bearer',
        scope: 'shops_r listings_r'
      };

      mockFetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue(mockTokenResponse)
      });

      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-auth-code', state);

      await authHelper.getAccessToken();

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error when fetch is not available', async () => {
      // Remove global fetch to test fallback behavior
      const originalFetch = (global as any).fetch;
      const originalGlobalThis = globalThis.fetch;
      
      delete (global as any).fetch;
      delete (globalThis as any).fetch;

      const state = authHelper.getState();
      authHelper.setAuthorizationCode('test-auth-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow('Fetch is not available');

      // Restore fetch
      (global as any).fetch = originalFetch;
      globalThis.fetch = originalGlobalThis;
    });
  });
});

describe('ETSY_SCOPES', () => {
  it('should contain all expected scope constants', () => {
    expect(ETSY_SCOPES.LISTINGS_READ).toBe('listings_r');
    expect(ETSY_SCOPES.SHOPS_READ).toBe('shops_r');
    expect(ETSY_SCOPES.PROFILE_READ).toBe('profile_r');
    expect(ETSY_SCOPES.FAVORITES_READ).toBe('favorites_r');
    expect(ETSY_SCOPES.FEEDBACK_READ).toBe('feedback_r');
    expect(ETSY_SCOPES.TREASURY_READ).toBe('treasury_r');
    
    expect(ETSY_SCOPES.LISTINGS_WRITE).toBe('listings_w');
    expect(ETSY_SCOPES.SHOPS_WRITE).toBe('shops_w');
    expect(ETSY_SCOPES.PROFILE_WRITE).toBe('profile_w');
    expect(ETSY_SCOPES.FAVORITES_WRITE).toBe('favorites_w');
    expect(ETSY_SCOPES.FEEDBACK_WRITE).toBe('feedback_w');
    expect(ETSY_SCOPES.TREASURY_WRITE).toBe('treasury_w');
    
    expect(ETSY_SCOPES.LISTINGS_DELETE).toBe('listings_d');
    expect(ETSY_SCOPES.SHOPS_DELETE).toBe('shops_d');
    expect(ETSY_SCOPES.PROFILE_DELETE).toBe('profile_d');
    expect(ETSY_SCOPES.FAVORITES_DELETE).toBe('favorites_d');
    expect(ETSY_SCOPES.FEEDBACK_DELETE).toBe('feedback_d');
    expect(ETSY_SCOPES.TREASURY_DELETE).toBe('treasury_d');
    
    expect(ETSY_SCOPES.TRANSACTIONS_READ).toBe('transactions_r');
    expect(ETSY_SCOPES.TRANSACTIONS_WRITE).toBe('transactions_w');
    expect(ETSY_SCOPES.BILLING_READ).toBe('billing_r');
    expect(ETSY_SCOPES.CART_READ).toBe('cart_r');
    expect(ETSY_SCOPES.CART_WRITE).toBe('cart_w');
    expect(ETSY_SCOPES.RECOMMEND_READ).toBe('recommend_r');
    expect(ETSY_SCOPES.RECOMMEND_WRITE).toBe('recommend_w');
    expect(ETSY_SCOPES.ADDRESS_READ).toBe('address_r');
    expect(ETSY_SCOPES.ADDRESS_WRITE).toBe('address_w');
    expect(ETSY_SCOPES.EMAIL_READ).toBe('email_r');
  });
});

describe('COMMON_SCOPE_COMBINATIONS', () => {
  it('should contain expected scope combinations', () => {
    expect(COMMON_SCOPE_COMBINATIONS.SHOP_READ_ONLY).toEqual([
      'shops_r',
      'listings_r',
      'profile_r'
    ]);

    expect(COMMON_SCOPE_COMBINATIONS.SHOP_MANAGEMENT).toEqual([
      'shops_r',
      'shops_w',
      'listings_r',
      'listings_w',
      'listings_d',
      'profile_r',
      'transactions_r'
    ]);

    expect(COMMON_SCOPE_COMBINATIONS.BASIC_ACCESS).toEqual([
      'shops_r',
      'listings_r'
    ]);
  });
});