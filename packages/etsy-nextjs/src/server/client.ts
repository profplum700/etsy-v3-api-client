import { EtsyClient } from '@profplum700/etsy-v3-api-client';
import { cookies } from 'next/headers';

export interface EtsyServerClientConfig {
  apiKey: string;
  redirectUri?: string;
  scopes?: string[];
  cookieName?: string;
  encryptionKey?: string;
}

let serverClientInstance: EtsyClient | null = null;
export let serverClientConfig: EtsyServerClientConfig | null = null;

/**
 * Configure the Etsy server client
 * Call this once in your app, typically in a configuration file or at the root
 */
export function configureEtsyServerClient(config: EtsyServerClientConfig): void {
  serverClientConfig = config;
}

/**
 * Get or create the Etsy server client instance
 * This function is designed for use in Next.js Server Components
 */
export async function getEtsyServerClient(): Promise<EtsyClient> {
  if (!serverClientConfig) {
    throw new Error(
      'Etsy server client not configured. Call configureEtsyServerClient() first.'
    );
  }

  // Create a new client instance if needed
  if (!serverClientInstance) {
    const { apiKey } = serverClientConfig;

    // Load tokens from cookies
    const cookieStore = await cookies();
    const cookieName = serverClientConfig.cookieName || 'etsy-tokens';
    const tokenData = cookieStore.get(cookieName);

    if (!tokenData) {
      throw new Error('No authentication tokens found in cookies');
    }

    let tokens: { accessToken: string; refreshToken: string; expiresAt: string };
    try {
      tokens = JSON.parse(tokenData.value);
    } catch {
      throw new Error('Invalid token data in cookies');
    }

    // Save tokens callback
    const refreshSave = async (accessToken: string, refreshToken: string, expiresAt: Date): Promise<void> => {
      const cookieStore = await cookies();
      const cookieName = serverClientConfig?.cookieName || 'etsy-tokens';
      cookieStore.set(
        cookieName,
        JSON.stringify({
          accessToken,
          refreshToken,
          expiresAt: expiresAt.toISOString(),
        }),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 90, // 90 days
        }
      );
    };

    serverClientInstance = new EtsyClient({
      keystring: apiKey,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresAt: new Date(tokens.expiresAt),
      refreshSave,
    });
  }

  return serverClientInstance;
}

/**
 * Create a new Etsy client instance with custom configuration
 * Useful when you need multiple clients or custom settings
 */
export async function createEtsyServerClient(config: EtsyServerClientConfig): Promise<EtsyClient> {
  const { apiKey, cookieName } = config;

  // Load tokens from cookies
  const cookieStore = await cookies();
  const tokenCookieName = cookieName || 'etsy-tokens';
  const tokenData = cookieStore.get(tokenCookieName);

  if (!tokenData) {
    throw new Error('No authentication tokens found in cookies');
  }

  let tokens: { accessToken: string; refreshToken: string; expiresAt: string };
  try {
    tokens = JSON.parse(tokenData.value);
  } catch {
    throw new Error('Invalid token data in cookies');
  }

  // Save tokens callback
  const refreshSave = async (accessToken: string, refreshToken: string, expiresAt: Date): Promise<void> => {
    const cookieStore = await cookies();
    cookieStore.set(
      tokenCookieName,
      JSON.stringify({
        accessToken,
        refreshToken,
        expiresAt: expiresAt.toISOString(),
      }),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 90, // 90 days
      }
    );
  };

  return new EtsyClient({
    keystring: apiKey,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: new Date(tokens.expiresAt),
    refreshSave,
  });
}
