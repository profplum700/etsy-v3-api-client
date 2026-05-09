import {
  DurableObjectTokenVault,
  TokenVaultClient,
  type DurableObjectStateLike,
  type FetcherLike
} from '../../src/worker';
import { EtsyAuthError, EtsyTokens, TokenProvider } from '../../src/types';

class MemoryDurableObjectState implements DurableObjectStateLike {
  private readonly values = new Map<string, unknown>();
  private queue: Promise<void> = Promise.resolve();

  readonly storage = {
    get: async <T = unknown>(key: string): Promise<T | undefined> => this.values.get(key) as T | undefined,
    put: async <T = unknown>(key: string, value: T): Promise<void> => {
      this.values.set(key, value);
    },
    delete: async (key: string): Promise<boolean> => this.values.delete(key)
  };

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    const run = this.queue.then(callback, callback);
    this.queue = run.then(() => undefined, () => undefined);
    return run;
  }
}

function makeTokens(label: string, expiresAt: Date = new Date(Date.now() + 3_600_000)): EtsyTokens {
  return {
    access_token: `access-${label}`,
    refresh_token: `refresh-${label}`,
    expires_at: expiresAt,
    token_type: 'Bearer',
    scope: 'shops_r listings_r'
  };
}

function makeClient(vault: DurableObjectTokenVault): TokenVaultClient {
  const fetcher: FetcherLike = {
    fetch: (input, init) => vault.fetch(new Request(input, init))
  };
  return new TokenVaultClient(fetcher);
}

describe('DurableObjectTokenVault and TokenVaultClient', () => {
  it('stores, reads, and returns OAuth token bundles through the client', async () => {
    const vault = new DurableObjectTokenVault(new MemoryDurableObjectState());
    const client = makeClient(vault);
    const provider: TokenProvider = client;

    await expect(client.loadCurrentTokens()).resolves.toBeNull();

    const saved = await client.saveTokens(makeTokens('initial'));

    expect(client.getCurrentTokens()).toEqual(saved);
    await expect(provider.getAccessToken()).resolves.toBe('access-initial');
    await expect(client.loadCurrentTokens()).resolves.toMatchObject({
      access_token: 'access-initial',
      refresh_token: 'refresh-initial',
      token_type: 'Bearer'
    });
  });

  it('performs a single refresh for concurrent access-token requests', async () => {
    let refreshCalls = 0;
    let releaseRefresh: (() => void) | undefined;
    const refreshStarted = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    const vault = new DurableObjectTokenVault(new MemoryDurableObjectState(), {
      refreshTokens: async () => {
        refreshCalls += 1;
        await refreshStarted;
        return makeTokens('refreshed');
      }
    });
    const client = makeClient(vault);
    await client.saveTokens(makeTokens('expired', new Date(Date.now() - 1_000)));

    const first = client.getAccessToken();
    const second = client.getAccessToken();
    releaseRefresh?.();

    await expect(Promise.all([first, second])).resolves.toEqual([
      'access-refreshed',
      'access-refreshed'
    ]);
    expect(refreshCalls).toBe(1);
  });

  it('rejects stale token writes instead of overwriting a newer bundle', async () => {
    const vault = new DurableObjectTokenVault(new MemoryDurableObjectState());
    const client = makeClient(vault);

    await client.saveTokens(makeTokens('newer', new Date(Date.now() + 3_600_000)));

    await expect(client.saveTokens(makeTokens('older', new Date(Date.now() + 60_000))))
      .rejects.toMatchObject({
        name: 'EtsyAuthError',
        code: 'TOKEN_VAULT_STALE_WRITE'
      });

    await expect(client.getAccessToken()).resolves.toBe('access-newer');
  });

  it('rejects expected-version writes when another request already updated the vault', async () => {
    const vault = new DurableObjectTokenVault(new MemoryDurableObjectState());
    const client = makeClient(vault);

    await client.saveTokens(makeTokens('v1'));
    await client.saveTokens(makeTokens('v2', new Date(Date.now() + 7_200_000)), 1);

    await expect(client.saveTokens(makeTokens('v3', new Date(Date.now() + 10_800_000)), 1))
      .rejects.toMatchObject({ code: 'TOKEN_VAULT_STALE_WRITE' });

    await expect(client.getAccessToken()).resolves.toBe('access-v2');
  });

  it('propagates failed refreshes with secret-safe diagnostics', async () => {
    const secret = 'refresh-secret-that-must-not-leak';
    const vault = new DurableObjectTokenVault(new MemoryDurableObjectState(), {
      refreshTokens: async () => {
        throw new Error(secret);
      }
    });
    const client = makeClient(vault);
    await client.saveTokens(makeTokens('expired', new Date(Date.now() - 1_000)));

    let thrown: unknown;
    try {
      await client.getAccessToken();
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(EtsyAuthError);
    expect(thrown).toMatchObject({ code: 'TOKEN_VAULT_FETCH_FAILED' });
    expect(String(thrown)).not.toContain(secret);
    expect(JSON.stringify(thrown)).not.toContain(secret);
  });

  it('rejects stale refresh results if another writer updates the vault during refresh', async () => {
    const state = new MemoryDurableObjectState();
    let releaseRefresh: (() => void) | undefined;
    const refreshCanFinish = new Promise<void>((resolve) => {
      releaseRefresh = resolve;
    });
    let markRefreshStarted: (() => void) | undefined;
    const refreshStarted = new Promise<void>((resolve) => {
      markRefreshStarted = resolve;
    });
    const vault = new DurableObjectTokenVault(state, {
      refreshTokens: async () => {
        markRefreshStarted?.();
        await refreshCanFinish;
        return makeTokens('refreshed', new Date(Date.now() + 7_200_000));
      }
    });
    const client = makeClient(vault);
    await client.saveTokens(makeTokens('expired', new Date(Date.now() - 1_000)));

    const refreshPromise = client.refreshToken();
    await refreshStarted;
    await client.saveTokens(makeTokens('external-newer', new Date(Date.now() + 10_800_000)), 1);
    releaseRefresh?.();

    await expect(refreshPromise).resolves.toMatchObject({ access_token: 'access-external-newer' });
    await expect(client.getAccessToken()).resolves.toBe('access-external-newer');
  });
});
