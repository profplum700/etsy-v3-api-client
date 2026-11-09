// Middleware entry point: imports only next/server, so it runs on the Edge
// runtime as well as on Node.js. Import it from '@profplum700/etsy-nextjs/middleware'.
import { NextResponse, type NextRequest } from 'next/server';
import { COOKIE_NAMES, tokenCookieWrites, type StoredTokens } from './server/cookies';
import { requestTokenRefresh } from './server/refresh';

export interface EtsyMiddlewareConfig {
  /** Your Etsy app's keystring. Refreshing a token needs no shared secret. */
  apiKey: string;
  /** Name of the combined token cookie. Use the same value as `configureEtsyServerClient()` (default: `etsy-tokens`). */
  cookieName?: string;
  /**
   * Refresh when the access token expires within this many seconds (default: 300).
   * It must be at least 60: `EtsyClient` refreshes a token itself within a minute
   * of expiry, and a refresh during a Server Component render can't be saved.
   */
  refreshWithinSeconds?: number;
}

const DEFAULT_REFRESH_WITHIN_SECONDS = 300;
// EtsyClient's TokenManager refreshes within this many seconds of expiry.
const CLIENT_REFRESH_BUFFER_SECONDS = 60;

// Refreshes in progress in this process, keyed by refresh token. Etsy
// invalidates a refresh token once it's used, so concurrent requests from one
// browser (a page and its prefetches) must share one refresh, not race.
const refreshesInFlight = new Map<string, Promise<StoredTokens>>();

/**
 * Read the refresh token and access-token expiry from the combined token
 * cookie. Returns null when the cookie is missing or can't be parsed, so the
 * request passes through untouched.
 */
function readStoredTokens(request: NextRequest, cookieName: string): { refreshToken: string; expiresAt: number } | null {
  const raw = request.cookies.get(cookieName)?.value;
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { refreshToken?: unknown; expiresAt?: unknown };
    const expiresAt = typeof parsed.expiresAt === 'string' ? Date.parse(parsed.expiresAt) : NaN;
    if (typeof parsed.refreshToken !== 'string' || !parsed.refreshToken || Number.isNaN(expiresAt)) return null;
    return { refreshToken: parsed.refreshToken, expiresAt };
  } catch {
    return null;
  }
}

/**
 * Refresh with Etsy, sharing one request between concurrent callers that hold
 * the same refresh token.
 */
function refreshOnce(apiKey: string, refreshToken: string): Promise<StoredTokens> {
  let pending = refreshesInFlight.get(refreshToken);
  if (!pending) {
    pending = requestTokenRefresh(apiKey, refreshToken)
      .then((response) => ({
        accessToken: response.access_token,
        refreshToken: response.refresh_token,
        tokenType: response.token_type,
        expiresAt: new Date(Date.now() + response.expires_in * 1000),
      }))
      .finally(() => refreshesInFlight.delete(refreshToken));
    refreshesInFlight.set(refreshToken, pending);
  }
  return pending;
}

/**
 * Create Next.js middleware that refreshes the user's Etsy tokens before any
 * Server Component renders.
 *
 * `EtsyClient` refreshes an access token itself when it's about to expire, but
 * during a Server Component render the new tokens can't be saved: Next.js only
 * lets Server Actions and Route Handlers set cookies. Etsy has already
 * invalidated the old refresh token by then, so the user would have to
 * authorise the app again. This middleware refreshes earlier, while it can
 * still set cookies. It sends the new tokens to the browser and passes them on
 * to the rest of the request, so the client built during render starts with a
 * fresh token and doesn't need to refresh.
 *
 * Requests without a token cookie, or with a token that isn't close to
 * expiry, pass through unchanged. If Etsy refuses the refresh, the request
 * also passes through unchanged and the error is logged.
 *
 * @example
 * ```typescript
 * // middleware.ts
 * import { createEtsyMiddleware } from '@profplum700/etsy-nextjs/middleware';
 *
 * export const middleware = createEtsyMiddleware({ apiKey: process.env.ETSY_API_KEY! });
 *
 * // Run it on the pages that call Etsy during render.
 * export const config = { matcher: ['/dashboard/:path*'] };
 * ```
 */
export function createEtsyMiddleware(config: EtsyMiddlewareConfig): (request: NextRequest) => Promise<NextResponse> {
  const refreshWithinSeconds = config.refreshWithinSeconds ?? DEFAULT_REFRESH_WITHIN_SECONDS;
  if (!(refreshWithinSeconds >= CLIENT_REFRESH_BUFFER_SECONDS)) {
    throw new Error(
      `refreshWithinSeconds must be at least ${CLIENT_REFRESH_BUFFER_SECONDS}, so tokens are refreshed before EtsyClient would refresh them during render.`
    );
  }
  const cookieName = config.cookieName || COOKIE_NAMES.TOKENS;

  return async function etsyMiddleware(request: NextRequest): Promise<NextResponse> {
    const stored = readStoredTokens(request, cookieName);
    if (!stored || stored.expiresAt - Date.now() > refreshWithinSeconds * 1000) {
      return NextResponse.next();
    }

    let tokens: StoredTokens;
    try {
      tokens = await refreshOnce(config.apiKey, stored.refreshToken);
    } catch (error) {
      // Leave the cookies alone. A concurrent request may already have stored
      // newer tokens, and if Etsy refused the refresh token for good, the
      // client reports REAUTH_REQUIRED when the page calls Etsy.
      console.error('Etsy token refresh in middleware failed:', error);
      return NextResponse.next();
    }

    const writes = tokenCookieWrites(tokens, cookieName);
    // Pass the new tokens on to Server Components in this request...
    for (const [name, value] of writes) request.cookies.set(name, value);
    const response = NextResponse.next({ request: { headers: request.headers } });
    // ...and send them to the browser.
    for (const [name, value, options] of writes) response.cookies.set(name, value, options);
    return response;
  };
}
