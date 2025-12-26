/**
 * Shared test setup for EtsyClient tests
 */

import { EtsyClient } from '../../src/client';
import { EtsyClientConfig } from '../../src/types';
import { TokenManager } from '../../src/auth/token-manager';
import { EtsyRateLimiter } from '../../src/rate-limiting';

// Mock dependencies
jest.mock('../../src/auth/token-manager');
jest.mock('../../src/rate-limiting');

export interface MockClientContext {
  mockConfig: EtsyClientConfig;
  mockTokenManager: jest.Mocked<TokenManager>;
  mockRateLimiter: jest.Mocked<EtsyRateLimiter>;
  mockFetch: jest.Mock;
  client: EtsyClient;
}

export function setupClientMocks(): MockClientContext {
  const mockConfig: EtsyClientConfig = {
    keystring: 'test-api-key',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
    baseUrl: 'https://api.etsy.com/v3/application'
  };

  const mockTokenManager = {
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

  const mockRateLimiter = {
    waitForRateLimit: jest.fn().mockResolvedValue(undefined),
    getRemainingRequests: jest.fn().mockReturnValue(9999),
    getRateLimitStatus: jest.fn().mockReturnValue({
      remainingRequests: 9999,
      resetTime: new Date(Date.now() + 86400000),
      canMakeRequest: true,
      isFromHeaders: false
    }),
    canMakeRequest: jest.fn().mockReturnValue(true),
    updateFromHeaders: jest.fn(),
    resetRetryCount: jest.fn(),
    handleRateLimitResponse: jest.fn().mockResolvedValue({ shouldRetry: false, delayMs: 1000 }),
    setApproachingLimitCallback: jest.fn(),
    setWarningThreshold: jest.fn()
  } as unknown as jest.Mocked<EtsyRateLimiter>;

  const mockFetch = jest.fn();
  (global as unknown as { fetch: jest.Mock }).fetch = mockFetch;

  (TokenManager as jest.Mock).mockImplementation(() => mockTokenManager);
  (EtsyRateLimiter as jest.Mock).mockImplementation(() => mockRateLimiter);

  const client = new EtsyClient(mockConfig);

  return {
    mockConfig,
    mockTokenManager,
    mockRateLimiter,
    mockFetch,
    client
  };
}

export function createMockResponse<T>(data: T, ok = true, status = 200): Partial<Response> {
  return {
    ok,
    status,
    json: jest.fn().mockResolvedValue(data),
    headers: new Headers({ 'content-length': '100' })
  };
}

export function create204Response(): Partial<Response> {
  return {
    ok: true,
    status: 204,
    headers: new Headers({ 'content-length': '0' })
  };
}

export function createErrorResponse(status: number, statusText: string, body: string): Partial<Response> {
  return {
    ok: false,
    status,
    statusText,
    text: jest.fn().mockResolvedValue(body),
    headers: new Headers()
  };
}
