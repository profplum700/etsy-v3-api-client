# @profplum700/etsy-v3-api-client

A comprehensive JavaScript/TypeScript client for the Etsy Open API v3 with OAuth 2.0 authentication, rate limiting, and caching support.

## Features

- 🔐 **OAuth 2.0 Authentication** - Complete PKCE flow implementation
- 🚀 **Full TypeScript Support** - Comprehensive type definitions
- ⚡ **Rate Limiting** - Built-in Etsy API rate limit compliance
- 💾 **Token Management** - Automatic token refresh with storage options
- 🗄️ **Response Caching** - Configurable caching for GET requests
- 🌐 **Universal** - Works in Node.js and browsers
- 📦 **Zero Config** - Works out of the box with sensible defaults

## Installation

```bash
npm install @profplum700/etsy-v3-api-client
```

## Quick Start

### 1. OAuth Authentication

```typescript
import { AuthHelper } from '@profplum700/etsy-v3-api-client';

const authHelper = new AuthHelper({
  keystring: 'your-api-key',
  redirectUri: 'https://yourapp.com/callback',
  scopes: ['shops_r', 'listings_r']
});

// Get authorization URL
const authUrl = authHelper.getAuthUrl();
console.log('Visit:', authUrl);

// After user authorizes and returns with code
const state = authHelper.getState();
authHelper.setAuthorizationCode('auth-code-from-callback', state);

// Exchange for tokens
const tokens = await authHelper.getAccessToken();
```

### 2. API Client Usage

```typescript
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  keystring: 'your-api-key',
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_at
});

// Get current user
const user = await client.getUser();

// Get user's shop
const shop = await client.getShop();

// Get shop listings
const listings = await client.getListingsByShop();

// Search active listings
const searchResults = await client.findAllListingsActive({
  keywords: 'vintage print',
  limit: 25
});
```

### 3. Advanced Configuration

```typescript
const client = new EtsyClient({
  keystring: 'your-api-key',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date(Date.now() + 3600000),
  
  // Rate limiting
  rateLimiting: {
    enabled: true,
    maxRequestsPerDay: 10000,
    maxRequestsPerSecond: 10
  },
  
  // Caching
  caching: {
    enabled: true,
    ttl: 300 // 5 minutes
  },
  
  // Token refresh callback
  refreshSave: (accessToken, refreshToken, expiresAt) => {
    // Save new tokens to your storage
  }
});
```

## API Reference

### AuthHelper

Handles OAuth 2.0 authentication flow with PKCE.

```typescript
const authHelper = new AuthHelper({
  keystring: string,      // Your Etsy API key
  redirectUri: string,    // Your app's callback URL
  scopes: string[],       // Required scopes
  codeVerifier?: string,  // Optional custom code verifier
  state?: string          // Optional custom state parameter
});
```

**Methods:**
- `getAuthUrl(): string` - Get authorization URL for user
- `setAuthorizationCode(code, state): void` - Set auth code from callback
- `getAccessToken(): Promise<EtsyTokens>` - Exchange code for tokens
- `getState(): string` - Get current state parameter
- `getScopes(): string[]` - Get current scopes

### EtsyClient

Main client for making authenticated API requests.

```typescript
const client = new EtsyClient(config: EtsyClientConfig);
```

**User & Shop Methods:**
- `getUser(): Promise<EtsyUser>`
- `getShop(shopId?: string): Promise<EtsyShop>`
- `getShopByOwnerUserId(userId: string): Promise<EtsyShop>`

**Listing Methods:**
- `getListing(listingId: string, includes?: string[]): Promise<EtsyListing>`
- `getListingsByShop(shopId?: string, params?: ListingParams): Promise<EtsyListing[]>`
- `findAllListingsActive(params?: SearchParams): Promise<EtsyListing[]>`

**Utility Methods:**
- `getCurrentTokens(): EtsyTokens | null`
- `isTokenExpired(): boolean`
- `refreshToken(): Promise<EtsyTokens>`
- `getRemainingRequests(): number`
- `getRateLimitStatus(): RateLimitStatus`
- `clearCache(): Promise<void>`

### Token Storage

Store tokens persistently:

```typescript
import { FileTokenStorage, MemoryTokenStorage } from '@profplum700/etsy-v3-api-client';

// File storage (Node.js)
const fileStorage = new FileTokenStorage('./tokens.json');

// Memory storage
const memoryStorage = new MemoryTokenStorage();

// Use with TokenManager
const tokenManager = new TokenManager(config, fileStorage);
```

### Rate Limiting

Built-in rate limiting respects Etsy's limits:
- 10,000 requests per day
- 10 requests per second

```typescript
import { EtsyRateLimiter } from '@profplum700/etsy-v3-api-client';

const rateLimiter = new EtsyRateLimiter({
  maxRequestsPerDay: 10000,
  maxRequestsPerSecond: 10,
  minRequestInterval: 100
});
```

## OAuth Scopes

Common scope combinations:

```typescript
import { COMMON_SCOPE_COMBINATIONS } from '@profplum700/etsy-v3-api-client';

// Read-only access
const readOnlyScopes = COMMON_SCOPE_COMBINATIONS.SHOP_READ_ONLY;

// Full shop management
const fullScopes = COMMON_SCOPE_COMBINATIONS.SHOP_MANAGEMENT;

// Basic access
const basicScopes = COMMON_SCOPE_COMBINATIONS.BASIC_ACCESS;
```

## Error Handling

The client provides specific error types:

```typescript
import { EtsyApiError, EtsyAuthError, EtsyRateLimitError } from '@profplum700/etsy-v3-api-client';

try {
  const user = await client.getUser();
} catch (error) {
  if (error instanceof EtsyApiError) {
    console.log('API Error:', error.statusCode, error.message);
  } else if (error instanceof EtsyAuthError) {
    console.log('Auth Error:', error.code, error.message);
  } else if (error instanceof EtsyRateLimitError) {
    console.log('Rate Limited:', error.retryAfter);
  }
}
```

## TypeScript

Full TypeScript support with comprehensive type definitions:

```typescript
import type { 
  EtsyUser, 
  EtsyShop, 
  EtsyListing, 
  EtsyTokens,
  SearchParams,
  ListingParams 
} from '@profplum700/etsy-v3-api-client';
```

## Requirements

- Node.js 18+ (for native fetch support)
- Modern browsers with fetch support
- Etsy API key and application setup

## Examples

Check the [examples](./examples/) directory for complete working examples:
- Basic authentication flow
- Express.js server integration
- Token storage patterns
- Error handling

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see [LICENSE](./LICENSE) file for details.

## Support

- [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)
- [Etsy API Documentation](https://developers.etsy.com/documentation/reference)

---

**Note**: This is an unofficial client library. Etsy is a trademark of Etsy, Inc.