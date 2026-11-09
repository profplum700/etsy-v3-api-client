/**
 * EtsyClient must hand rateLimiting.maxRequestsPerSecond to its rate limiter
 * in a way that actually sets the request spacing. It used to fill in a
 * default minRequestInterval, which hid maxRequestsPerSecond entirely.
 */

import { EtsyClient } from '../src/client';
import type { EtsyRateLimiter } from '../src/rate-limiting';
import type { EtsyClientConfig } from '../src/types';

const baseConfig: EtsyClientConfig = {
  keystring: 'test-api-key',
  sharedSecret: 'test-shared-secret',
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  expiresAt: new Date(Date.now() + 3600000),
};

function spacingOf(client: EtsyClient): number {
  return (client as unknown as { rateLimiter: EtsyRateLimiter }).rateLimiter.getConfig().minRequestInterval;
}

describe('EtsyClient rate limit config', () => {
  it('uses maxRequestsPerSecond to space requests', () => {
    const client = new EtsyClient({ ...baseConfig, rateLimiting: { enabled: true, maxRequestsPerSecond: 1 } });
    expect(spacingOf(client)).toBe(1000);
  });

  it('keeps an explicit minRequestInterval', () => {
    const client = new EtsyClient({ ...baseConfig, rateLimiting: { enabled: true, minRequestInterval: 400 } });
    expect(spacingOf(client)).toBe(400);
  });

  it('uses the stricter cap when both are set', () => {
    const client = new EtsyClient({
      ...baseConfig,
      rateLimiting: { enabled: true, maxRequestsPerSecond: 2, minRequestInterval: 100 },
    });
    expect(spacingOf(client)).toBe(500);
  });

  it('defaults to 200 ms when neither is set', () => {
    expect(spacingOf(new EtsyClient(baseConfig))).toBe(200);
  });
});
