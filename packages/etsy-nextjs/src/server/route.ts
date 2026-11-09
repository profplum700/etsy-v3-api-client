import type { NextRequest } from 'next/server';
import { createEtsyProxyHandler, type EtsyProxyMethod } from '@profplum700/etsy-v3-api-client';
import { getEtsyServerClient } from './client';

export interface EtsyApiRouteConfig {
  /** The methods to allow. Defaults to every method the `@profplum700/etsy-react` hooks use; list fewer to narrow it. */
  methods?: readonly EtsyProxyMethod[];
  /** Origins allowed to call the route besides the request's own, for example behind a reverse proxy that changes the host. */
  allowedOrigins?: readonly string[];
  /** Called with errors that aren't Etsy errors, before the route answers 500. Defaults to `console.error`. */
  onError?: (error: unknown) => void;
  /** @deprecated Ignored. The route uses the configuration from `configureEtsyServerClient()`. */
  apiKey?: string;
  /** @deprecated Ignored. */
  redirectUri?: string;
  /** @deprecated Ignored. */
  scopes?: string[];
  /** @deprecated Ignored. Clients share one rate limiter per API key; see the README. */
  rateLimit?: {
    requests: number;
    window: number; // in milliseconds
  };
  /** @deprecated Ignored. Responses hold one user's data and are never cached. */
  cache?: {
    enabled: boolean;
    ttl: number; // in seconds
  };
}

type RouteHandler = (request: NextRequest) => Promise<Response>;

/**
 * Create the server side of the browser proxy for `@profplum700/etsy-react`.
 *
 * Mount it at a Route Handler and point `createEtsyProxyClient({ endpoint })`
 * at it. Each request builds a client from that user's token cookies with
 * `getEtsyServerClient()`, runs one allowlisted method, and returns the result.
 * Etsy errors keep their type and code. The route accepts only `POST` from
 * your own origin and never caches responses. A refreshed token is saved to
 * the cookie, because Route Handlers may set cookies.
 *
 * Call `configureEtsyServerClient()` first, as for `getEtsyServerClient()`.
 *
 * @example
 * ```typescript
 * // app/api/etsy/route.ts
 * import '@/lib/etsy-server'; // calls configureEtsyServerClient()
 * import { createEtsyApiRoute } from '@profplum700/etsy-nextjs';
 *
 * export const { POST } = createEtsyApiRoute();
 * ```
 */
export function createEtsyApiRoute(config: EtsyApiRouteConfig = {}): {
  GET: RouteHandler;
  POST: RouteHandler;
  PUT: RouteHandler;
  DELETE: RouteHandler;
} {
  const handler = createEtsyProxyHandler({
    // A missing token cookie throws EtsyAuthError NO_TOKENS, which the proxy
    // returns to the browser as a 401.
    getClient: () => getEtsyServerClient(),
    methods: config.methods,
    allowedOrigins: config.allowedOrigins,
    onError: config.onError,
  });

  // The proxy answers anything but POST with 405.
  return { GET: handler, POST: handler, PUT: handler, DELETE: handler };
}
