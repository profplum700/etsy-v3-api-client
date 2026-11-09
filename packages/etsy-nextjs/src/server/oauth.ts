import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthHelper } from '@profplum700/etsy-v3-api-client';
import { serverClientConfig } from './client';
import { COOKIE_NAMES, getCookieOptions, tokenCookieWrites } from './cookies';
import { requestTokenRefresh } from './refresh';

export type { OAuthTokenResponse } from './refresh';

/**
 * Resolve a post-login or post-logout redirect taken from the query string.
 * Only paths on this app's own origin are allowed, so the routes can't be used
 * to send users to another site (an open redirect). Anything else falls back
 * to the site root.
 */
export function resolveSameOriginRedirect(target: string | null, requestUrl: string): URL {
  const fallback = new URL('/', requestUrl);
  // A single leading slash: rejects absolute URLs, scheme-relative "//host"
  // and "/\host" (browsers treat a backslash like a slash there).
  if (!target || !target.startsWith('/') || target.startsWith('//') || target.startsWith('/\\')) {
    return fallback;
  }
  const resolved = new URL(target, requestUrl);
  return resolved.origin === fallback.origin ? resolved : fallback;
}

/**
 * Creates OAuth route handlers for Etsy authentication
 * Handles: /api/etsy/auth/authorize, /api/etsy/auth/callback, /api/etsy/auth/refresh, /api/etsy/auth/logout
 *
 * @example
 * ```typescript
 * // app/api/etsy/auth/[...etsy]/route.ts
 * import '@/lib/etsy-server'; // Ensure config is loaded
 * import { createOAuthRoute } from '@profplum700/etsy-nextjs';
 *
 * const handler = createOAuthRoute();
 * export { handler as GET, handler as POST };
 * ```
 */
export function createOAuthRoute(): (
  request: NextRequest
) => Promise<NextResponse> {
  return async function handler(request: NextRequest) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Extract the OAuth action from the catch-all route
    // e.g., /api/etsy/auth/authorize -> "authorize"
    // e.g., /api/etsy/auth/callback -> "callback"
    const pathParts = pathname.split('/').filter(Boolean);
    const action = pathParts[pathParts.length - 1];

    try {
      switch (action) {
        case 'authorize':
          return await handleAuthorize(request);
        case 'callback':
          return await handleCallback(request);
        case 'refresh':
          return await handleRefresh(request);
        case 'logout':
          return await handleLogout(request);
        default:
          return NextResponse.json(
            { error: 'Invalid OAuth action. Valid actions: authorize, callback, refresh, logout' },
            { status: 400 }
          );
      }
    } catch (error) {
      console.error('OAuth error:', error);
      return NextResponse.json(
        {
          error: error instanceof Error ? error.message : 'OAuth operation failed',
          action
        },
        { status: 500 }
      );
    }
  };
}

/**
 * Handle OAuth authorization - Start the OAuth flow
 * GET /api/etsy/auth/authorize
 */
async function handleAuthorize(request: NextRequest): Promise<NextResponse> {
  // Get configuration
  if (!serverClientConfig) {
    return NextResponse.json(
      { error: 'Etsy server client not configured. Call configureEtsyServerClient() first.' },
      { status: 500 }
    );
  }

  const { apiKey, redirectUri, scopes } = serverClientConfig;

  if (!apiKey || !redirectUri) {
    return NextResponse.json(
      { error: 'Missing required OAuth configuration: apiKey and redirectUri' },
      { status: 500 }
    );
  }

  // Create AuthHelper instance
  const authHelper = new AuthHelper({
    keystring: apiKey,
    redirectUri,
    scopes: scopes || [],
  });

  // Generate authorization URL
  const authUrl = await authHelper.getAuthUrl();
  const state = await authHelper.getState();
  const codeVerifier = await authHelper.getCodeVerifier();

  // Store state and code verifier in cookies for verification in callback
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAMES.STATE, state, getCookieOptions(600)); // 10 minutes
  cookieStore.set(COOKIE_NAMES.CODE_VERIFIER, codeVerifier, getCookieOptions(600)); // 10 minutes

  // Check if this is an API call or browser navigation
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    // API call - return JSON with URL
    return NextResponse.json({ authUrl, state });
  } else {
    // Browser navigation - redirect to Etsy
    return NextResponse.redirect(authUrl);
  }
}

/**
 * Handle OAuth callback - Exchange code for tokens
 * GET /api/etsy/auth/callback?code=...&state=...
 */
