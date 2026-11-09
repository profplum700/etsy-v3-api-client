/**
 * createEtsyApiRoute: the server side of the etsy-react proxy (#107). Each
 * request builds a client from that user's token cookie, runs one allowlisted
 * method against Etsy, and returns the result or a typed error.
 */

import { vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// The cookie store next/headers returns for the "current request".
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

import { createEtsyApiRoute } from '../src/server/route';
import { configureEtsyServerClient } from '../src/server/client';

const ORIGIN = 'http://localhost:3000';

function signInAs(user: string): void {
  requestCookies = new Map([
    [
      'etsy-tokens',
      JSON.stringify({
        accessToken: `${user}-access`,
        refreshToken: `${user}-refresh`,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    ],
  ]);
}

function call(method: string, args: unknown[] = [], headers: Record<string, string> = { origin: ORIGIN }): NextRequest {
  return new NextRequest(`${ORIGIN}/api/etsy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify({ method, args }),
  });
}

let etsyFetch: Mock;

beforeEach(() => {
  configureEtsyServerClient({ apiKey: 'test-key', sharedSecret: 'test-secret' });
  etsyFetch = vi.fn(async () =>
    new Response(JSON.stringify({ shop_id: 1, shop_name: 'Test Shop' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })
  );
  vi.stubGlobal('fetch', etsyFetch);
  requestCookies = new Map();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createEtsyApiRoute', () => {
  it('runs the call for the signed-in user and returns the result', async () => {
    signInAs('alice');
    const { POST } = createEtsyApiRoute();

    const response = await POST(call('getShop', ['1']));

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual({ result: { shop_id: 1, shop_name: 'Test Shop' } });

    const [url, init] = etsyFetch.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(url).toBe('https://api.etsy.com/v3/application/shops/1');
    expect(init.headers).toMatchObject({ Authorization: 'Bearer alice-access', 'x-api-key': 'test-key:test-secret' });
  });

  it("uses each request's own tokens", async () => {
    const { POST } = createEtsyApiRoute();

    signInAs('alice');
    await POST(call('getShop', ['1']));
    signInAs('bob');
    await POST(call('getShop', ['1']));

    const authorizations = etsyFetch.mock.calls.map(
      ([, init]) => (init as { headers: Record<string, string> }).headers.Authorization
    );
    expect(authorizations).toEqual(['Bearer alice-access', 'Bearer bob-access']);
  });

  it('answers 401 NO_TOKENS when the user has no token cookie', async () => {
    const { POST } = createEtsyApiRoute();

    const response = await POST(call('getShop', ['1']));

    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatchObject({ name: 'EtsyAuthError', code: 'NO_TOKENS' });
    expect(etsyFetch).not.toHaveBeenCalled();
  });

  it('answers 401 NO_TOKENS when the token cookie cannot be read', async () => {
    requestCookies = new Map([['etsy-tokens', 'not json']]);
    const { POST } = createEtsyApiRoute();

    const response = await POST(call('getShop', ['1']));

    expect(response.status).toBe(401);
    expect((await response.json()).error).toMatchObject({ name: 'EtsyAuthError', code: 'NO_TOKENS' });
  });

  it('refuses a path in an ID argument', async () => {
    signInAs('alice');
    const { POST } = createEtsyApiRoute({ methods: ['deleteListingImage'] });

    const response = await POST(call('deleteListingImage', ['1', '2', '../../../../../listings/123']));

    expect(response.status).toBe(400);
    expect(etsyFetch).not.toHaveBeenCalled();
  });

  it("passes Etsy's errors on with their status", async () => {
    signInAs('alice');
    etsyFetch.mockResolvedValueOnce(new Response('{"error":"Listing not found"}', { status: 404, statusText: 'Not Found' }));
    const { POST } = createEtsyApiRoute();

    const response = await POST(call('getListing', ['5']));

    expect(response.status).toBe(404);
    expect((await response.json()).error).toMatchObject({ name: 'EtsyApiError', statusCode: 404 });
  });

  it('refuses requests from another origin', async () => {
    signInAs('alice');
    const { POST } = createEtsyApiRoute();

    const response = await POST(call('deleteListing', ['1'], { origin: 'https://evil.example' }));

    expect(response.status).toBe(403);
    expect(etsyFetch).not.toHaveBeenCalled();
  });

  it('refuses methods outside the allowlist', async () => {
    signInAs('alice');
    const { POST } = createEtsyApiRoute({ methods: ['getShop'] });

    expect((await POST(call('getUser'))).status).toBe(400);
    expect((await POST(call('deleteListing', ['1']))).status).toBe(400);
    expect(etsyFetch).not.toHaveBeenCalled();
  });

  it('answers 405 to anything but POST', async () => {
    const { GET, PUT, DELETE } = createEtsyApiRoute();

    for (const handler of [GET, PUT, DELETE]) {
      const response = await handler(new NextRequest(`${ORIGIN}/api/etsy`, { headers: { origin: ORIGIN } }));
      expect(response.status).toBe(405);
    }
  });

  it('still accepts the old configuration shape', () => {
    expect(() =>
      createEtsyApiRoute({ apiKey: 'test-key', rateLimit: { requests: 100, window: 60000 }, cache: { enabled: true, ttl: 300 } })
    ).not.toThrow();
  });
});
