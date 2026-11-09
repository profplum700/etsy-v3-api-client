/**
 * Cookie names and options shared by the OAuth routes and the token refresh
 * middleware. This module must not import `next/headers` or the core client:
 * the middleware imports it and may run on the Edge runtime.
 */

/**
 * Cookie names for OAuth state and tokens
 */
export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'etsy_access_token',
  REFRESH_TOKEN: 'etsy_refresh_token',
  TOKEN_TYPE: 'etsy_token_type',
  EXPIRES_AT: 'etsy_expires_at',
  STATE: 'etsy_oauth_state',
  CODE_VERIFIER: 'etsy_code_verifier',
  TOKENS: 'etsy-tokens', // Combined tokens cookie (for compatibility)
} as const;

export type CookieOptions = {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: string;
  maxAge: number;
};

/**
 * Cookie options for secure storage
 */
export const getCookieOptions = (maxAge?: number): CookieOptions => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: maxAge || 60 * 60 * 24 * 30, // 30 days default
});

/** The tokens the OAuth routes and the middleware store. */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: Date;
}

/** One cookie to set: its name, value and options. */
export type CookieWrite = [name: string, value: string, options: CookieOptions];

/**
 * The cookies that hold a set of tokens: the separate cookies the OAuth routes
 * read, and the combined cookie (`etsy-tokens` by default) that
 * `createEtsyServerClient()` reads.
 */
export function tokenCookieWrites(tokens: StoredTokens, combinedCookieName?: string): CookieWrite[] {
  const accessTokenMaxAge = Math.max(1, Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000));
  const combined = JSON.stringify({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt.toISOString(),
  });
  return [
    [COOKIE_NAMES.ACCESS_TOKEN, tokens.accessToken, getCookieOptions(accessTokenMaxAge)],
    [COOKIE_NAMES.REFRESH_TOKEN, tokens.refreshToken, getCookieOptions()],
    [COOKIE_NAMES.TOKEN_TYPE, tokens.tokenType, getCookieOptions()],
    [COOKIE_NAMES.EXPIRES_AT, tokens.expiresAt.toISOString(), getCookieOptions()],
    [combinedCookieName || COOKIE_NAMES.TOKENS, combined, getCookieOptions()],
  ];
}
