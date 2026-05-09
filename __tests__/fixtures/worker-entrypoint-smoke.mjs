import {
  EtsyClient,
  EtsyApiError,
  EtsyRateLimiter,
  DurableObjectTokenVault,
  TokenVaultClient
} from '../../dist/worker.esm.js';

export default {
  async fetch() {
    const client = new EtsyClient({
      keystring: 'test-key',
      sharedSecret: 'test-secret',
      accessToken: 'test-access',
      refreshToken: 'test-refresh',
      expiresAt: new Date(Date.now() + 60_000),
      rateLimiting: { enabled: false },
      caching: { enabled: false },
      baseUrl: 'https://example.invalid/v3/application'
    });

    return Response.json({
      client: client.constructor.name,
      apiError: typeof EtsyApiError,
      rateLimiter: typeof EtsyRateLimiter,
      durableObjectTokenVault: typeof DurableObjectTokenVault,
      tokenVaultClient: typeof TokenVaultClient,
      process: typeof process,
      buffer: typeof Buffer,
      window: typeof window
    });
  }
};
