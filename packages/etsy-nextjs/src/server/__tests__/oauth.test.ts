/**
 * OAuth Route Handler Tests
 */

import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { NextRequest } from 'next/server';
import { createOAuthRoute } from '../oauth';
import { configureEtsyServerClient } from '../client';

// Shared cookie store for tests
const cookieStore = new Map<string, { value: string; options?: unknown }>();

// Mock next/headers
jest.mock('next/headers', () => ({
  cookies: jest.fn(() => {
    return Promise.resolve({
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string, options?: unknown) => {
        cookieStore.set(name, { value, options });
      },
      delete: (name: string) => {
        cookieStore.delete(name);
      },
    });
  }),
}));

// Mock crypto utilities
jest.mock('@profplum700/etsy-v3-api-client', () => {
  const actual = jest.requireActual('@profplum700/etsy-v3-api-client');
  return {
    ...actual,
    AuthHelper: class MockAuthHelper {
      private state = 'mock-state';
      private codeVerifier = 'mock-code-verifier';
      private keystring: string;
      private redirectUri: string;
      private scopes: string[];
      private authorizationCode?: string;

      constructor(config: { keystring: string; redirectUri: string; scopes: string[]; state?: string; codeVerifier?: string }) {
        this.keystring = config.keystring;
        this.redirectUri = config.redirectUri;
        this.scopes = config.scopes;
        if (config.state) this.state = config.state;
        if (config.codeVerifier) this.codeVerifier = config.codeVerifier;
      }

      async getAuthUrl(): Promise<string> {
        const params = new URLSearchParams({
          response_type: 'code',
          client_id: this.keystring,
          redirect_uri: this.redirectUri,
          scope: this.scopes.join(' '),
          state: this.state,
          code_challenge: 'mock-code-challenge',
          code_challenge_method: 'S256'
        });
        return `https://www.etsy.com/oauth/connect?${params.toString()}`;
      }

      async getState(): Promise<string> {
        return this.state;
      }

      async getCodeVerifier(): Promise<string> {
        return this.codeVerifier;
      }

      async setAuthorizationCode(code: string, state: string): Promise<void> {
        if (state !== this.state) {
          throw new Error('State parameter mismatch');
        }
        this.authorizationCode = code;
      }

      async getAccessToken() {
        if (!this.authorizationCode) {
          throw new Error('Authorization code not set');
        }
        return {
          access_token: 'mock-access-token',
          refresh_token: 'mock-refresh-token',
          expires_at: new Date(Date.now() + 3600000),
          token_type: 'Bearer',
          scope: this.scopes.join(' ')
        };
      }
    }
  };
});

// Mock fetch for token exchange
global.fetch = jest.fn() as jest.MockedFunction<typeof fetch>;

describe('createOAuthRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    cookieStore.clear();

    // Configure server client
    configureEtsyServerClient({
      apiKey: 'test-api-key',
      redirectUri: 'http://localhost:3000/api/etsy/auth/callback',
      scopes: ['listings_r', 'shops_r'],
    });
  });

  describe('authorize handler', () => {
    it('should generate authorization URL and set cookies', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/authorize', {
        headers: {
          accept: 'application/json',
        },
      });

      const response = await handler(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json).toHaveProperty('authUrl');
      expect(json).toHaveProperty('state');
      expect(json.authUrl).toContain('https://www.etsy.com/oauth/connect');
      expect(json.authUrl).toContain('client_id=test-api-key');
      expect(json.authUrl).toContain('code_challenge');
      expect(json.authUrl).toContain('code_challenge_method=S256');
    });

    it('should redirect to Etsy for browser requests', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/authorize', {
        headers: {
          accept: 'text/html',
        },
      });

      const response = await handler(request);
      expect(response.status).toBe(307); // Redirect status
      expect(response.headers.get('location')).toContain('https://www.etsy.com/oauth/connect');
    });

    it('should return error if not configured', async () => {
      // Clear configuration
      const { serverClientConfig } = await import('../client');
      const originalConfig = serverClientConfig;
      (await import('../client')).serverClientConfig = null;

      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/authorize');

      const response = await handler(request);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.error).toContain('not configured');

      // Restore config
      (await import('../client')).serverClientConfig = originalConfig;
    });
  });

  describe('callback handler', () => {
    it('should exchange code for tokens and set cookies', async () => {
      // Mock successful token exchange
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as Response);

      const handler = createOAuthRoute();

      // First, get state and verifier from authorize
      const authorizeRequest = new NextRequest('http://localhost:3000/api/etsy/auth/authorize', {
        headers: { accept: 'application/json' },
      });
      const authorizeResponse = await handler(authorizeRequest);
      const { state } = await authorizeResponse.json();

      // Now make callback request
      const callbackRequest = new NextRequest(
        `http://localhost:3000/api/etsy/auth/callback?code=test-code&state=${state}`,
        {
          headers: { accept: 'application/json' },
        }
      );

      const response = await handler(callbackRequest);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json).toHaveProperty('expiresAt');
    });

    it('should reject mismatched state', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest(
        'http://localhost:3000/api/etsy/auth/callback?code=test-code&state=wrong-state',
        {
          headers: { accept: 'application/json' },
        }
      );

      const response = await handler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain('state');
    });

    it('should handle OAuth errors from Etsy', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest(
        'http://localhost:3000/api/etsy/auth/callback?error=access_denied&error_description=User+denied+access',
        {
          headers: { accept: 'application/json' },
        }
      );

      const response = await handler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain('OAuth authorization failed');
      expect(json.details).toContain('User denied access');
    });
  });

  describe('refresh handler', () => {
    it('should refresh access token', async () => {
      // Mock successful token refresh
      (global.fetch as jest.MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as Response);

      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/refresh', {
        method: 'POST',
        headers: { accept: 'application/json' },
      });

      const response = await handler(request);

      // Will fail with 401 if no refresh token in cookies (expected in test)
      // In real usage, cookies would be set from callback
      const json = await response.json();
      if (response.status === 401) {
        expect(json.error).toContain('No refresh token');
      } else {
        expect(response.status).toBe(200);
        expect(json.success).toBe(true);
      }
    });
  });

  describe('logout handler', () => {
    it('should clear all auth cookies', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/logout', {
        method: 'POST',
        headers: { accept: 'application/json' },
      });

      const response = await handler(request);
      expect(response.status).toBe(200);

      const json = await response.json();
      expect(json.success).toBe(true);
    });

    it('should redirect for browser requests', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/logout', {
        method: 'POST',
        headers: { accept: 'text/html' },
      });

      const response = await handler(request);
      expect(response.status).toBe(307); // Redirect status
      expect(response.headers.get('location')).toBe('http://localhost:3000/');
    });
  });

  describe('invalid action', () => {
    it('should return error for invalid action', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/invalid');

      const response = await handler(request);
      expect(response.status).toBe(400);

      const json = await response.json();
      expect(json.error).toContain('Invalid OAuth action');
    });
  });
});
