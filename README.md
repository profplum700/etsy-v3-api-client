# Etsy API v3 Client

[![npm version](https://badge.fury.io/js/%40profplum700%2Fetsy-v3-api-client.svg)](https://badge.fury.io/js/%40profplum700%2Fetsy-v3-api-client)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](http://www.typescriptlang.org/)

A modern, universal TypeScript/JavaScript client for the Etsy Open API v3 with full OAuth 2.0 PKCE authentication support. Works seamlessly in both browser and Node.js environments.

## 🚀 Features

- **Universal Compatibility**: Works in browsers, Node.js, and Web Workers
- **OAuth 2.0 PKCE Authentication**: Full support for secure authentication flow
- **TypeScript First**: Complete type definitions with IntelliSense support
- **Rate Limiting**: Built-in request throttling to respect API limits
- **Token Management**: Automatic token refresh with configurable storage
- **Caching**: Optional response caching to improve performance
- **Error Handling**: Comprehensive error types for different failure scenarios
- **Zero Dependencies**: No external runtime dependencies

## 📦 Installation

```bash
npm install @profplum700/etsy-v3-api-client
```

```bash
yarn add @profplum700/etsy-v3-api-client
```

```bash
pnpm add @profplum700/etsy-v3-api-client
```

## 🔧 Quick Start

### Basic Setup

```typescript
import { EtsyClient, AuthHelper } from '@profplum700/etsy-v3-api-client';

// Create authentication helper
const authHelper = new AuthHelper({
  keystring: 'your-api-key',
  redirectUri: 'https://your-app.com/callback',
  scopes: ['shops_r', 'listings_r']
});

// Get authorization URL
const authUrl = await authHelper.getAuthUrl();
console.log('Visit this URL to authorize:', authUrl);

// After user authorization, exchange code for tokens
const state = await authHelper.getState();
await authHelper.setAuthorizationCode('authorization-code-from-callback', state);
const tokens = await authHelper.getAccessToken();

// Create API client
const client = new EtsyClient({
  keystring: 'your-api-key',
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_at
});

// Make API calls
const user = await client.getUser();
console.log('User:', user);
```

### Browser Usage

```html
<script type="module">
import { EtsyClient, AuthHelper } from 'https://unpkg.com/@profplum700/etsy-v3-api-client/dist/browser.esm.js';

// Your code here...
</script>
```

Or using UMD:

```html
<script src="https://unpkg.com/@profplum700/etsy-v3-api-client/dist/browser.umd.js"></script>
<script>
const { EtsyClient, AuthHelper } = EtsyApiClient;
// Your code here...
</script>
```

### Node.js Usage

```javascript
// CommonJS
const { EtsyClient, AuthHelper } = require('@profplum700/etsy-v3-api-client');

// ES Modules
import { EtsyClient, AuthHelper } from '@profplum700/etsy-v3-api-client';
```

## 🔐 Authentication

### OAuth 2.0 Flow

1. **Create AuthHelper** with your app credentials
2. **Generate authorization URL** for user to visit
3. **Handle callback** with authorization code
4. **Exchange code for tokens**
5. **Use tokens** with EtsyClient

```typescript
import { AuthHelper, ETSY_SCOPES } from '@profplum700/etsy-v3-api-client';

const authHelper = new AuthHelper({
  keystring: 'your-api-key',
  redirectUri: 'https://your-app.com/callback',
  scopes: [
    ETSY_SCOPES.SHOPS_READ,
    ETSY_SCOPES.LISTINGS_READ,
    ETSY_SCOPES.PROFILE_READ
  ]
});

// Step 1: Get authorization URL
const authUrl = await authHelper.getAuthUrl();
// Redirect user to authUrl

// Step 2: Handle callback (in your callback endpoint)
const { code, state } = getCallbackParams(); // Your implementation
const expectedState = await authHelper.getState();

if (state === expectedState) {
  await authHelper.setAuthorizationCode(code, state);
  const tokens = await authHelper.getAccessToken();
  // Store tokens securely
}
```

### Available Scopes

```typescript
import { ETSY_SCOPES, COMMON_SCOPE_COMBINATIONS } from '@profplum700/etsy-v3-api-client';

// Individual scopes
const scopes = [
  ETSY_SCOPES.SHOPS_READ,
  ETSY_SCOPES.LISTINGS_WRITE,
  ETSY_SCOPES.TRANSACTIONS_READ
];

// Pre-defined combinations
const readOnlyScopes = COMMON_SCOPE_COMBINATIONS.SHOP_READ_ONLY;
const managementScopes = COMMON_SCOPE_COMBINATIONS.SHOP_MANAGEMENT;
```

## 🏪 Client Usage

### Creating a Client

```typescript
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  keystring: 'your-api-key',
  accessToken: 'user-access-token',
  refreshToken: 'user-refresh-token',
  expiresAt: new Date('2024-12-31T23:59:59Z'),
  
  // Optional configuration
  rateLimiting: {
    enabled: true,
    maxRequestsPerSecond: 10,
    maxRequestsPerDay: 5000
  },
  caching: {
    enabled: true,
    ttl: 300 // 5 minutes
  }
});
```

### Making API Calls

```typescript
// Get current user
const user = await client.getUser();

// Get user's shops
const shops = await client.getUserShops();

// Get shop listings
const listings = await client.getListingsByShop('shop-id');

// Get specific listing
const listing = await client.getListing('listing-id');

// Search listings
const searchResults = await client.findAllActiveListings({
  keywords: 'vintage',
  category: 'art',
  limit: 25
});
```

### Error Handling

```typescript
import { EtsyApiError, EtsyAuthError, EtsyRateLimitError } from '@profplum700/etsy-v3-api-client';

try {
  const user = await client.getUser();
} catch (error) {
  if (error instanceof EtsyAuthError) {
    // Handle authentication errors
    console.error('Auth error:', error.message, error.code);
  } else if (error instanceof EtsyRateLimitError) {
    // Handle rate limiting
    console.error('Rate limited. Retry after:', error.retryAfter);
  } else if (error instanceof EtsyApiError) {
    // Handle API errors
    console.error('API error:', error.statusCode, error.message);
  } else {
    // Handle other errors
    console.error('Unexpected error:', error);
  }
}
```

## 💾 Token Storage

### Built-in Storage Options

The client provides several storage mechanisms:

```typescript
import { 
  createDefaultTokenStorage,
  LocalStorageTokenStorage,
  SessionStorageTokenStorage,
  FileTokenStorage,
  MemoryTokenStorage
} from '@profplum700/etsy-v3-api-client';

// Automatic storage selection based on environment
const storage = createDefaultTokenStorage();

// Browser localStorage
const localStorage = new LocalStorageTokenStorage('etsy-tokens');

// Browser sessionStorage  
const sessionStorage = new SessionStorageTokenStorage('etsy-tokens');

// Node.js file storage
const fileStorage = new FileTokenStorage('./tokens.json');

// In-memory storage (not persistent)
const memoryStorage = new MemoryTokenStorage();

// Use with client
const client = new EtsyClient(config, storage);
```

### Custom Storage

```typescript
import { TokenStorage } from '@profplum700/etsy-v3-api-client';

class CustomTokenStorage implements TokenStorage {
  async save(tokens: EtsyTokens): Promise<void> {
    // Your save implementation
  }

  async load(): Promise<EtsyTokens | null> {
    // Your load implementation
  }

  async clear(): Promise<void> {
    // Your clear implementation
  }
}
```

## 🚦 Rate Limiting

The client includes built-in rate limiting to respect Etsy's API limits:

```typescript
const client = new EtsyClient({
  // ... other config
  rateLimiting: {
    enabled: true,
    maxRequestsPerSecond: 10,    // Requests per second
    maxRequestsPerDay: 5000,     // Requests per day
    minRequestInterval: 100      // Minimum ms between requests
  }
});

// Check remaining requests
const remaining = client.getRemainingRequests();
console.log(`${remaining} requests remaining today`);
```

## 🔄 Caching

Optional response caching to improve performance:

```typescript
const client = new EtsyClient({
  // ... other config
  caching: {
    enabled: true,
    ttl: 300 // Cache for 5 minutes
  }
});

// Clear cache when needed
await client.clearCache();
```

## 🌐 Environment Support

### Browser
- Modern browsers with ES2020+ support
- Web Workers
- Service Workers

### Node.js
- Node.js 20+
- Full CommonJS and ES Module support

### Package Exports
The package provides optimized builds for different environments:

```json
{
  "imports": {
    "@profplum700/etsy-v3-api-client": "./dist/index.esm.js",
    "@profplum700/etsy-v3-api-client/browser": "./dist/browser.esm.js",
    "@profplum700/etsy-v3-api-client/node": "./dist/node.esm.js"
  }
}
```

## 📚 API Reference

### EtsyClient Methods

#### User Methods
- `getUser()` - Get current user info
- `getUserShops(userId?)` - Get user's shops

#### Shop Methods
- `getShop(shopId)` - Get shop details
- `getShopByOwnerUserId(userId)` - Get shop by owner user ID

#### Listing Methods
- `getListing(listingId)` - Get listing details
- `getListingsByShop(shopId, options?)` - Get shop's listings
- `findAllActiveListings(options?)` - Search active listings

#### Search Methods
- `findAllActiveListings(params)` - Search listings with filters

### AuthHelper Methods
- `getAuthUrl()` - Generate authorization URL
- `setAuthorizationCode(code, state)` - Set auth code from callback
- `getAccessToken()` - Exchange code for tokens
- `getState()` - Get current state parameter
- `getCodeVerifier()` - Get PKCE code verifier

### TokenManager Methods
- `getAccessToken()` - Get current access token (refreshes if needed)
- `refreshToken()` - Manually refresh tokens
- `getCurrentTokens()` - Get current token set
- `isTokenExpired()` - Check if token is expired
- `clearTokens()` - Clear stored tokens

## 🛠️ Configuration Options

```typescript
interface EtsyClientConfig {
  keystring: string;                    // Required: Your API key
  accessToken?: string;                 // User's access token
  refreshToken?: string;                // User's refresh token
  expiresAt?: Date;                     // Token expiration date
  refreshSave?: (token, refresh, expires) => void; // Token save callback
  
  rateLimiting?: {
    enabled?: boolean;                  // Enable rate limiting
    maxRequestsPerSecond?: number;      // Requests per second limit
    maxRequestsPerDay?: number;         // Daily request limit  
    minRequestInterval?: number;        // Minimum interval between requests (ms)
  };
  
  caching?: {
    enabled?: boolean;                  // Enable response caching
    ttl?: number;                       // Cache TTL in seconds
  };
}
```

## 📝 Examples

### Complete Authentication Flow

```typescript
import { AuthHelper, EtsyClient, createDefaultTokenStorage } from '@profplum700/etsy-v3-api-client';

async function authenticateAndFetchData() {
  // Step 1: Initialize authentication
  const authHelper = new AuthHelper({
    keystring: process.env.ETSY_API_KEY!,
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['shops_r', 'listings_r', 'profile_r']
  });

  // Step 2: Get authorization URL
  const authUrl = await authHelper.getAuthUrl();
  console.log('Visit:', authUrl);

  // Step 3: Handle callback (pseudo-code)
  const { code, state } = await waitForCallback();
  const expectedState = await authHelper.getState();
  
  if (state !== expectedState) {
    throw new Error('State mismatch');
  }

  // Step 4: Exchange for tokens
  await authHelper.setAuthorizationCode(code, state);
  const tokens = await authHelper.getAccessToken();

  // Step 5: Create client with storage
  const storage = createDefaultTokenStorage();
  const client = new EtsyClient({
    keystring: process.env.ETSY_API_KEY!,
    ...tokens
  }, storage);

  // Step 6: Use the API
  const user = await client.getUser();
  const shops = await client.getUserShops();
  
  if (shops.length > 0) {
    const listings = await client.getListingsByShop(shops[0].shop_id.toString());
    console.log(`Found ${listings.length} listings`);
  }
}
```

### Simple Browser Example

Here's a complete working example for browser environments:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Etsy API Client - Browser Example</title>
</head>
<body>
    <div id="app">
        <h1>Etsy API Browser Example</h1>
        <button id="loginBtn">Login with Etsy</button>
        <div id="userInfo" style="display: none;">
            <h2>User Information</h2>
            <div id="userData"></div>
            <button id="getShopsBtn">Get My Shops</button>
            <div id="shopsData"></div>
        </div>
    </div>

    <script type="module">
        import { AuthHelper, EtsyClient, ETSY_SCOPES } from 'https://unpkg.com/@profplum700/etsy-v3-api-client@1.0.0/dist/browser.esm.js';

        // Replace with your actual API key
        const API_KEY = 'your-api-key-here';
        const REDIRECT_URI = window.location.origin + window.location.pathname;

        let authHelper;
        let client;

        // Initialize auth helper
        function initAuth() {
            authHelper = new AuthHelper({
                keystring: API_KEY,
                redirectUri: REDIRECT_URI,
                scopes: [
                    ETSY_SCOPES.SHOPS_READ,
                    ETSY_SCOPES.LISTINGS_READ,
                    ETSY_SCOPES.PROFILE_READ
                ]
            });
        }

        // Handle login button click
        document.getElementById('loginBtn').addEventListener('click', async () => {
            const authUrl = await authHelper.getAuthUrl();
            window.location.href = authUrl;
        });

        // Handle OAuth callback
        async function handleCallback() {
            const urlParams = new URLSearchParams(window.location.search);
            const code = urlParams.get('code');
            const state = urlParams.get('state');

            if (code && state) {
                try {
                    const expectedState = await authHelper.getState();
                    
                    if (state === expectedState) {
                        await authHelper.setAuthorizationCode(code, state);
                        const tokens = await authHelper.getAccessToken();
                        
                        // Create client
                        client = new EtsyClient({
                            keystring: API_KEY,
                            accessToken: tokens.access_token,
                            refreshToken: tokens.refresh_token,
                            expiresAt: tokens.expires_at,
                            rateLimiting: { enabled: true },
                            caching: { enabled: true, ttl: 300 }
                        });

                        // Store tokens in localStorage for persistence
                        localStorage.setItem('etsy_tokens', JSON.stringify(tokens));
                        
                        // Clear URL parameters
                        window.history.replaceState({}, document.title, window.location.pathname);
                        
                        // Show user info
                        await showUserInfo();
                    } else {
                        console.error('State mismatch');
                    }
                } catch (error) {
                    console.error('Authentication failed:', error);
                    alert('Authentication failed. Please try again.');
                }
            }
        }

        // Show user information
        async function showUserInfo() {
            try {
                const user = await client.getUser();
                
                document.getElementById('loginBtn').style.display = 'none';
                document.getElementById('userInfo').style.display = 'block';
                document.getElementById('userData').innerHTML = `
                    <p><strong>User ID:</strong> ${user.user_id}</p>
                    <p><strong>Login Name:</strong> ${user.login_name || 'N/A'}</p>
                    <p><strong>Primary Email:</strong> ${user.primary_email || 'N/A'}</p>
                `;
            } catch (error) {
                console.error('Failed to get user info:', error);
                alert('Failed to get user information.');
            }
        }

        // Get user shops
        document.getElementById('getShopsBtn').addEventListener('click', async () => {
            try {
                const shops = await client.getUserShops();
                
                if (shops.length > 0) {
                    const shopsHtml = shops.map(shop => `
                        <div style="border: 1px solid #ccc; padding: 10px; margin: 10px 0;">
                            <h3>${shop.shop_name}</h3>
                            <p><strong>Shop ID:</strong> ${shop.shop_id}</p>
                            <p><strong>Title:</strong> ${shop.title || 'N/A'}</p>
                            <p><strong>URL:</strong> <a href="${shop.url}" target="_blank">${shop.url}</a></p>
                        </div>
                    `).join('');
                    
                    document.getElementById('shopsData').innerHTML = `
                        <h3>Your Shops (${shops.length})</h3>
                        ${shopsHtml}
                    `;
                } else {
                    document.getElementById('shopsData').innerHTML = '<p>No shops found.</p>';
                }
            } catch (error) {
                console.error('Failed to get shops:', error);
                alert('Failed to get shop information.');
            }
        });

        // Check for existing tokens on page load
        async function checkExistingAuth() {
            const storedTokens = localStorage.getItem('etsy_tokens');
            
            if (storedTokens) {
                try {
                    const tokens = JSON.parse(storedTokens);
                    
                    // Check if tokens are still valid
                    if (new Date(tokens.expires_at) > new Date()) {
                        client = new EtsyClient({
                            keystring: API_KEY,
                            ...tokens,
                            rateLimiting: { enabled: true },
                            caching: { enabled: true, ttl: 300 }
                        });
                        
                        await showUserInfo();
                    } else {
                        // Tokens expired, clear them
                        localStorage.removeItem('etsy_tokens');
                    }
                } catch (error) {
                    console.error('Failed to restore session:', error);
                    localStorage.removeItem('etsy_tokens');
                }
            }
        }

        // Initialize the application
        initAuth();
        await handleCallback();
        await checkExistingAuth();
    </script>
</body>
</html>
```

This example demonstrates:
- Complete OAuth 2.0 flow in the browser
- Token persistence using localStorage
- Error handling for authentication failures
- Making API calls to get user and shop information
- Automatic session restoration on page reload

### React Hook Example

```typescript
import { useState, useEffect } from 'react';
import { EtsyClient, createDefaultTokenStorage } from '@profplum700/etsy-v3-api-client';

function useEtsyClient(tokens) {
  const [client, setClient] = useState(null);

  useEffect(() => {
    if (tokens) {
      const storage = createDefaultTokenStorage({ preferSession: true });
      const etsyClient = new EtsyClient({
        keystring: process.env.REACT_APP_ETSY_API_KEY,
        ...tokens,
        rateLimiting: { enabled: true },
        caching: { enabled: true, ttl: 300 }
      }, storage);
      
      setClient(etsyClient);
    }
  }, [tokens]);

  return client;
}
```

## 🤝 Contributing

Contributions are welcome! Please read our [Contributing Guidelines](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Etsy Open API Documentation](https://developers.etsy.com/documentation)
- [OAuth 2.0 PKCE Specification](https://tools.ietf.org/html/rfc7636)
- [Package on npm](https://www.npmjs.com/package/@profplum700/etsy-v3-api-client)
- [GitHub Repository](https://github.com/profplum700/etsy-v3-api-client)

## ❓ Support

If you have questions or need help:

1. Check the [API Documentation](https://developers.etsy.com/documentation)
2. Search [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)
3. Create a new issue if your question isn't answered

## 🏷️ Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history and release notes.