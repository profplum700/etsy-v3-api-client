import {
  EtsyClient,
  EtsyApiError,
  EtsyRateLimiter
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
      process: typeof process,
      buffer: typeof Buffer,
      window: typeof window
    });
  }
};
