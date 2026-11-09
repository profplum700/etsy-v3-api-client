/**
 * Server proxy: createEtsyProxyClient() in the browser forwards calls to a
 * route that uses createEtsyProxyHandler() with a per-user EtsyClient, so the
 * shared secret and tokens never reach the browser (#107).
 */

import {
  ETSY_PROXY_METHODS,
  createEtsyProxyClient,
  createEtsyProxyHandler,
  type EtsyProxyHandlerOptions,
  type EtsyProxyTarget,
} from '../src/proxy';
import { EtsyApiError, EtsyAuthError, EtsyRateLimitError } from '../src/types';

const ORIGIN = 'https://shop.example';
const ENDPOINT = `${ORIGIN}/api/etsy`;

type FakeClient = Record<string, ReturnType<typeof vi.fn>>;

function fakeClient(overrides: Record<string, (...args: unknown[]) => unknown> = {}): FakeClient {
  const client: FakeClient = {};
  for (const method of ETSY_PROXY_METHODS) {
    client[method] = vi.fn(overrides[method] ?? ((...args: unknown[]) => Promise.resolve({ method, args })));
  }
  return client;
}

/** A proxy client whose fetch goes straight to the handler, as a same-origin browser request would. */
function connect(
  handlerOptions: EtsyProxyHandlerOptions,
  requestHeaders: Record<string, string> = { origin: ORIGIN }
): { proxy: EtsyProxyTarget; responses: Response[]; requests: Request[] } {
  const handler = createEtsyProxyHandler(handlerOptions);
  const responses: Response[] = [];
  const requests: Request[] = [];
  const proxy = createEtsyProxyClient({
    endpoint: ENDPOINT,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers);
      for (const [name, value] of Object.entries(requestHeaders)) headers.set(name, value);
      const request = new Request(String(input), { ...init, headers });
      requests.push(request.clone());
      const response = await handler(request);
      responses.push(response.clone());
      return response;
    },
  });
  return { proxy, responses, requests };
}

