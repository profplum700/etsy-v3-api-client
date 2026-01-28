/**
 * Unit tests for AuthHelper
 */

import { AuthHelper, ETSY_SCOPES, COMMON_SCOPE_COMBINATIONS } from '../../src/auth/auth-helper';
import { EtsyAuthError, AuthHelperConfig } from '../../src/types';
import { vi, type Mock } from 'vitest';

// Mock universal crypto module
vi.mock('../../src/utils/crypto', () => ({
  generateCodeVerifier: vi.fn().mockResolvedValue('mock-code-verifier'),
  generateState: vi.fn().mockResolvedValue('mock-state'),
  createCodeChallenge: vi.fn().mockResolvedValue('mock-code-challenge')
}));



describe('AuthHelper', () => {
  let mockConfig: AuthHelperConfig;
  let mockFetch: Mock;

  beforeEach(() => {
    vi.clearAllMocks();

    mockConfig = {
      keystring: 'test-api-key',
      redirectUri: 'https://example.com/callback',
      scopes: ['shops_r', 'listings_r']
    };

    mockFetch = vi.fn();
    global.fetch = mockFetch;
  });

  describe('constructor', () => {
    it('should initialize with required configuration', () => {
      const authHelper = new AuthHelper(mockConfig);
      expect(authHelper).toBeInstanceOf(AuthHelper);
    });

    it('should generate code verifier and state if not provided', async () => {
      const { generateCodeVerifier, generateState } = await import('../../src/utils/crypto');
      const authHelper = new AuthHelper(mockConfig);
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(generateCodeVerifier).toHaveBeenCalled();
      expect(generateState).toHaveBeenCalled();
      expect(await authHelper.getCodeVerifier()).toBe('mock-code-verifier');
      expect(await authHelper.getState()).toBe('mock-state');
    });

    it('should use provided code verifier and state', async () => {
      const configWithPkce = {
        ...mockConfig,
        codeVerifier: 'custom-code-verifier',
        state: 'custom-state'
      };
      const authHelper = new AuthHelper(configWithPkce);
      
      // Wait for initialization to complete
      await new Promise(resolve => setTimeout(resolve, 0));
      
      expect(await authHelper.getCodeVerifier()).toBe('custom-code-verifier');
      expect(await authHelper.getState()).toBe('custom-state');
    });
  });

  describe('getAuthUrl', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should generate a valid authorization URL', async () => {
      const authUrl = await authHelper.getAuthUrl();
      const url = new URL(authUrl);

      expect(url.origin).toBe('https://www.etsy.com');
      expect(url.pathname).toBe('/oauth/connect');
      expect(url.searchParams.get('response_type')).toBe('code');
      expect(url.searchParams.get('client_id')).toBe(mockConfig.keystring);
      expect(url.searchParams.get('redirect_uri')).toBe(mockConfig.redirectUri);
      expect(url.searchParams.get('scope')).toBe('shops_r listings_r');
      expect(url.searchParams.get('state')).toBe(await authHelper.getState());
      expect(url.searchParams.get('code_challenge')).toBe('mock-code-challenge');
      expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    });

    it('should handle URL encoding properly', async () => {
      const configWithSpecialChars = {
        ...mockConfig,
        redirectUri: 'https://example.com/callback?param=value&other=test'
      };
      const authHelper = new AuthHelper(configWithSpecialChars);
      const url = await authHelper.getAuthUrl();
      
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback%3Fparam%3Dvalue%26other%3Dtest');
    });
  });

  describe('setAuthorizationCode', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should set authorization code with valid state', async () => {
      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-auth-code', state);
      // Should not throw any errors
    });

    it('should throw error for state mismatch', async () => {
      const state = await authHelper.getState();
      await expect(authHelper.setAuthorizationCode('test-code', `${state}-invalid`))
        .rejects.toThrow(new EtsyAuthError('State parameter mismatch', 'INVALID_STATE'));
    });

    it('should throw error with invalid state', async () => {
      await expect(authHelper.setAuthorizationCode('test-auth-code', 'invalid-state'))
        .rejects.toThrow(EtsyAuthError);
      await expect(authHelper.setAuthorizationCode('test-auth-code', 'invalid-state'))
        .rejects.toThrow('State parameter mismatch');
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
        json: vi.fn().mockResolvedValue(mockTokenResponse)
      });

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-auth-code', state);

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
        text: vi.fn().mockResolvedValue('Invalid authorization code')
      });

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('invalid-auth-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow(EtsyAuthError);
      await expect(authHelper.getAccessToken()).rejects.toThrow('Token exchange failed: 400 Bad Request');
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-auth-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow(EtsyAuthError);
      await expect(authHelper.getAccessToken()).rejects.toThrow('Token exchange failed: Network error');
    });
  });

  describe('getter methods', () => {
    let authHelper: AuthHelper;

    beforeEach(() => {
      authHelper = new AuthHelper(mockConfig);
    });

    it('should return state', async () => {
      const state = await authHelper.getState();
      expect(state).toBe('mock-state');
      expect(state.length).toBeGreaterThan(0);
    });

    it('should return code verifier', async () => {
      const codeVerifier = await authHelper.getCodeVerifier();
      expect(codeVerifier).toBe('mock-code-verifier');
      expect(codeVerifier.length).toBeGreaterThan(0);
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

  describe('crypto integration', () => {
    it('should use universal crypto functions for initialization', async () => {
      const { generateCodeVerifier, generateState, createCodeChallenge } = await import('../../src/utils/crypto');
      
      const authHelper = new AuthHelper(mockConfig);
      
      // Wait for initialization
      await new Promise(resolve => setTimeout(resolve, 0));
      
      // Test that crypto functions are called during initialization
      expect(generateCodeVerifier).toHaveBeenCalled();
      expect(generateState).toHaveBeenCalled();
      
      // Test that getAuthUrl calls createCodeChallenge
      await authHelper.getAuthUrl();
      expect(createCodeChallenge).toHaveBeenCalledWith('mock-code-verifier');
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
        json: vi.fn().mockResolvedValue(mockTokenResponse)
      });

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-auth-code', state);

      await authHelper.getAccessToken();

      expect(mockFetch).toHaveBeenCalled();
    });

    it('should throw error when fetch is not available', async () => {
      // Remove global fetch to test fallback behavior
      const originalFetch = global.fetch;
      const originalGlobalThisFetch = globalThis.fetch;

      // @ts-ignore
      delete global.fetch;
      // @ts-ignore
      delete globalThis.fetch;

      const state = await authHelper.getState();
      await authHelper.setAuthorizationCode('test-auth-code', state);

      await expect(authHelper.getAccessToken()).rejects.toThrow('fetch is not defined');

      // Restore fetch
      global.fetch = originalFetch;
      globalThis.fetch = originalGlobalThisFetch;
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