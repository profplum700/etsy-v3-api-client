# Getting Started with Etsy v3 API Client

This guide will help you get started with the `@profplum700/etsy-v3-api-client` library.

## Installation

```bash
npm install @profplum700/etsy-v3-api-client
```

## Prerequisites

Before you begin, you'll need:

1. An Etsy developer account
2. An Etsy app, with its keystring and shared secret
3. Node.js 24 or higher

Every API call sends your keystring and shared secret together, so make API calls from a server. Don't put the shared secret in a public web page (see [Browser Usage](../../README.md#browser-usage)).

## Quick Start

### 1. Set Up Your Etsy App

1. Go to [Etsy Developer Portal](https://www.etsy.com/developers)
2. Create a new app or use an existing one
3. On the Your Apps page, note the app's **keystring** and **shared secret**. Keep them in environment variables, for example `ETSY_API_KEY` and `ETSY_SHARED_SECRET`
4. Configure your redirect URI (e.g., `http://localhost:3000/callback`)

### 2. Authorise the App

Authentication uses two classes. `AuthHelper` runs the OAuth 2.0 flow with PKCE: it builds the URL that sends the user to Etsy, and exchanges the code Etsy sends back for tokens. `EtsyClient` then calls the API with those tokens.

```typescript
import { AuthHelper } from '@profplum700/etsy-v3-api-client';

const auth = new AuthHelper({
  keystring: process.env.ETSY_API_KEY!,
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['listings_r', 'shops_r', 'transactions_r']
});

// Step 1: send the user to Etsy to approve the app
const authUrl = await auth.getAuthUrl();

// Step 2: Etsy redirects to your redirect URI with `code` and `state` in the
// query string. Use the same AuthHelper: it holds the PKCE code verifier and
// rejects a state that doesn't match.
await auth.setAuthorizationCode(code, state);
const tokens = await auth.getAccessToken();
```

Keep the tokens: the access token lasts an hour, and the refresh token lets the client get new ones. The [authentication guide](./authentication.md) covers the full flow in a web server, and how to save the tokens.

### 3. Create the Client

```typescript
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  keystring: process.env.ETSY_API_KEY!,
  sharedSecret: process.env.ETSY_SHARED_SECRET!,
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_at
});
```

The client refreshes the access token when it expires. Etsy invalidates the old refresh token on each refresh, so to keep working across restarts, save every refreshed set (see [Token Storage](#token-storage)).

### 4. Making API Calls

```typescript
// The authorised user's shop
const shop = await client.getShop();
console.log('Shop name:', shop.shop_name);

// Active listings
const listings = await client.getListingsByShop(shop.shop_id.toString(), {
  state: 'active',
  limit: 25
});
console.log('Active listings:', listings.length);

// Recent paid orders
const receipts = await client.getShopReceipts(shop.shop_id.toString(), {
  was_paid: true,
  limit: 10
});
console.log('Recent orders:', receipts.length);
```

## Complete Example

The authentication guide's [complete authentication example](./authentication.md#complete-authentication-example) is a full Express app: it runs the OAuth flow with `AuthHelper`, saves the tokens to a file, keeps them saved as the client refreshes them, and picks them up again after a restart.

## Token Storage

The library supports multiple storage backends. `EtsyClient` takes a single config object and does not accept a storage object, so you connect a storage through the config: load the saved tokens when you create the client, and save every refreshed set through `refreshSaveAsync`. Etsy invalidates the old refresh token on each refresh, so a refresh that is never saved locks the app out on the next start.

The examples below use `createClientFromStorage`, a helper defined in the authentication guide's [Token Storage Options](./authentication.md#token-storage-options) section. Copy the helper and its imports into the file with your storage example. It works with any `TokenStorage`.

On the first run the storage is empty, and `createClientFromStorage` throws `No saved tokens`. Save the tokens from the OAuth flow to the same storage once, with `await storage.save(tokens)`, as the authentication guide's [complete example](./authentication.md#complete-authentication-example) does in its callback. Later starts load them from there.

Token files hold live credentials, so keep them out of Git: add your token file's path (for example `tokens.json` or `tokens.enc`) to your project's `.gitignore`.

### File Storage (Default)

```typescript
import { FileTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new FileTokenStorage('./tokens.json');
const client = await createClientFromStorage(storage);
```

### Memory Storage

Memory storage loses the tokens when the process exits, so use it only for tests:

```typescript
import { MemoryTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new MemoryTokenStorage();
await storage.save(tokens); // tokens from AuthHelper.getAccessToken()
const client = await createClientFromStorage(storage);
```

### Encrypted Storage

For production environments, use encrypted storage:

```typescript
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  // 32 random bytes, stored as 64 hex characters in ENCRYPTION_KEY
  encryptionKey: Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
});
const client = await createClientFromStorage(storage);
```

### Custom Storage

Implement the `TokenStorage` interface for custom storage:

```typescript
import { TokenStorage, EtsyTokens } from '@profplum700/etsy-v3-api-client';

class DatabaseTokenStorage implements TokenStorage {
  async save(tokens: EtsyTokens): Promise<void> {
    // Save to database
  }

  async load(): Promise<EtsyTokens | null> {
    // Load from database
  }

  async clear(): Promise<void> {
    // Clear from database
  }
}
```

## Configuration Options

The main `EtsyClientConfig` fields (see `src/types.ts` for every field):

```typescript
interface EtsyClientConfig {
  // Required
  keystring: string;        // Your app's keystring
  sharedSecret: string;     // Your app's shared secret
  accessToken: string;      // From AuthHelper.getAccessToken()
  refreshToken: string;
  expiresAt: Date;

  // Saving refreshed tokens (see Token Storage)
  refreshSaveAsync?: (accessToken: string, refreshToken: string, expiresAt: Date) => void | Promise<void>;
  refreshClearAsync?: () => Promise<void>;  // Called by client.clearTokens()
  tokenRefreshTimeoutMs?: number;           // Token refresh deadline (default: 30000)

  // Optional
  baseUrl?: string;         // Default: https://api.etsy.com/v3/application
  rateLimiting?: {
    enabled: boolean;               // On unless set to false
    maxRequestsPerSecond?: number;  // Default: 5
    maxRequestsPerDay?: number;     // Default: 5000
    maxRetries?: number;            // Retries after a 429 (default: 3)
    // ...and backoff, warning threshold and onApproachingLimit settings
  };
  caching?: {
    enabled: boolean;       // On unless set to false
    ttl?: number;           // Seconds (default: 3600)
    storage?: CacheStorage; // Default: in-memory
  };
  tokenRotation?: TokenRotationConfig;  // Rotate tokens before they expire
}
```

## Rate Limiting

Rate limiting is on by default, using Etsy's limits of 5 requests per second and 5000 per day. The client queues requests to stay under them. A read that gets a 429 is retried with backoff, up to `maxRetries`. A write that gets a 429 throws `EtsyRateLimitError` instead, because replaying it could apply the change twice. To change the limits:

```typescript
const client = new EtsyClient({
  ...config,
  rateLimiting: {
    enabled: true,
    maxRequestsPerSecond: 5,
    maxRequestsPerDay: 5000,
    onApproachingLimit: (remaining, total, percentageUsed) => {
      console.warn(`${percentageUsed}% of today's quota used`);
    }
  }
});

