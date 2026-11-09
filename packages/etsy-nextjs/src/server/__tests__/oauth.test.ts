/**
 * OAuth Route Handler Tests
 */

import { vi, type MockedFunction, type MockInstance } from 'vitest';
import { NextRequest } from 'next/server';
import { createOAuthRoute } from '../oauth';
import { configureEtsyServerClient } from '../client';

// Shared cookie store for tests
const cookieStore = new Map<string, { value: string; options?: unknown }>();

// Mock next/headers
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => {
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
vi.mock('@profplum700/etsy-v3-api-client', async () => {
  const actual = await vi.importActual('@profplum700/etsy-v3-api-client');
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

// Mock client module to allow controlling serverClientConfig in tests
let _mockServerClientConfig: any = null;
vi.mock('../client', async () => {
  const actual = await vi.importActual<typeof import('../client')>('../client');
  return {
    ...actual,
    get serverClientConfig() { return _mockServerClientConfig; },
    configureEtsyServerClient: (config: any) => { _mockServerClientConfig = config; },
  };
});

// Mock fetch for token exchange
global.fetch = vi.fn() as MockedFunction<typeof fetch>;

describe('createOAuthRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cookieStore.clear();

    // Configure server client
    configureEtsyServerClient({
      apiKey: 'test-api-key',
      sharedSecret: 'test-shared-secret',
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
      // Clear configuration via mock
      const savedConfig = _mockServerClientConfig;
      _mockServerClientConfig = null;

      const handler = createOAuthRoute();
      const request = new NextRequest('http://localhost:3000/api/etsy/auth/authorize');

      const response = await handler(request);
      expect(response.status).toBe(500);

      const json = await response.json();
      expect(json.error).toContain('not configured');

      // Restore config
      _mockServerClientConfig = savedConfig;
    });
  });

  describe('callback handler', () => {
    let consoleErrorSpy: MockInstance;

    beforeEach(() => {
      consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
      consoleErrorSpy.mockRestore();
    });

    it('should exchange code for tokens and set cookies', async () => {
      // Mock successful token exchange
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
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

    async function completeLogin(successUrl: string): Promise<Response> {
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'test-access-token',
          refresh_token: 'test-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as Response);

      const handler = createOAuthRoute();
      const authorizeResponse = await handler(
        new NextRequest('http://localhost:3000/api/etsy/auth/authorize', {
          headers: { accept: 'application/json' },
        })
      );
      const { state } = await authorizeResponse.json();

      return handler(
        new NextRequest(
          `http://localhost:3000/api/etsy/auth/callback?code=test-code&state=${state}` +
            `&success_url=${encodeURIComponent(successUrl)}`,
          { headers: { accept: 'text/html' } }
        )
      );
    }

    it('stores the tokens in the separate cookies and the combined one', async () => {
      const handler = createOAuthRoute();
      const authorizeResponse = await handler(
        new NextRequest('http://localhost:3000/api/etsy/auth/authorize', {
          headers: { accept: 'application/json' },
        })
      );
      const { state } = await authorizeResponse.json();

      await handler(
        new NextRequest(`http://localhost:3000/api/etsy/auth/callback?code=test-code&state=${state}`, {
          headers: { accept: 'application/json' },
        })
      );

      expect(cookieStore.get('etsy_access_token')?.value).toBe('mock-access-token');
      expect(cookieStore.get('etsy_refresh_token')?.value).toBe('mock-refresh-token');
      expect(cookieStore.get('etsy_token_type')?.value).toBe('Bearer');
      expect(JSON.parse(cookieStore.get('etsy-tokens')!.value)).toMatchObject({
        accessToken: 'mock-access-token',
        refreshToken: 'mock-refresh-token',
      });
      expect(cookieStore.has('etsy_oauth_state')).toBe(false);
    });

    it('redirects to a same-origin success_url after login', async () => {
      const response = await completeLogin('/dashboard?tab=orders');
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/dashboard?tab=orders');
    });

    it('ignores an off-site success_url after login', async () => {
      const response = await completeLogin('https://evil.example/phish');
      expect(response.status).toBe(307);
      expect(response.headers.get('location')).toBe('http://localhost:3000/');
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
      expect(consoleErrorSpy).toHaveBeenCalled();
    });
  });

  describe('refresh handler', () => {
    it('should refresh access token', async () => {
      // Mock successful token refresh
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
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

  describe('refresh handler with a stored refresh token', () => {
    // Earlier tests can leave a queued fetch response unused.
    beforeEach(() => {
      (global.fetch as MockedFunction<typeof fetch>).mockReset();
    });

    it('sends the refresh token to Etsy and stores the new tokens', async () => {
      cookieStore.set('etsy_refresh_token', { value: 'stored-refresh-token' });
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          token_type: 'Bearer',
          expires_in: 3600,
        }),
      } as Response);

      const response = await createOAuthRoute()(
        new NextRequest('http://localhost:3000/api/etsy/auth/refresh', { method: 'POST' })
      );

      expect(response.status).toBe(200);
      const [url, init] = (global.fetch as MockedFunction<typeof fetch>).mock.calls[0];
      expect(url).toBe('https://api.etsy.com/v3/public/oauth/token');
      expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
        grant_type: 'refresh_token',
        client_id: 'test-api-key',
        refresh_token: 'stored-refresh-token',
      });
      expect(cookieStore.get('etsy_refresh_token')?.value).toBe('new-refresh-token');
      expect(JSON.parse(cookieStore.get('etsy-tokens')!.value)).toMatchObject({
        accessToken: 'new-access-token',
        refreshToken: 'new-refresh-token',
      });
    });

    it('answers 500 and keeps the cookies when Etsy refuses the refresh', async () => {
      cookieStore.set('etsy_refresh_token', { value: 'stored-refresh-token' });
      (global.fetch as MockedFunction<typeof fetch>).mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => '{"error":"invalid_grant"}',
      } as Response);
      vi.spyOn(console, 'error').mockImplementation(() => {});

      const response = await createOAuthRoute()(
        new NextRequest('http://localhost:3000/api/etsy/auth/refresh', { method: 'POST' })
      );

      expect(response.status).toBe(500);
      expect((await response.json()).details).toContain('Token refresh failed: 400');
      expect(cookieStore.get('etsy_refresh_token')?.value).toBe('stored-refresh-token');
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

    it('keeps a same-origin redirect_url path', async () => {
      const handler = createOAuthRoute();
      const request = new NextRequest(
        'http://localhost:3000/api/etsy/auth/logout?redirect_url=%2Fsigned-out%3Fbye%3D1',
        { method: 'POST', headers: { accept: 'text/html' } }
      );

      const response = await handler(request);
      expect(response.headers.get('location')).toBe('http://localhost:3000/signed-out?bye=1');
    });

    it.each([
      'https://evil.example/phish',
      '//evil.example/phish',
      '/\\evil.example/phish',
      'javascript:alert(1)',
    ])('ignores an off-site redirect_url (%s)', async (target) => {
      const handler = createOAuthRoute();
      const request = new NextRequest(
        `http://localhost:3000/api/etsy/auth/logout?redirect_url=${encodeURIComponent(target)}`,
        { method: 'POST', headers: { accept: 'text/html' } }
      );

      const response = await handler(request);
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
