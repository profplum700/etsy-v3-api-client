/**
 * getEtsyServerClient must build a client per request. A Next.js server serves
 * many users from one process, so a client cached across requests would carry
 * one user's tokens into another user's request.
 */

import { vi } from 'vitest';

// The cookie store that next/headers returns for the "current request"
let requestCookies = new Map<string, string>();

vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: (name: string) => {
        const value = requestCookies.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: vi.fn(),
    })
  ),
}));

const constructed: Array<Record<string, unknown>> = [];
vi.mock('@profplum700/etsy-v3-api-client', () => ({
  EtsyClient: vi.fn(function (this: Record<string, unknown>, config: Record<string, unknown>) {
    constructed.push(config);
    this.config = config;
  }),
}));

import { configureEtsyServerClient, getEtsyServerClient } from '../client';

function signInAs(user: string): void {
  requestCookies = new Map([
    [
      'etsy-tokens',
      JSON.stringify({
        accessToken: `${user}-access`,
        refreshToken: `${user}-refresh`,
        expiresAt: '2030-01-01T00:00:00.000Z',
      }),
    ],
  ]);
}

describe('getEtsyServerClient', () => {
  beforeEach(() => {
    constructed.length = 0;
    configureEtsyServerClient({ apiKey: 'key', sharedSecret: 'secret' });
  });

  it("builds each request's client from that request's cookies", async () => {
    signInAs('alice');
    const alice = (await getEtsyServerClient()) as unknown as { config: Record<string, unknown> };

    signInAs('bob');
    const bob = (await getEtsyServerClient()) as unknown as { config: Record<string, unknown> };

    expect(bob).not.toBe(alice);
    expect(alice.config.accessToken).toBe('alice-access');
    expect(bob.config.accessToken).toBe('bob-access');
    expect(bob.config.refreshToken).toBe('bob-refresh');
    expect(constructed).toHaveLength(2);
  });

  it('passes the configured keystring and shared secret', async () => {
    signInAs('alice');
    await getEtsyServerClient();

    expect(constructed[0]).toMatchObject({ keystring: 'key', sharedSecret: 'secret' });
    expect(constructed[0].expiresAt).toEqual(new Date('2030-01-01T00:00:00.000Z'));
  });

  it('throws when the request has no token cookie', async () => {
    requestCookies = new Map();
    await expect(getEtsyServerClient()).rejects.toThrow('No authentication tokens found in cookies');
  });
});
