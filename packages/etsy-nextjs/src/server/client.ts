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
let serverClientConfig: EtsyServerClientConfig | null = null;

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
    const { apiKey, redirectUri, scopes } = serverClientConfig;

    // Create storage that reads from cookies
    const tokenStorage = {
      async load(): Promise<unknown> {
        const cookieStore = await cookies();
        const cookieName = serverClientConfig?.cookieName || 'etsy-tokens';
        const tokenData = cookieStore.get(cookieName);
        if (!tokenData) return null;

        try {
          return JSON.parse(tokenData.value);
        } catch {
          return null;
        }
      },
      async save(tokens: Record<string, unknown>): Promise<void> {
        const cookieStore = await cookies();
        const cookieName = serverClientConfig?.cookieName || 'etsy-tokens';
        cookieStore.set(
          cookieName,
          JSON.stringify(tokens),
          {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 60 * 60 * 24 * 90, // 90 days
          }
        );
      },
      async clear(): Promise<void> {
        const cookieStore = await cookies();
        const cookieName = serverClientConfig?.cookieName || 'etsy-tokens';
        cookieStore.delete(cookieName);
      },
    };

    serverClientInstance = new EtsyClient(
      {
        apiKey,
        redirectUri: redirectUri || '',
        scopes: scopes || [],
      },
      tokenStorage
    );
  }

  return serverClientInstance;
}

/**
 * Create a new Etsy client instance with custom configuration
 * Useful when you need multiple clients or custom settings
 */
export function createEtsyServerClient(config: EtsyServerClientConfig): EtsyClient {
  const { apiKey, redirectUri, scopes, cookieName } = config;

  const tokenStorage = {
    async load(): Promise<unknown> {
      const cookieStore = await cookies();
      const tokenData = cookieStore.get(cookieName || 'etsy-tokens');
      if (!tokenData) return null;

      try {
        return JSON.parse(tokenData.value);
      } catch {
        return null;
      }
    },
    async save(tokens: Record<string, unknown>): Promise<void> {
      const cookieStore = await cookies();
      cookieStore.set(
        cookieName || 'etsy-tokens',
        JSON.stringify(tokens),
        {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 90, // 90 days
        }
      );
    },
    async clear(): Promise<void> {
      const cookieStore = await cookies();
      cookieStore.delete(cookieName || 'etsy-tokens');
    },
  };

  return new EtsyClient(
    {
      apiKey,
      redirectUri: redirectUri || '',
      scopes: scopes || [],
    },
    tokenStorage
  );
}