function post(body: unknown, headers: Record<string, string> = { origin: ORIGIN }): Request {
  return new Request(ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

describe('Etsy server proxy', () => {
  describe('round trip', () => {
    it('runs the call on the server client and returns its result', async () => {
      const client = fakeClient();
      const { proxy, responses } = connect({ getClient: () => client as unknown as EtsyProxyTarget });

      const result = await proxy.getListingsByShop('123', { limit: 5 });

      expect(client.getListingsByShop).toHaveBeenCalledWith('123', { limit: 5 });
      expect(result).toEqual({ method: 'getListingsByShop', args: ['123', { limit: 5 }] });
      expect(responses[0]!.headers.get('cache-control')).toBe('no-store');
    });

    it('returns undefined for methods that return nothing', async () => {
      const client = fakeClient({ deleteListing: () => Promise.resolve(undefined) });
      const { proxy } = connect({ getClient: () => client as unknown as EtsyProxyTarget });

      await expect(proxy.deleteListing('9')).resolves.toBeUndefined();
      expect(client.deleteListing).toHaveBeenCalledWith('9');
    });

    it('sends an image upload as multipart and hands the server a Blob', async () => {
      let received: { blob?: Blob; args?: unknown[] } = {};
      const client = fakeClient({
        uploadListingImage: async (...args: unknown[]) => {
          received = { blob: args[2] as Blob, args };
          return { listing_image_id: 1 };
        },
      });
      const { proxy, requests } = connect({ getClient: () => client as unknown as EtsyProxyTarget });

      const image = new Blob(['png-bytes'], { type: 'image/png' });
      const result = await proxy.uploadListingImage('1', '2', image, { rank: 1 });

      expect(requests[0]!.headers.get('content-type')).toContain('multipart/form-data');
      expect(result).toEqual({ listing_image_id: 1 });
      expect(received.args?.slice(0, 2)).toEqual(['1', '2']);
      expect(received.args?.[3]).toEqual({ rank: 1 });
      expect(received.blob).toBeInstanceOf(Blob);
      expect(await received.blob!.text()).toBe('png-bytes');
    });

    it('builds a client per request, from that request', async () => {
      const getClient = vi.fn((request: Request) =>
        fakeClient({ getShop: () => Promise.resolve({ user: request.headers.get('x-user') }) }) as unknown as EtsyProxyTarget
      );

      const alice = connect({ getClient }, { origin: ORIGIN, 'x-user': 'alice' }).proxy;
      const bob = connect({ getClient }, { origin: ORIGIN, 'x-user': 'bob' }).proxy;

      await expect(alice.getShop()).resolves.toEqual({ user: 'alice' });
      await expect(bob.getShop()).resolves.toEqual({ user: 'bob' });
      expect(getClient).toHaveBeenCalledTimes(2);
    });

    it('sends same-origin credentials and extra headers', async () => {
      const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ result: 1 }), { status: 200 }));
      const proxy = createEtsyProxyClient({ endpoint: '/api/etsy', headers: { 'x-csrf': 't' }, fetch: fetchSpy });

      await proxy.getShop('1');

      const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, { method?: string; credentials?: string; headers?: unknown; body?: unknown }];
      expect(url).toBe('/api/etsy');
      expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin' });
      expect(init.headers).toMatchObject({ 'x-csrf': 't', 'Content-Type': 'application/json' });
      expect(JSON.parse(String(init.body))).toEqual({ method: 'getShop', args: ['1'] });
    });
  });

  describe('errors keep their type across the hop', () => {
    it('EtsyAuthError keeps its code', async () => {
      const client = fakeClient({
        getShop: () => Promise.reject(new EtsyAuthError('Refresh token refused', 'REAUTH_REQUIRED')),
      });
      const { proxy, responses } = connect({ getClient: () => client as unknown as EtsyProxyTarget });

      const error = await proxy.getShop().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyAuthError);
      expect((error as EtsyAuthError).code).toBe('REAUTH_REQUIRED');
      expect((error as EtsyAuthError).message).toBe('Refresh token refused');
      expect(responses[0]!.status).toBe(401);
    });

    it('EtsyRateLimitError keeps retryAfter and errorType', async () => {
      const client = fakeClient({
        updateListing: () => Promise.reject(new EtsyRateLimitError('Slow down', 7, 'qps_exhausted')),
      });
      const { proxy, responses } = connect({ getClient: () => client as unknown as EtsyProxyTarget });

      const error = await proxy.updateListing('1', '2', {}).catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyRateLimitError);
      expect((error as EtsyRateLimitError).retryAfter).toBe(7);
      expect((error as EtsyRateLimitError).errorType).toBe('qps_exhausted');
      expect(responses[0]!.status).toBe(429);
      expect(responses[0]!.headers.get('retry-after')).toBe('7');
    });

    it('EtsyApiError keeps its status code and response body', async () => {
      const client = fakeClient({
        getListing: () => Promise.reject(new EtsyApiError('Not found', 404, { error: 'No listing' }, undefined, '/listings/5')),
      });
      const { proxy, responses } = connect({ getClient: () => client as unknown as EtsyProxyTarget });

      const error = await proxy.getListing('5').catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyApiError);
      expect((error as EtsyApiError).statusCode).toBe(404);
      expect((error as EtsyApiError).response).toEqual({ error: 'No listing' });
      expect((error as EtsyApiError).endpoint).toBe('/listings/5');
      expect(responses[0]!.status).toBe(404);
    });

    it('hides other errors behind a 500 and reports them to onError', async () => {
      const onError = vi.fn();
      const client = fakeClient({ getShop: () => Promise.reject(new Error('database password is hunter2')) });
      const { proxy, responses } = connect({ getClient: () => client as unknown as EtsyProxyTarget, onError });

      const error = await proxy.getShop().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyApiError);
      expect((error as Error).message).toBe('Internal server error');
      expect(responses[0]!.status).toBe(500);
      expect(onError).toHaveBeenCalledWith(expect.objectContaining({ message: 'database password is hunter2' }));
    });

    it('answers NO_TOKENS when getClient finds no signed-in user', async () => {
      const { proxy, responses } = connect({ getClient: () => null });

      const error = await proxy.getShop().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyAuthError);
      expect((error as EtsyAuthError).code).toBe('NO_TOKENS');
      expect(responses[0]!.status).toBe(401);
    });

    it('turns a non-JSON failure into an EtsyApiError with the HTTP status', async () => {
      const proxy = createEtsyProxyClient({
        endpoint: '/api/etsy',
        fetch: async () => new Response('<html>Bad gateway</html>', { status: 502 }),
      });

      const error = await proxy.getShop().catch((e: unknown) => e);

      expect(error).toBeInstanceOf(EtsyApiError);
      expect((error as EtsyApiError).statusCode).toBe(502);
    });
  });

  describe('allowlist', () => {
    it.each(['getUser', 'constructor', '__proto__', 'toString', 42])('refuses %s', async (method) => {
      const client = fakeClient();
      const getClient = vi.fn(() => client as unknown as EtsyProxyTarget);
      const handler = createEtsyProxyHandler({ getClient });

      const response = await handler(post({ method, args: [] }));

      expect(response.status).toBe(400);
      expect(getClient).not.toHaveBeenCalled();
    });

    it('can be narrowed to fewer methods', async () => {
      const client = fakeClient();
      const handler = createEtsyProxyHandler({
        getClient: () => client as unknown as EtsyProxyTarget,
        methods: ['getShop'],
      });

      expect((await handler(post({ method: 'getShop', args: [] }))).status).toBe(200);
      expect((await handler(post({ method: 'deleteListing', args: ['1'] }))).status).toBe(400);
      expect(client.deleteListing).not.toHaveBeenCalled();
    });

    it.each([
      ['a path in an image ID', 'deleteListingImage', ['1', '2', '../../../../../listings/123']],
      ['a path in a shop ID', 'getShopReceipts', ['../users/me']],
      ['an encoded path in a listing ID', 'deleteListing', ['%2e%2e%2f123']],
      ['a non-numeric ID', 'getListing', ['abc']],
      ['a negative ID', 'getListing', [-1]],
      ['an object as an ID', 'deleteListing', [{ toString: '1' }]],
      ['a missing required ID', 'getListing', []],
    ])('refuses %s before calling Etsy', async (_label, method, args) => {
      const client = fakeClient();
      const getClient = vi.fn(() => client as unknown as EtsyProxyTarget);
      const handler = createEtsyProxyHandler({ getClient });

      const response = await handler(post({ method, args }));

      expect(response.status).toBe(400);
      expect(getClient).not.toHaveBeenCalled();
    });

    it('accepts numeric IDs as strings or numbers, and leaves out optional ones', async () => {
      const client = fakeClient();
      const handler = createEtsyProxyHandler({ getClient: () => client as unknown as EtsyProxyTarget });

      expect((await handler(post({ method: 'deleteListingImage', args: ['1', 2, '3'] }))).status).toBe(200);
      expect((await handler(post({ method: 'getShop', args: [] }))).status).toBe(200);
      expect((await handler(post({ method: 'getListingsByShop', args: [null, { limit: 5 }] }))).status).toBe(200);
      expect(client.deleteListingImage).toHaveBeenCalledWith('1', 2, '3');
    });

    it.each([
      ['a body that is not JSON', 'not json'],
      ['arguments that are not an array', { method: 'getShop', args: 'x' }],
      ['too many arguments', { method: 'getShop', args: [1, 2, 3, 4, 5] }],
    ])('refuses %s', async (_label, body) => {
      const client = fakeClient();
      const handler = createEtsyProxyHandler({ getClient: () => client as unknown as EtsyProxyTarget });

      expect((await handler(post(body))).status).toBe(400);
      expect(client.getShop).not.toHaveBeenCalled();
    });
  });

  describe('cross-site requests', () => {
    function handlerWith(options: Partial<EtsyProxyHandlerOptions> = {}): {
      handler: (request: Request) => Promise<Response>;
      client: FakeClient;
    } {
      const client = fakeClient();
      return { handler: createEtsyProxyHandler({ getClient: () => client as unknown as EtsyProxyTarget, ...options }), client };
    }

    it('refuses another origin', async () => {
      const { handler, client } = handlerWith();

      const response = await handler(post({ method: 'deleteListing', args: ['1'] }, { origin: 'https://evil.example' }));

      expect(response.status).toBe(403);
      expect(client.deleteListing).not.toHaveBeenCalled();
    });

    it('refuses a multipart request from another origin, which needs no preflight', async () => {
      const { handler, client } = handlerWith();
      const form = new FormData();
      form.append('method', 'deleteListing');
      form.append('args', '["1"]');

      const response = await handler(
        new Request(ENDPOINT, { method: 'POST', headers: { origin: 'https://evil.example' }, body: form })
      );

      expect(response.status).toBe(403);
      expect(client.deleteListing).not.toHaveBeenCalled();
    });

    it('refuses a request with no Origin unless the browser marks it same-origin', async () => {
      const { handler } = handlerWith();

      expect((await handler(post({ method: 'getShop', args: [] }, {}))).status).toBe(403);
      expect((await handler(post({ method: 'getShop', args: [] }, { 'sec-fetch-site': 'same-origin' }))).status).toBe(200);
    });

    it('accepts origins listed in allowedOrigins', async () => {
      const { handler } = handlerWith({ allowedOrigins: ['https://www.shop.example'] });

      const response = await handler(post({ method: 'getShop', args: [] }, { origin: 'https://www.shop.example' }));

      expect(response.status).toBe(200);
    });

    it('accepts only POST', async () => {
      const { handler } = handlerWith();

      const response = await handler(new Request(ENDPOINT, { method: 'GET', headers: { origin: ORIGIN } }));

      expect(response.status).toBe(405);
      expect(response.headers.get('allow')).toBe('POST');
    });
  });
});
