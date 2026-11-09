/**
 * createEtsyMiddleware refreshes tokens that are close to expiry before a
 * Server Component renders, while cookies can still be set. A refresh during
 * render spends the refresh token without saving the new one (#111).
 */

import { vi, type Mock } from 'vitest';
import { NextRequest } from 'next/server';

// The cookie store that next/headers returns while a Server Component renders.
let renderCookies = new Map<string, string>();
const renderCookieSet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: vi.fn(() =>
    Promise.resolve({
      get: (name: string) => {
        const value = renderCookies.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: renderCookieSet,
    })
  ),
}));

import { createEtsyMiddleware } from '../../middleware';
import { createEtsyServerClient } from '../client';

const TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

function tokenCookie(refreshToken: string, expiresInMs: number, accessToken = 'old-access'): string {
  return JSON.stringify({
    accessToken,
    refreshToken,
    expiresAt: new Date(Date.now() + expiresInMs).toISOString(),
  });
}

function requestWith(cookies: Record<string, string>): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('; ');
  return new NextRequest('http://localhost/dashboard', { headers: { cookie } });
}

/** The cookies the rest of the request (Server Components) will see. */
function forwardedCookies(response: Response): NextRequest['cookies'] {
  const header = response.headers.get('x-middleware-request-cookie') ?? '';
  return new NextRequest('http://localhost/', { headers: { cookie: header } }).cookies;
}

function setCookieNames(response: Response): string[] {
  return response.headers.getSetCookie().map((cookie) => cookie.split('=')[0]);
}

let fetchMock: Mock;

function tokenResponse(n: number): Response {
  return new Response(
    JSON.stringify({
      access_token: `new-access-${n}`,
      refresh_token: `new-refresh-${n}`,
      token_type: 'Bearer',
      expires_in: 3600,
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
}

beforeEach(() => {
  let refreshes = 0;
  fetchMock = vi.fn((url: string) =>
    Promise.resolve(
      url === TOKEN_URL
        ? tokenResponse(++refreshes)
        : new Response(JSON.stringify({ user_id: 1 }), {
            status: 200,
            headers: { 'content-type': 'application/json' },
          })
    )
  );
  vi.stubGlobal('fetch', fetchMock);
  renderCookies = new Map();
  renderCookieSet.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const tokenCalls = (): unknown[][] => fetchMock.mock.calls.filter(([url]) => url === TOKEN_URL);

describe('createEtsyMiddleware', () => {
  const middleware = createEtsyMiddleware({ apiKey: 'key' });

  it('passes requests without a token cookie through', async () => {
    const response = await middleware(requestWith({}));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(setCookieNames(response)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('leaves a token that is not close to expiry alone', async () => {
    const response = await middleware(requestWith({ 'etsy-tokens': tokenCookie('r1', 60 * 60 * 1000) }));

    expect(setCookieNames(response)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refreshes a token close to expiry, for the browser and for this request', async () => {
    const response = await middleware(requestWith({ 'etsy-tokens': tokenCookie('r1', 2 * 60 * 1000) }));

    expect(tokenCalls()).toHaveLength(1);
    const body = new URLSearchParams(String((tokenCalls()[0][1] as { body?: unknown }).body));
    expect(Object.fromEntries(body)).toEqual({ grant_type: 'refresh_token', client_id: 'key', refresh_token: 'r1' });

    expect(setCookieNames(response)).toEqual(
      expect.arrayContaining(['etsy-tokens', 'etsy_access_token', 'etsy_refresh_token', 'etsy_expires_at'])
    );
    const forwarded = JSON.parse(forwardedCookies(response).get('etsy-tokens')!.value);
    expect(forwarded).toMatchObject({ accessToken: 'new-access-1', refreshToken: 'new-refresh-1' });
  });

  it('refreshes a token that has already expired', async () => {
    const response = await middleware(requestWith({ 'etsy-tokens': tokenCookie('r1', -60 * 1000) }));

    expect(tokenCalls()).toHaveLength(1);
    expect(setCookieNames(response)).toContain('etsy-tokens');
  });

  it('shares one refresh between concurrent requests with the same refresh token', async () => {
    const cookie = tokenCookie('r1', 30 * 1000);
    const [first, second] = await Promise.all([
      middleware(requestWith({ 'etsy-tokens': cookie })),
      middleware(requestWith({ 'etsy-tokens': cookie })),
    ]);

    expect(tokenCalls()).toHaveLength(1);
    expect(JSON.parse(forwardedCookies(first).get('etsy-tokens')!.value).refreshToken).toBe('new-refresh-1');
    expect(JSON.parse(forwardedCookies(second).get('etsy-tokens')!.value).refreshToken).toBe('new-refresh-1');
  });

  it('leaves the cookies alone when Etsy refuses the refresh', async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"error":"invalid_grant"}', { status: 400 }));
    const logged = vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await middleware(requestWith({ 'etsy-tokens': tokenCookie('r1', 30 * 1000) }));

    expect(response.headers.get('x-middleware-next')).toBe('1');
    expect(setCookieNames(response)).toEqual([]);
    expect(logged).toHaveBeenCalled();
  });

  it('ignores a token cookie it cannot parse', async () => {
    const response = await middleware(requestWith({ 'etsy-tokens': 'not json' }));

    expect(setCookieNames(response)).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses a custom cookie name', async () => {
    const custom = createEtsyMiddleware({ apiKey: 'key', cookieName: 'my-etsy' });

    const response = await custom(requestWith({ 'my-etsy': tokenCookie('r1', 30 * 1000) }));

    expect(setCookieNames(response)).toContain('my-etsy');
    expect(setCookieNames(response)).not.toContain('etsy-tokens');
  });

  it('rejects a refresh window shorter than the client refresh buffer', () => {
    expect(() => createEtsyMiddleware({ apiKey: 'key', refreshWithinSeconds: 30 })).toThrow(
      'refreshWithinSeconds must be at least 60'
    );
  });

  it('without it, a render with a nearly expired token spends the refresh token (the #111 bug)', async () => {
    renderCookies = new Map([['etsy-tokens', tokenCookie('r1', 30 * 1000)]]);
    const client = await createEtsyServerClient({ apiKey: 'key', sharedSecret: 'secret' });
    await client.getUser().catch(() => undefined);

    expect(tokenCalls()).toHaveLength(1);
    expect(renderCookieSet).toHaveBeenCalled();
  });

  it('means a Server Component render never spends the refresh token', async () => {
    // Without the middleware, a client built from this cookie would refresh
    // during render: the token expires within EtsyClient's one-minute buffer.
    const response = await middleware(requestWith({ 'etsy-tokens': tokenCookie('r1', 30 * 1000) }));
    expect(tokenCalls()).toHaveLength(1);

    // Render this request with the cookies the middleware passed on.
    renderCookies = new Map([['etsy-tokens', forwardedCookies(response).get('etsy-tokens')!.value]]);
    const client = await createEtsyServerClient({ apiKey: 'key', sharedSecret: 'secret' });
    await client.getUser();

    // The client used the new token and didn't refresh, so nothing had to be
    // saved during render.
    expect(tokenCalls()).toHaveLength(1);
    expect(renderCookieSet).not.toHaveBeenCalled();
    const apiCall = fetchMock.mock.calls.find(([url]) => String(url).includes('/users/me'));
    expect((apiCall![1] as { headers?: unknown }).headers).toMatchObject({ Authorization: 'Bearer new-access-1' });
  });
});
