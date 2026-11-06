/**
 * EtsyClient.clearTokens() ends the session: no token, and no cached answers
 * served from before it.
 */

import { EtsyClient } from '../src/client';
import { EtsyAuthError, type CacheStorage, type EtsyClientConfig } from '../src/types';
import { vi, type Mock } from 'vitest';

function config(overrides: Partial<EtsyClientConfig> = {}): EtsyClientConfig {
  return {
    keystring: 'test-api-key',
    sharedSecret: 'test-shared-secret',
    accessToken: 'test-access-token',
    refreshToken: 'test-refresh-token',
    expiresAt: new Date(Date.now() + 3600000),
    rateLimiting: { enabled: false },
    ...overrides
  };
}

function userResponse() {
  return {
    ok: true,
    status: 200,
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({ user_id: 1 })
  };
}

describe('EtsyClient.clearTokens', () => {
  let mockFetch: Mock;

  beforeEach(() => {
    mockFetch = vi.fn().mockImplementation(async () => userResponse());
    (global as unknown as { fetch: Mock }).fetch = mockFetch;
  });

  it('stops serving cached GETs once tokens are cleared', async () => {
    const client = new EtsyClient(config());
    await expect(client.getUser()).resolves.toEqual({ user_id: 1 });
    await expect(client.getUser()).resolves.toEqual({ user_id: 1 });
    expect(mockFetch).toHaveBeenCalledTimes(1); // second answer came from the cache

    await client.clearTokens();

    const error = await client.getUser().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(EtsyAuthError);
    expect((error as EtsyAuthError).code).toBe('NO_TOKENS');
    expect(client.getCurrentTokens()).toBeNull();
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does not cache the answer of a GET that was in flight during clearTokens', async () => {
    let answer: ((value: unknown) => void) | undefined;
    mockFetch.mockImplementationOnce(() => new Promise((resolve) => { answer = resolve; }));
    const client = new EtsyClient(config());
    const inFlight = client.getUser();
    await vi.waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));

    await client.clearTokens();
    answer?.(userResponse());

    // The caller that sent the request still gets its answer...
    await expect(inFlight).resolves.toEqual({ user_id: 1 });
    // ...but it is not cached, so no later call is served without a token.
    await expect(client.getUser()).rejects.toMatchObject({ code: 'NO_TOKENS' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('clears a custom cache storage', async () => {
    const storage: CacheStorage = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      clear: vi.fn().mockResolvedValue(undefined)
    };
    const client = new EtsyClient(config({ caching: { enabled: true, storage } }));

    await client.clearTokens();

    expect(storage.clear).toHaveBeenCalledTimes(1);
  });

  it('still clears the cache when clearing durable tokens fails', async () => {
    // refreshSaveAsync without refreshClearAsync cannot clear durable tokens.
    const client = new EtsyClient(config({ refreshSaveAsync: vi.fn().mockResolvedValue(undefined) }));
    await client.getUser();

    await expect(client.clearTokens()).rejects.toMatchObject({ code: 'TOKEN_CLEAR_CALLBACK_REQUIRED' });

    await expect(client.getUser()).rejects.toMatchObject({ code: 'NO_TOKENS' });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('works when caching is disabled', async () => {
    const client = new EtsyClient(config({ caching: { enabled: false } }));

    await expect(client.clearTokens()).resolves.toBeUndefined();
    expect(client.getCurrentTokens()).toBeNull();
  });
});
