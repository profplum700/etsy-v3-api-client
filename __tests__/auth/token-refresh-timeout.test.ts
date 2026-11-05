/**
 * A refresh request to Etsy's token endpoint must not hang its callers forever.
 */

import { TokenManager, MemoryTokenStorage } from '../../src/auth/token-manager';
import { EtsyAuthError, EtsyClientConfig } from '../../src/types';
import { vi, type Mock } from 'vitest';

const ORIGINAL_ACCESS = 'stored-access-token';
const ORIGINAL_REFRESH = 'stored-refresh-token';

function config(overrides: Partial<EtsyClientConfig> = {}): EtsyClientConfig {
  return {
    keystring: 'test-api-key',
    sharedSecret: 'test-shared-secret',
    accessToken: ORIGINAL_ACCESS,
    refreshToken: ORIGINAL_REFRESH,
    expiresAt: new Date(Date.now() - 1000),
    ...overrides
  };
}

/** A fetch that never answers, but rejects on abort like the real one. */
type FetchInit = Parameters<typeof fetch>[1];

function hangingFetch(): Mock {
  return vi.fn((_url: string, init?: FetchInit) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => {
      reject(new DOMException('This operation was aborted', 'AbortError'));
    });
  }));
}

function okResponse() {
  return {
    ok: true,
    status: 200,
    json: vi.fn().mockResolvedValue({
      access_token: 'new-access-token',
      refresh_token: 'new-refresh-token',
      expires_in: 3600,
      token_type: 'Bearer',
      scope: 'listings_r'
    })
  };
}

describe('TokenManager refresh timeout', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    vi.useFakeTimers();
    mockFetch = hangingFetch();
    (global as unknown as { fetch: Mock }).fetch = mockFetch;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('throws TOKEN_REFRESH_TIMEOUT after 30 seconds by default and aborts the request', async () => {
    const tokenManager = new TokenManager(config());
    const refresh = tokenManager.refreshToken().catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(29_999);
    let settled = false;
    void refresh.then(() => { settled = true; });
    await Promise.resolve();
    expect(settled).toBe(false);

    await vi.advanceTimersByTimeAsync(1);
    const error = await refresh;

    expect(error).toBeInstanceOf(EtsyAuthError);
    expect((error as EtsyAuthError).code).toBe('TOKEN_REFRESH_TIMEOUT');
    const init = mockFetch.mock.calls[0]?.[1] as FetchInit;
    expect(init?.signal?.aborted).toBe(true);
  });

  it('uses tokenRefreshTimeoutMs from the config', async () => {
    const tokenManager = new TokenManager(config({ tokenRefreshTimeoutMs: 5_000 }));
    const refresh = tokenManager.refreshToken().catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(5_000);

    expect(await refresh).toMatchObject({ code: 'TOKEN_REFRESH_TIMEOUT' });
  });

  it('keeps the stored tokens and does not report REAUTH_REQUIRED', async () => {
    const storage = new MemoryTokenStorage();
    const save = vi.spyOn(storage, 'save');
    const refreshSave = vi.fn();
    const tokenManager = new TokenManager(config({ refreshSave }), storage);
    const refresh = tokenManager.refreshToken().catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(30_000);
    const error = await refresh;

    expect((error as EtsyAuthError).code).toBe('TOKEN_REFRESH_TIMEOUT');
    expect(tokenManager.getCurrentTokens()).toMatchObject({
      access_token: ORIGINAL_ACCESS,
      refresh_token: ORIGINAL_REFRESH
    });
    expect(save).not.toHaveBeenCalled();
    expect(refreshSave).not.toHaveBeenCalled();
  });

  it('times out even when fetch ignores the abort signal', async () => {
    mockFetch.mockImplementation(() => new Promise(() => undefined));
    const tokenManager = new TokenManager(config({ tokenRefreshTimeoutMs: 1_000 }));
    const refresh = tokenManager.refreshToken().catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(await refresh).toMatchObject({ code: 'TOKEN_REFRESH_TIMEOUT' });
  });

  it('times out when the response body never finishes', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: () => new Promise(() => undefined)
    });
    const tokenManager = new TokenManager(config({ tokenRefreshTimeoutMs: 1_000 }));
    const refresh = tokenManager.refreshToken().catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(await refresh).toMatchObject({ code: 'TOKEN_REFRESH_TIMEOUT' });
  });

  it('times out all concurrent callers sharing the refresh, and a later refresh can succeed', async () => {
    const tokenManager = new TokenManager(config({ tokenRefreshTimeoutMs: 1_000 }));
    const first = tokenManager.getAccessToken().catch((e: unknown) => e);
    const second = tokenManager.getAccessToken().catch((e: unknown) => e);

    await vi.advanceTimersByTimeAsync(1_000);

    expect(await first).toMatchObject({ code: 'TOKEN_REFRESH_TIMEOUT' });
    expect(await second).toMatchObject({ code: 'TOKEN_REFRESH_TIMEOUT' });
    expect(mockFetch).toHaveBeenCalledTimes(1);

    mockFetch.mockResolvedValue(okResponse());
    await expect(tokenManager.getAccessToken()).resolves.toBe('new-access-token');
  });

  it('clears its timer when the refresh answers in time', async () => {
    mockFetch.mockResolvedValue(okResponse());
    const tokenManager = new TokenManager(config());

    await expect(tokenManager.refreshToken()).resolves.toMatchObject({ access_token: 'new-access-token' });
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects tokenRefreshTimeoutMs = %s',
    (value) => {
      expect(() => new TokenManager(config({ tokenRefreshTimeoutMs: value }))).toThrow(RangeError);
    }
  );
});
