import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { AuthHelper } from '@profplum700/etsy-v3-api-client';
import { serverClientConfig } from './client';

/**
 * OAuth token response from Etsy
 */
export interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}

/**
 * Cookie names for OAuth state and tokens
 */
const COOKIE_NAMES = {
  ACCESS_TOKEN: 'etsy_access_token',
  REFRESH_TOKEN: 'etsy_refresh_token',
  TOKEN_TYPE: 'etsy_token_type',
  EXPIRES_AT: 'etsy_expires_at',
  STATE: 'etsy_oauth_state',
  CODE_VERIFIER: 'etsy_code_verifier',
  TOKENS: 'etsy-tokens', // Combined tokens cookie (for compatibility)
} as const;

/**
 * Cookie options for secure storage
 */
const getCookieOptions = (maxAge?: number) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: maxAge || 60 * 60 * 24 * 30, // 30 days default
});

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
export function createOAuthRoute() {
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

    // Store tokens in cookies
    const expiresAt = tokens.expires_at;
    const maxAge = Math.floor((expiresAt.getTime() - Date.now()) / 1000);

    cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, tokens.access_token, getCookieOptions(maxAge));
    cookieStore.set(COOKIE_NAMES.REFRESH_TOKEN, tokens.refresh_token, getCookieOptions());
    cookieStore.set(COOKIE_NAMES.TOKEN_TYPE, tokens.token_type, getCookieOptions());
    cookieStore.set(COOKIE_NAMES.EXPIRES_AT, expiresAt.toISOString(), getCookieOptions());

    // Also store in combined format for compatibility with existing server client
    const combinedTokens = {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: expiresAt.toISOString(),
    };
    cookieStore.set(
      serverClientConfig.cookieName || COOKIE_NAMES.TOKENS,
      JSON.stringify(combinedTokens),
      getCookieOptions()
    );

    // Clear temporary OAuth cookies
    cookieStore.delete(COOKIE_NAMES.STATE);
    cookieStore.delete(COOKIE_NAMES.CODE_VERIFIER);

    // Redirect to success page or return JSON
    const successUrl = searchParams.get('success_url') || '/';

    const acceptHeader = request.headers.get('accept') || '';
    if (acceptHeader.includes('application/json')) {
      return NextResponse.json({
        success: true,
        expiresAt: expiresAt.toISOString(),
        scope: tokens.scope,
      });
    } else {
      return NextResponse.redirect(new URL(successUrl, request.url));
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
    // Make refresh token request to Etsy API
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: apiKey,
      refresh_token: refreshToken,
    });

    const response = await fetch('https://api.etsy.com/v3/public/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: body.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Token refresh failed: ${response.status} ${errorText}`);
    }

    const tokenResponse: OAuthTokenResponse = await response.json();
    const expiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);
    const maxAge = tokenResponse.expires_in;

    // Update cookies with new tokens
    cookieStore.set(COOKIE_NAMES.ACCESS_TOKEN, tokenResponse.access_token, getCookieOptions(maxAge));
    cookieStore.set(COOKIE_NAMES.REFRESH_TOKEN, tokenResponse.refresh_token, getCookieOptions());
    cookieStore.set(COOKIE_NAMES.TOKEN_TYPE, tokenResponse.token_type, getCookieOptions());
    cookieStore.set(COOKIE_NAMES.EXPIRES_AT, expiresAt.toISOString(), getCookieOptions());

    // Update combined tokens cookie
    const combinedTokens = {
      accessToken: tokenResponse.access_token,
      refreshToken: tokenResponse.refresh_token,
      expiresAt: expiresAt.toISOString(),
    };
    cookieStore.set(
      serverClientConfig.cookieName || COOKIE_NAMES.TOKENS,
      JSON.stringify(combinedTokens),
      getCookieOptions()
    );

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
  const redirectUrl = searchParams.get('redirect_url') || '/';

  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('application/json')) {
    return NextResponse.json({ success: true });
  } else {
    return NextResponse.redirect(new URL(redirectUrl, request.url));
  }
}
