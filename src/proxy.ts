/**
 * Server proxy for browser apps.
 *
 * `EtsyClient` needs your app's shared secret and the user's tokens, so it
 * must not run in a public web page. Instead the page uses
 * `createEtsyProxyClient()`, which sends each call to a route on your server.
 * The route uses `createEtsyProxyHandler()` to run the call on a real
 * `EtsyClient` for the signed-in user and return the result, or the error
 * with its type and code.
 *
 * The wire format is internal to this module: both halves come from the same
 * package version.
 */

import type { EtsyClient } from './client';
import {
  EtsyApiError,
  EtsyAuthError,
  EtsyRateLimitError,
  type RateLimitErrorType,
} from './types';

/**
 * The client methods the proxy can run: the ones `@profplum700/etsy-react`'s
 * hooks use. Each one acts on the signed-in user's own Etsy data, so Etsy
 * itself checks the user may do it.
 */
export const ETSY_PROXY_METHODS = [
  'getShop',
  'getShopSections',
  'getListingsByShop',
  'getListing',
  'getShopReceipts',
  'getShopReceipt',
  'updateListing',
  'createDraftListing',
  'deleteListing',
  'updateListingInventory',
  'uploadListingImage',
  'deleteListingImage',
  'updateShopReceipt',
  'createShopShippingProfile',
] as const;

export type EtsyProxyMethod = (typeof ETSY_PROXY_METHODS)[number];

/** The part of `EtsyClient` the proxy forwards. `createEtsyProxyClient()` returns one. */
export type EtsyProxyTarget = Pick<EtsyClient, EtsyProxyMethod>;

/** No proxied method takes more arguments than this. */
const MAX_ARGS = 4;

/**
 * The leading arguments of each method that are Etsy IDs. `EtsyClient` puts
 * them in the request path, so a value like `../../listings/123` would reach
 * a different endpoint than the method allows. Each must be a plain numeric
 * ID. `optional` IDs may also be left out.
 */
const ID_ARGS: Record<EtsyProxyMethod, ReadonlyArray<'required' | 'optional'>> = {
  getShop: ['optional'],
  getShopSections: ['optional'],
  getListingsByShop: ['optional'],
  getListing: ['required'],
  getShopReceipts: ['required'],
  getShopReceipt: ['required', 'required'],
  updateListing: ['required', 'required'],
  createDraftListing: ['required'],
  deleteListing: ['required'],
  updateListingInventory: ['required'],
  uploadListingImage: ['required', 'required'],
  deleteListingImage: ['required', 'required', 'required'],
  updateShopReceipt: ['required', 'required'],
  createShopShippingProfile: ['required'],
};

/** Whether `value` is a plain Etsy ID: digits only, as a string or a non-negative integer. */
function isEtsyId(value: unknown): boolean {
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0;
  return typeof value === 'string' && /^[0-9]+$/.test(value);
}

/** Whether every ID argument of `method` is a plain Etsy ID (or left out, where optional). */
function hasValidIds(method: EtsyProxyMethod, args: unknown[]): boolean {
  return ID_ARGS[method].every((kind, index) => {
    const value = args[index];
    if (value === undefined || value === null) return kind === 'optional';
    return isEtsyId(value);
  });
}
/** Marks a Blob argument sent as a separate multipart field. */
const BLOB_MARKER = '$etsyProxyBlob';

interface SerializedError {
  name: string;
  message: string;
  code?: string;
  statusCode?: number;
  response?: unknown;
  retryAfter?: number;
  errorType?: RateLimitErrorType;
  endpoint?: string;
}

// ============================================================================
// Server
// ============================================================================

export interface EtsyProxyHandlerOptions {
  /**
   * Return an `EtsyClient` for the user who sent this request, built from
   * that user's tokens. Build a new one per request: a shared client would
   * act on one user's Etsy account for everyone. Return `null` when the user
   * isn't signed in; the proxy answers 401 with `EtsyAuthError` code
   * `NO_TOKENS`.
   */
  getClient: (request: Request) => Promise<EtsyProxyTarget | null | undefined> | EtsyProxyTarget | null | undefined;
  /** The methods to allow. Defaults to all of `ETSY_PROXY_METHODS`; list fewer to narrow it. */
  methods?: readonly EtsyProxyMethod[];
  /**
   * Origins allowed to call the proxy besides the request's own origin, for
   * example when a reverse proxy changes the host your server sees. Requests
   * from any other origin are refused, so another site can't make a signed-in
   * user's browser change their shop.
   */
  allowedOrigins?: readonly string[];
  /** Called with errors that aren't Etsy errors, before the proxy answers 500. Defaults to `console.error`. */
  onError?: (error: unknown) => void;
}

