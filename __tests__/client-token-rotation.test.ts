/**
 * Proactive token rotation configured through EtsyClientConfig.tokenRotation.
 * These use the real TokenManager, so they show that rotation runs on the
 * same token manager that signs the client's requests.
 */

import { vi, type Mock } from 'vitest';
import { EtsyClient } from '../src/client';
import { TokenManager } from '../src/auth/token-manager';
import { EtsyClientConfig, TokenRotationConfig } from '../src/types';

const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

function tokenResponse(n: number) {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({
      access_token: `rotated-access-${n}`,
      refresh_token: `rotated-refresh-${n}`,
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'shops_r'
    })
  };
}

function apiResponse(data: unknown) {
  return { ok: true, status: 200, headers: new Headers(), json: vi.fn().mockResolvedValue(data) };
}

function sentRefreshToken(call: unknown[]): string | null {
  return new URLSearchParams((call[1] as { body: string }).body).get('refresh_token');
}

describe('EtsyClient token rotation', () => {
  let mockFetch: Mock;
  let client: EtsyClient | undefined;

  function config(tokenRotation: TokenRotationConfig, extra: Partial<EtsyClientConfig> = {}): EtsyClientConfig {
    return {
      keystring: 'test-key',
      sharedSecret: 'test-secret',
      accessToken: 'initial-access',
      refreshToken: 'initial-refresh',
      // Inside the 15-minute rotation window, but not expired.
      expiresAt: new Date(Date.now() + 5 * 60 * 1000),
      rateLimiting: { enabled: false },
      caching: { enabled: false },
      tokenRotation,
      ...extra
    };
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    mockFetch = vi.fn();
    (global as unknown as { fetch: Mock }).fetch = mockFetch;
  });

  afterEach(() => {
    client?.stopTokenRotation();
    client = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('rotates on the client\'s own token manager, so requests and later refreshes use the rotated tokens', async () => {
    const onRotation = vi.fn();
    const refreshSave = vi.fn();
    mockFetch.mockImplementation((url: string) =>
      Promise.resolve(url === TOKEN_URL
        ? tokenResponse(mockFetch.mock.calls.filter(c => c[0] === TOKEN_URL).length)
        : apiResponse({ user_id: 1 })));

    client = new EtsyClient(config({
      enabled: true,
      rotateBeforeExpiry: 15 * 60 * 1000,
      autoSchedule: true,
      checkInterval: 1000,
      onRotation
    }, { refreshSave }));

    await vi.advanceTimersByTimeAsync(1000);

    expect(onRotation).toHaveBeenCalledTimes(1);
    expect(onRotation.mock.calls[0]![0]).toMatchObject({ refresh_token: 'initial-refresh' });
    expect(onRotation.mock.calls[0]![1]).toMatchObject({ refresh_token: 'rotated-refresh-1' });
    expect(refreshSave).toHaveBeenCalledWith('rotated-access-1', 'rotated-refresh-1', expect.any(Date));
    expect(client.getCurrentTokens()).toMatchObject({ refresh_token: 'rotated-refresh-1' });

    await client.getUser();
    const apiCall = mockFetch.mock.calls.find(c => c[0] !== TOKEN_URL)!;
    expect((apiCall[1] as { headers: Record<string, string> }).headers['Authorization'])
      .toBe('Bearer rotated-access-1');

    // A later refresh spends the rotated refresh token, not the original one.
    await client.refreshToken();
    const refreshCalls = mockFetch.mock.calls.filter(c => c[0] === TOKEN_URL);
    expect(refreshCalls.map(sentRefreshToken)).toEqual(['initial-refresh', 'rotated-refresh-1']);
  });

  it('does not schedule checks without autoSchedule', async () => {
    client = new EtsyClient(config({ enabled: true, rotateBeforeExpiry: 15 * 60 * 1000, checkInterval: 1000 }));

    await vi.advanceTimersByTimeAsync(10_000);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('stopTokenRotation() stops the scheduled checks', async () => {
    mockFetch.mockResolvedValue(tokenResponse(1));
    client = new EtsyClient(config({
      enabled: true,
      rotateBeforeExpiry: 15 * 60 * 1000,
      autoSchedule: true,
      checkInterval: 1000
    }));

    client.stopTokenRotation();
    await vi.advanceTimersByTimeAsync(10_000);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('lets an explicit TokenManager rotation argument override config.tokenRotation', () => {
    const explicit: TokenRotationConfig = { enabled: false, rotateBeforeExpiry: 1000 };
    const manager = new TokenManager(
      config({ enabled: true, rotateBeforeExpiry: 15 * 60 * 1000 }),
      undefined,
      explicit
    );

    expect(manager.getRotationConfig()).toEqual(explicit);
  });

  it('reads config.tokenRotation when TokenManager gets no rotation argument', () => {
    const manager = new TokenManager(config({ enabled: true, rotateBeforeExpiry: 60_000 }));

    expect(manager.getRotationConfig()).toMatchObject({ enabled: true, rotateBeforeExpiry: 60_000 });
    expect(manager.needsProactiveRotation()).toBe(false);
  });
});
