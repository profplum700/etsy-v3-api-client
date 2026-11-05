/**
 * EtsyClient forwards a TokenStorage to its TokenManager, so refreshed
 * tokens are persisted (README "Token Storage" usage).
 */

import { type Mock } from 'vitest';
import { EtsyClient } from '../src/client';
import { MemoryTokenStorage } from '../src/auth/token-manager';
import type { EtsyClientConfig, EtsyTokens } from '../src/types';

describe('EtsyClient token storage', () => {
  const expired = new Date(Date.now() - 60_000);
  let mockFetch: Mock;

  const config = (): EtsyClientConfig => ({
    keystring: 'test-api-key',
    sharedSecret: 'test-shared-secret',
    accessToken: 'old-access-token',
    refreshToken: 'old-refresh-token',
    expiresAt: expired,
    rateLimiting: { enabled: false },
    caching: { enabled: false }
  });

  beforeEach(() => {
    mockFetch = vi.fn(async (url: string) => {
      if (url.includes('/oauth/token')) {
        return new Response(JSON.stringify({
          access_token: 'new-access-token',
          refresh_token: 'new-refresh-token',
          expires_in: 3600,
          token_type: 'Bearer'
        }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify({ user_id: 1 }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    });
    (global as unknown as { fetch: Mock }).fetch = mockFetch;
  });

  it('saves refreshed tokens to the storage passed to the constructor', async () => {
    const storage = new MemoryTokenStorage();
    const save = vi.spyOn(storage, 'save');
    const client = new EtsyClient(config(), storage);

    await client.getUser();

    expect(save).toHaveBeenCalledTimes(1);
    const saved = (await storage.load()) as EtsyTokens;
    expect(saved.access_token).toBe('new-access-token');
    expect(saved.refresh_token).toBe('new-refresh-token');

    const apiCall = mockFetch.mock.calls.find(([url]) => !String(url).includes('/oauth/token'));
    expect((apiCall?.[1]?.headers as Record<string, string>).Authorization).toBe('Bearer new-access-token');
  });

  it('saves to storage before calling refreshSaveAsync', async () => {
    const order: string[] = [];
    const storage = new MemoryTokenStorage();
    vi.spyOn(storage, 'save').mockImplementation(async () => { order.push('storage'); });
    const client = new EtsyClient({
      ...config(),
      refreshSaveAsync: async () => { order.push('callback'); },
      refreshClearAsync: async () => undefined
    }, storage);

    await client.getUser();

    expect(order).toEqual(['storage', 'callback']);
  });

  it('still works without storage', async () => {
    const client = new EtsyClient(config());
    await expect(client.getUser()).resolves.toEqual({ user_id: 1 });
  });
});
