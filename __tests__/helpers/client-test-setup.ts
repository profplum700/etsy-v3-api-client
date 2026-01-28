/**
 * Shared test setup for EtsyClient tests
 */

import { vi, type Mock, type Mocked } from 'vitest';
import { EtsyClient } from '../../src/client';
import { EtsyClientConfig } from '../../src/types';
import { TokenManager } from '../../src/auth/token-manager';
import { EtsyRateLimiter } from '../../src/rate-limiting';

// Mock dependencies
vi.mock('../../src/auth/token-manager');
vi.mock('../../src/rate-limiting');

export interface MockClientContext {
  mockConfig: EtsyClientConfig;
  mockTokenManager: Mocked<TokenManager>;
  mockRateLimiter: Mocked<EtsyRateLimiter>;
  mockFetch: Mock;
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
    getAccessToken: vi.fn().mockResolvedValue('test-access-token'),
    getCurrentTokens: vi.fn().mockReturnValue({
      access_token: 'test-access-token',
      refresh_token: 'test-refresh-token',
      expires_at: new Date(Date.now() + 3600000),
      token_type: 'Bearer',
      scope: 'shops_r listings_r'
    }),
    isTokenExpired: vi.fn().mockReturnValue(false),
    refreshToken: vi.fn().mockResolvedValue({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_at: new Date(Date.now() + 3600000),
      token_type: 'Bearer',
      scope: 'shops_r listings_r'
    })
  } as unknown as Mocked<TokenManager>;

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
  } as unknown as Mocked<EtsyRateLimiter>;

  const mockFetch = vi.fn();
  (global as unknown as { fetch: Mock }).fetch = mockFetch;

  (TokenManager as Mock).mockImplementation(() => mockTokenManager);
  (EtsyRateLimiter as Mock).mockImplementation(() => mockRateLimiter);

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
    json: vi.fn().mockResolvedValue(data),
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
    text: vi.fn().mockResolvedValue(body),
    headers: new Headers()
  };
}