/** A JSON response that is never cached: proxy results are one user's private data. */
function jsonResponse(body: unknown, status: number, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

/** A JSON error response in the wire format `createEtsyProxyClient()` reads. */
function errorResponse(error: SerializedError, status: number, headers?: Record<string, string>): Response {
  return jsonResponse({ error }, status, headers);
}

/**
 * Refuse cross-site requests. Browsers send `Origin` with every POST, and a
 * cookie-authenticated route must not run writes for other sites' pages.
 */
function isAllowedOrigin(request: Request, allowedOrigins: readonly string[]): boolean {
  const origin = request.headers.get('origin');
  if (!origin) {
    return request.headers.get('sec-fetch-site') === 'same-origin';
  }
  return origin === new URL(request.url).origin || allowedOrigins.includes(origin);
}

/**
 * Read `{ method, args }` from a JSON body, or from a multipart body whose
 * Blob arguments travel as separate fields.
 */
async function readCall(request: Request): Promise<{ method: unknown; args: unknown }> {
  const contentType = request.headers.get('content-type') ?? '';
  if (contentType.includes('multipart/form-data')) {
    const form = await request.formData();
    const args = JSON.parse(String(form.get('args') ?? '[]')) as unknown;
    const restored = Array.isArray(args)
      ? args.map((arg) => {
          if (arg && typeof arg === 'object' && BLOB_MARKER in arg) {
            const field = form.get(`blob${Number((arg as Record<string, unknown>)[BLOB_MARKER])}`);
            if (!(field instanceof Blob)) throw new SyntaxError('Missing file field');
            return field;
          }
          return arg;
        })
      : args;
    return { method: form.get('method'), args: restored };
  }
  const body = (await request.json()) as { method?: unknown; args?: unknown } | null;
  return { method: body?.method, args: body?.args ?? [] };
}

/** Turn an Etsy error into its wire form and HTTP status. */
function serializeError(error: unknown): { body: SerializedError; status: number; headers?: Record<string, string> } | null {
  if (error instanceof EtsyRateLimitError) {
    return {
      body: { name: 'EtsyRateLimitError', message: error.message, retryAfter: error.retryAfter, errorType: error.errorType },
      status: 429,
      headers: error.retryAfter !== undefined ? { 'Retry-After': String(error.retryAfter) } : undefined,
    };
  }
  if (error instanceof EtsyAuthError) {
    return { body: { name: 'EtsyAuthError', message: error.message, code: error.code }, status: 401 };
  }
  if (error instanceof EtsyApiError) {
    const statusCode = error.statusCode;
    return {
      body: {
        name: 'EtsyApiError',
        message: error.message,
        statusCode,
        response: error.response,
        retryAfter: error._retryAfter,
        endpoint: error.endpoint,
      },
      status: statusCode !== undefined && statusCode >= 400 && statusCode <= 599 ? statusCode : 502,
    };
  }
  return null;
}

/**
 * Create the server half of the proxy: a `(request: Request) => Promise<Response>`
 * handler for any server that speaks the Fetch API (Next.js Route Handlers,
 * Remix, Hono, Deno, Bun, Cloudflare Workers, and Node 18+ via an adapter).
 *
 * It accepts only `POST` from the request's own origin (or `allowedOrigins`),
 * runs only allowlisted methods, never caches responses, and returns Etsy
 * errors with their type and code so `createEtsyProxyClient()` can throw the
 * same error classes in the browser.
 *
 * @example
 * ```typescript
 * const handler = createEtsyProxyHandler({
 *   getClient: async (request) => {
 *     const user = await getSessionUser(request);   // your app's auth
 *     if (!user) return null;
 *     const tokens = await loadEtsyTokens(user.id); // your token storage
 *     return new EtsyClient({ keystring, sharedSecret, ...tokens });
 *   },
 * });
 * ```
 */
export function createEtsyProxyHandler(options: EtsyProxyHandlerOptions): (request: Request) => Promise<Response> {
  const allowed = new Set<string>(options.methods ?? ETSY_PROXY_METHODS);
  const allowedOrigins = options.allowedOrigins ?? [];
  const onError = options.onError ?? ((error: unknown): void => console.error('Etsy proxy error:', error));

  return async function etsyProxyHandler(request: Request): Promise<Response> {
    if (request.method !== 'POST') {
      return errorResponse({ name: 'Error', message: 'Method not allowed' }, 405, { Allow: 'POST' });
    }
    if (!isAllowedOrigin(request, allowedOrigins)) {
      return errorResponse({ name: 'Error', message: 'Cross-origin request refused' }, 403);
    }

    let call: { method: unknown; args: unknown };
    try {
      call = await readCall(request);
    } catch {
      return errorResponse({ name: 'Error', message: 'Invalid request body' }, 400);
    }
    const { method, args } = call;
    if (typeof method !== 'string' || !allowed.has(method)) {
      return errorResponse({ name: 'Error', message: `Method not allowed: ${String(method)}` }, 400);
    }
    if (!Array.isArray(args) || args.length > MAX_ARGS || !hasValidIds(method as EtsyProxyMethod, args)) {
      return errorResponse({ name: 'Error', message: 'Invalid arguments' }, 400);
    }

    try {
      const client = await options.getClient(request);
      if (!client) {
        return errorResponse({ name: 'EtsyAuthError', message: 'Not signed in to Etsy', code: 'NO_TOKENS' }, 401);
      }
      const fn = (client as unknown as Record<string, unknown>)[method];
      if (typeof fn !== 'function') {
        throw new Error(`The client from getClient() has no ${method}() method`);
      }
      const result: unknown = await (fn as (...a: unknown[]) => Promise<unknown>).apply(client, args);
      return jsonResponse({ result: result ?? null }, 200);
    } catch (error) {
      const serialized = serializeError(error);
      if (serialized) return errorResponse(serialized.body, serialized.status, serialized.headers);
      onError(error);
      return errorResponse({ name: 'Error', message: 'Internal server error' }, 500);
    }
  };
}

// ============================================================================
// Browser
// ============================================================================

export interface EtsyProxyClientOptions {
  /** The URL of your proxy route, for example `/api/etsy`. */
  endpoint: string;
  /** Extra headers for each request, for example your app's CSRF token. */
  headers?: Record<string, string>;
  /** A `fetch` implementation. Defaults to the global one. */
  fetch?: typeof fetch;
}

/** Rebuild the error the server threw, so callers can use `instanceof` as with `EtsyClient`. */
function deserializeError(error: SerializedError | undefined, status: number): Error {
  switch (error?.name) {
    case 'EtsyAuthError':
      return new EtsyAuthError(error.message, error.code);
    case 'EtsyRateLimitError':
      return new EtsyRateLimitError(error.message, error.retryAfter, error.errorType);
    case 'EtsyApiError':
      return new EtsyApiError(error.message, error.statusCode, error.response, error.retryAfter, error.endpoint);
    default:
      return new EtsyApiError(error?.message ?? `Etsy proxy request failed: ${status}`, status);
  }
}

/**
 * Create the browser half of the proxy: an object with the same methods as
 * `EtsyClient` for the hooks in `@profplum700/etsy-react`, which sends each
 * call to your server's proxy route instead of to Etsy. The shared secret and
 * the user's tokens stay on the server.
 *
 * Errors come back as the same classes `EtsyClient` throws: `EtsyApiError`,
 * `EtsyAuthError` (with `code`, for example `REAUTH_REQUIRED`) and
 * `EtsyRateLimitError` (with `retryAfter`).
 *
 * @example
 * ```tsx
 * const client = createEtsyProxyClient({ endpoint: '/api/etsy' });
 *
 * <EtsyProvider client={client}>
 *   <App />
 * </EtsyProvider>
 * ```
 */
export function createEtsyProxyClient(options: EtsyProxyClientOptions): EtsyProxyTarget {
  const doFetch = options.fetch ?? ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => fetch(input, init));

  /** Send one call to the proxy route and return its result, or throw the error it reports. */
  async function call(method: EtsyProxyMethod, args: unknown[]): Promise<unknown> {
    const hasBlob = typeof Blob !== 'undefined' && args.some((arg) => arg instanceof Blob);
    let body: BodyInit;
    const headers: Record<string, string> = { ...options.headers };
    if (hasBlob) {
      const form = new FormData();
      let blobIndex = 0;
      const encoded = args.map((arg) => {
        if (arg instanceof Blob) {
          form.append(`blob${blobIndex}`, arg);
          return { [BLOB_MARKER]: blobIndex++ };
        }
        return arg;
      });
      form.append('method', method);
      form.append('args', JSON.stringify(encoded));
      body = form;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify({ method, args });
    }

    const response = await doFetch(options.endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers,
      body,
    });

    let payload: { result?: unknown; error?: SerializedError } | undefined;
    try {
      payload = (await response.json()) as typeof payload;
    } catch {
      payload = undefined;
    }
    if (!response.ok) {
      throw deserializeError(payload?.error, response.status);
    }
    return payload?.result ?? undefined;
  }

  const client = {} as Record<EtsyProxyMethod, (...args: unknown[]) => Promise<unknown>>;
  for (const method of ETSY_PROXY_METHODS) {
    client[method] = (...args: unknown[]): Promise<unknown> => call(method, args);
  }
  return client as unknown as EtsyProxyTarget;
}