async function handleCallback(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');
  const errorDescription = searchParams.get('error_description');

  // Handle OAuth errors from Etsy
  if (error) {
    console.error('OAuth error from Etsy:', error, errorDescription);
    return NextResponse.json(
      {
        error: 'OAuth authorization failed',
        details: errorDescription || error
      },
      { status: 400 }
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: 'Missing code or state parameter' },
      { status: 400 }
    );
  }

  // Get configuration
  if (!serverClientConfig) {
    return NextResponse.json(
      { error: 'Etsy server client not configured' },
      { status: 500 }
    );
  }

  const { apiKey, redirectUri, scopes } = serverClientConfig;

  // Retrieve and verify state
  const cookieStore = await cookies();
  const storedState = cookieStore.get(COOKIE_NAMES.STATE)?.value;
  const storedCodeVerifier = cookieStore.get(COOKIE_NAMES.CODE_VERIFIER)?.value;

  if (!storedState || !storedCodeVerifier) {
    return NextResponse.json(
      { error: 'OAuth state not found. Please start the authorization flow again.' },
      { status: 400 }
    );
  }

  if (state !== storedState) {
    return NextResponse.json(
      { error: 'State parameter mismatch. Possible CSRF attack.' },
      { status: 400 }
    );
  }

  try {
    // Create AuthHelper with stored state and verifier
    const authHelper = new AuthHelper({
      keystring: apiKey,
      redirectUri: redirectUri || '',
      scopes: scopes || [],
      state: storedState,
      codeVerifier: storedCodeVerifier,
    });

    // Exchange code for tokens
    await authHelper.setAuthorizationCode(code, state);
    const tokens = await authHelper.getAccessToken();

    // Store tokens in the separate cookies and the combined one the server client reads
    const expiresAt = tokens.expires_at;
    const writes = tokenCookieWrites(
      {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        tokenType: tokens.token_type,
        expiresAt,
      },
      serverClientConfig.cookieName
    );
    for (const [name, value, options] of writes) cookieStore.set(name, value, options);

    // Clear temporary OAuth cookies
    cookieStore.delete(COOKIE_NAMES.STATE);
    cookieStore.delete(COOKIE_NAMES.CODE_VERIFIER);

    // Redirect to success page or return JSON
    const successUrl = resolveSameOriginRedirect(searchParams.get('success_url'), request.url);

    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({
        success: true,
        expiresAt: expiresAt.toISOString(),
        scope: tokens.scope,
      });
    } else {
      return NextResponse.redirect(successUrl);
    }
  } catch (error) {
    console.error('Token exchange error:', error);
    return NextResponse.json(
      {
        error: 'Failed to exchange authorization code for tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle token refresh
 * POST /api/etsy/auth/refresh
 */
async function handleRefresh(_request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(COOKIE_NAMES.REFRESH_TOKEN)?.value;

  if (!refreshToken) {
    return NextResponse.json(
      { error: 'No refresh token available' },
      { status: 401 }
    );
  }

  if (!serverClientConfig) {
    return NextResponse.json(
      { error: 'Etsy server client not configured' },
      { status: 500 }
    );
  }

  const { apiKey } = serverClientConfig;

  try {
    const tokenResponse = await requestTokenRefresh(apiKey, refreshToken);
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

    // Update the separate cookies and the combined one the server client reads
    const writes = tokenCookieWrites(
      {
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        tokenType: tokenResponse.token_type,
        expiresAt,
      },
      serverClientConfig.cookieName
    );
    for (const [name, value, options] of writes) cookieStore.set(name, value, options);

    return NextResponse.json({
      success: true,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return NextResponse.json(
      {
        error: 'Failed to refresh access token',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * Handle logout - Clear all auth cookies
 * POST /api/etsy/auth/logout
 */
async function handleLogout(request: NextRequest): Promise<NextResponse> {
  const cookieStore = await cookies();

  // Clear all auth cookies
  cookieStore.delete(COOKIE_NAMES.ACCESS_TOKEN);
  cookieStore.delete(COOKIE_NAMES.REFRESH_TOKEN);
  cookieStore.delete(COOKIE_NAMES.TOKEN_TYPE);
  cookieStore.delete(COOKIE_NAMES.EXPIRES_AT);
  cookieStore.delete(COOKIE_NAMES.STATE);
  cookieStore.delete(COOKIE_NAMES.CODE_VERIFIER);

  // Also clear combined tokens cookie
  if (serverClientConfig?.cookieName) {
    cookieStore.delete(serverClientConfig.cookieName);
  }
  cookieStore.delete(COOKIE_NAMES.TOKENS);

  // Redirect to home or return JSON
  const { searchParams } = new URL(request.url);
  const redirectUrl = resolveSameOriginRedirect(searchParams.get('redirect_url'), request.url);

  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.redirect(redirectUrl);
  }
}
