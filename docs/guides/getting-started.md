# Getting Started with Etsy v3 API Client

This guide will help you get started with the `@profplum700/etsy-v3-api-client` library.

## Installation

```bash
npm install @profplum700/etsy-v3-api-client
```

## Prerequisites

Before you begin, you'll need:

1. An Etsy developer account
2. An Etsy app with OAuth credentials
3. Node.js 18 or higher

## Quick Start

### 1. Set Up Your Etsy App

1. Go to [Etsy Developer Portal](https://www.etsy.com/developers)
2. Create a new app or use an existing one
3. Note your `client_id` (API Key)
4. Configure your redirect URI (e.g., `http://localhost:3000/callback`)

### 2. Basic Setup

```typescript
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: 'http://localhost:3000/callback',
  scopes: [
    'listings_r',
    'listings_w',
    'shops_r',
    'transactions_r'
  ]
});
```

### 3. Authentication Flow

The library uses OAuth 2.0 with PKCE for authentication.

```typescript
// Step 1: Get the authorization URL
const authUrl = await client.getAuthorizationUrl();
console.log('Visit this URL to authorize:', authUrl);

// Step 2: After user authorizes, exchange the code for tokens
// (The authorization code is in the redirect URI query params)
const code = 'authorization_code_from_redirect';
await client.exchangeAuthorizationCode(code);

// Step 3: You're now authenticated! Tokens are automatically stored
const shop = await client.getShopByOwnerUserId();
console.log('Shop:', shop);
```

### 4. Making API Calls

Once authenticated, you can make API calls:

```typescript
// Get your shop details
const shop = await client.getShopByOwnerUserId();
console.log('Shop name:', shop.shop_name);

// Get active listings
const listings = await client.getListingsByShop(shop.shop_id.toString(), {
  state: 'active',
  limit: 25
});

console.log('Active listings:', listings.results.length);

// Get recent orders
const receipts = await client.getShopReceipts(shop.shop_id.toString(), {
  was_paid: true,
  limit: 10
});

console.log('Recent orders:', receipts.results.length);
```

## Complete Example

Here's a complete example with Express:

```typescript
import express from 'express';
import { EtsyClient, FileTokenStorage } from '@profplum700/etsy-v3-api-client';

const app = express();

// Initialize client with file storage for tokens
const storage = new FileTokenStorage('./tokens.json');
const client = new EtsyClient(
  {
    apiKey: process.env.ETSY_API_KEY!,
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['listings_r', 'shops_r', 'transactions_r']
  },
  storage
);

// Step 1: Redirect to Etsy for authorization
app.get('/auth', async (req, res) => {
  const authUrl = await client.getAuthorizationUrl();
  res.redirect(authUrl);
});

// Step 2: Handle the callback from Etsy
app.get('/callback', async (req, res) => {
  try {
    const code = req.query.code as string;
    await client.exchangeAuthorizationCode(code);
    res.send('Authentication successful! You can now use the API.');
  } catch (error) {
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// Step 3: Use the API
app.get('/shop', async (req, res) => {
  try {
    const shop = await client.getShopByOwnerUserId();
    res.json(shop);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Visit http://localhost:3000/auth to start authentication');
});
```

## Token Storage

The library supports multiple storage backends:

### File Storage (Default)

```typescript
import { FileTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new FileTokenStorage('./tokens.json');
const client = new EtsyClient(config, storage);
```

### Memory Storage

```typescript
import { MemoryTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new MemoryTokenStorage();
const client = new EtsyClient(config, storage);
```

### Encrypted Storage

For production environments, use encrypted storage:

```typescript
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new EncryptedFileTokenStorage(
  './tokens.enc',
  process.env.ENCRYPTION_KEY! // 32-byte encryption key
);
const client = new EtsyClient(config, storage);
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

```typescript
interface EtsyClientConfig {
  // Required
  apiKey: string;              // Your Etsy API key
  redirectUri: string;         // OAuth redirect URI
  scopes: string[];           // OAuth scopes

  // Optional
  baseUrl?: string;           // API base URL (default: https://openapi.etsy.com/v3)
  rateLimit?: {
    maxRequests: number;      // Max requests per window (default: 10)
    windowMs: number;         // Time window in ms (default: 1000)
  };
  cache?: {
    enabled: boolean;         // Enable caching (default: false)
    ttl: number;             // Cache TTL in ms (default: 300000)
  };
  timeout?: number;           // Request timeout in ms (default: 30000)
}
```

## Rate Limiting

The library includes built-in rate limiting:

```typescript
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['listings_r'],
  rateLimit: {
    maxRequests: 10,  // Max 10 requests
    windowMs: 1000    // Per second
  }
});
```

## Caching

Enable response caching to improve performance:

```typescript
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: 'http://localhost:3000/callback',
  scopes: ['listings_r'],
  cache: {
    enabled: true,
    ttl: 300000  // 5 minutes
  }
});
```

## Error Handling

```typescript
import { EtsyApiError } from '@profplum700/etsy-v3-api-client';

try {
  const shop = await client.getShop('invalid-shop-id');
} catch (error) {
  if (error instanceof EtsyApiError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.statusCode);
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

### Check if Authenticated

```typescript
const isAuthenticated = await client.isAuthenticated();
if (!isAuthenticated) {
  console.log('Please authenticate first');
}
```

### Refresh Tokens

Tokens are automatically refreshed when they expire. You can also manually refresh:

```typescript
await client.refreshAccessToken();
```

### Get Current User's Shop

```typescript
const shop = await client.getShopByOwnerUserId();
console.log('Your shop ID:', shop.shop_id);
```

## Troubleshooting

For common issues and solutions, see the [Troubleshooting Guide](../troubleshooting/common-issues.md).

## Support

- [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)
- [API Reference](../api-reference/README.md)
- [Examples](../../examples/)
