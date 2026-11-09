/**
 * Clients given the same rateLimiting.limiter count against one local quota.
 * Per-request clients on a server (etsy-nextjs) rely on this: each request
 * builds its own client, and without a shared limiter each would start with a
 * fresh quota.
 */

import { EtsyClient } from '../src/client';
import { EtsyRateLimiter } from '../src/rate-limiting';
import { EtsyRateLimitError, type EtsyClientConfig } from '../src/types';

const baseConfig: EtsyClientConfig = {
  keystring: 'test-api-key',
  sharedSecret: 'test-shared-secret',
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: new Date(Date.now() + 3600000),
  // Every call must reach the limiter, not the response cache.
  caching: { enabled: false },
};

function okResponse(): Response {
  return new Response(JSON.stringify({ user_id: 1 }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('EtsyClient with a shared rate limiter', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(okResponse())));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('counts requests from every client against one quota', async () => {
    const limiter = new EtsyRateLimiter({ maxRequestsPerDay: 2, minRequestInterval: 0 });
    const first = new EtsyClient({ ...baseConfig, rateLimiting: { enabled: true, limiter } });
    const second = new EtsyClient({ ...baseConfig, rateLimiting: { enabled: true, limiter } });

    await first.getUser();
    await second.getUser();

    expect(first.getRemainingRequests()).toBe(0);
    await expect(first.getUser()).rejects.toMatchObject({
      constructor: EtsyRateLimitError,
      errorType: 'qpd_exhausted',
    });
    await expect(second.getUser()).rejects.toBeInstanceOf(EtsyRateLimitError);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps separate quotas for clients without a shared limiter', async () => {
    const config = { ...baseConfig, rateLimiting: { enabled: true, maxRequestsPerDay: 2, minRequestInterval: 0 } };
    const first = new EtsyClient(config);
    const second = new EtsyClient(config);

    await first.getUser();
    await second.getUser();

    expect(first.getRemainingRequests()).toBe(1);
    expect(second.getRemainingRequests()).toBe(1);
  });

  it("uses the shared limiter's configuration, not the client's other options", () => {
    const limiter = new EtsyRateLimiter({ maxRequestsPerDay: 7 });
    const client = new EtsyClient({
      ...baseConfig,
      rateLimiting: { enabled: true, limiter, maxRequestsPerDay: 9000 },
    });

    expect(client.getRemainingRequests()).toBe(7);
  });

  it('leaves the shared limiter alone when rate limiting is disabled', async () => {
    const limiter = new EtsyRateLimiter({ maxRequestsPerDay: 2, minRequestInterval: 0 });
    const client = new EtsyClient({ ...baseConfig, rateLimiting: { enabled: false, limiter } });

    await client.getUser();

    expect(limiter.getRemainingRequests()).toBe(2);
  });
});