console.log('Requests left today:', client.getRemainingRequests());
```

## Caching

Successful GET responses are cached in memory by default, for an hour. Change the lifetime with `ttl`, in seconds, or turn caching off:

```typescript
const client = new EtsyClient({
  ...config,
  caching: {
    enabled: true,
    ttl: 300 // 5 minutes
  }
});

await client.clearCache(); // drop everything cached so far
```

Set `caching: { enabled: false }` when you need every read to reach Etsy.

## Error Handling

```typescript
import {
  EtsyApiError,
  EtsyAuthError,
  EtsyRateLimitError
} from '@profplum700/etsy-v3-api-client';

try {
  const shop = await client.getShop('123456');
} catch (error) {
  if (error instanceof EtsyAuthError) {
    // e.g. REAUTH_REQUIRED: Etsy refused the refresh token; authorise again
    console.error('Auth error:', error.code, error.message);
  } else if (error instanceof EtsyRateLimitError) {
    console.error('Rate limited; retry after (seconds):', error.retryAfter);
  } else if (error instanceof EtsyApiError) {
    console.error('API error:', error.statusCode, error.message);
    console.error('Response:', error.response);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Next Steps

- [Authentication Guide](./authentication.md) - Deep dive into OAuth flow
- [Listing Management](./listing-management.md) - Working with listings
- [Order Fulfillment](./order-fulfillment.md) - Processing orders
- [Shipping Profiles](./shipping-profiles.md) - Managing shipping
- [Webhooks](./webhooks.md) - Real-time notifications

## Common Patterns

### Check the Token

```typescript
if (client.isTokenExpired()) {
  console.log('The access token has expired; the next call refreshes it');
}

const tokens = client.getCurrentTokens(); // null after clearTokens()
```

### Refresh Tokens

Tokens are refreshed automatically when they expire. You can also refresh now:

```typescript
await client.refreshToken();
```

### Disconnect

```typescript
// Clears the tokens, calls refreshClearAsync and empties the cache
await client.clearTokens();
```

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](../troubleshooting/common-issues.md).

## Support

- [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)
- [README](../../README.md)
- [Examples](../../examples/)
