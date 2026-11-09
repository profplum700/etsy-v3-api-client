/**
 * Exchange a refresh token for new tokens at Etsy's OAuth endpoint. Shared by
 * the OAuth refresh route and the token refresh middleware, so it uses only
 * `fetch` and runs on the Edge runtime too.
 */

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

const ETSY_TOKEN_URL = 'https://api.etsy.com/v3/public/oauth/token';

/**
 * Ask Etsy for new tokens. Etsy invalidates the refresh token passed in, so
 * the caller must store the returned tokens.
 *
 * @throws Error when Etsy does not answer with 2xx.
 */
export async function requestTokenRefresh(apiKey: string, refreshToken: string): Promise<OAuthTokenResponse> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: apiKey,
    refresh_token: refreshToken,
  });

  const response = await fetch(ETSY_TOKEN_URL, {
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

  return (await response.json()) as OAuthTokenResponse;
}
