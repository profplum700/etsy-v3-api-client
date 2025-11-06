# Authentication Guide

This guide provides a comprehensive overview of authentication with the Etsy v3 API using OAuth 2.0 with PKCE.

## Table of Contents

- [Overview](#overview)
- [Setting Up Your Etsy App](#setting-up-your-etsy-app)
- [OAuth 2.0 with PKCE Flow](#oauth-20-with-pkce-flow)
- [Implementation](#implementation)
- [Token Management](#token-management)
- [Security Best Practices](#security-best-practices)
- [Advanced Topics](#advanced-topics)

## Overview

The Etsy v3 API uses OAuth 2.0 with PKCE (Proof Key for Code Exchange) for authentication. This is a secure authentication method that doesn't require storing client secrets.

### Key Concepts

- **API Key**: Your application's identifier (client_id)
- **Access Token**: Short-lived token for API requests (1 hour)
- **Refresh Token**: Long-lived token for getting new access tokens (90 days)
- **PKCE**: Security extension that prevents authorization code interception
- **Scopes**: Permissions your app requests

## Setting Up Your Etsy App

### 1. Create an Etsy Developer Account

1. Go to [https://www.etsy.com/developers](https://www.etsy.com/developers)
2. Sign in with your Etsy account
3. Navigate to "Your Apps"

### 2. Create a New App

1. Click "Create a new app"
2. Fill in the app details:
   - **App Name**: Your application name
   - **Description**: What your app does
   - **Callback URL**: Where Etsy redirects after authorization
     - Development: `http://localhost:3000/callback`
     - Production: `https://yourdomain.com/callback`

### 3. Get Your API Key

After creating the app, you'll receive:
- **Keystring**: Your API key (client_id)

**Important**: The Etsy v3 API doesn't use client secrets with PKCE.

## OAuth 2.0 with PKCE Flow

### Flow Diagram

```
User                    Your App                 Etsy
 |                        |                        |
 |--1. Click "Connect"--->|                        |
 |                        |--2. Generate code----->|
 |                        |    verifier/challenge  |
 |                        |                        |
 |                        |--3. Redirect to------->|
 |                        |    authorization URL   |
 |                        |                        |
 |<-4. Authorization UI---------------------|
 |                        |                        |
 |--5. Approve----------->|                        |
 |                        |                        |
 |<-6. Redirect with code-|                        |
 |                        |                        |
 |--7. Send code--------->|                        |
 |                        |--8. Exchange code----->|
 |                        |    with verifier       |
 |                        |                        |
 |                        |<--9. Return tokens-----|
 |                        |                        |
 |<-10. Access granted----|                        |
```

### Steps Explained

1. **User initiates**: User clicks "Connect with Etsy"
2. **Generate PKCE**: App generates code verifier and challenge
3. **Redirect to Etsy**: App redirects to Etsy authorization page
4. **User authorizes**: User logs in and approves permissions
5. **Redirect back**: Etsy redirects to your callback URL with code
6. **Exchange code**: App exchanges code + verifier for tokens
7. **Store tokens**: App securely stores access and refresh tokens

## Implementation

### Basic Setup

```typescript
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: 'http://localhost:3000/callback',
  scopes: [
    'listings_r',      // Read listings
    'listings_w',      // Write listings
    'shops_r',         // Read shop details
    'shops_w',         // Update shop
    'transactions_r',  // Read transactions
    'transactions_w',  // Update transactions
    'email_r',         // Read email
    'profile_r',       // Read profile
    'profile_w',       // Update profile
    'address_r',       // Read addresses
    'address_w'        // Update addresses
  ]
});
```

### Available Scopes

| Scope | Description |
|-------|-------------|
| `listings_r` | Read listing data |
| `listings_w` | Create/update/delete listings |
| `listings_d` | Delete listings |
| `shops_r` | Read shop data |
| `shops_w` | Update shop settings |
| `transactions_r` | Read transactions and receipts |
| `transactions_w` | Update transactions |
| `email_r` | Read user's email address |
| `profile_r` | Read user profile |
| `profile_w` | Update user profile |
| `address_r` | Read shipping addresses |
| `address_w` | Update shipping addresses |

### Complete Authentication Example

```typescript
import express from 'express';
import { EtsyClient, FileTokenStorage } from '@profplum700/etsy-v3-api-client';

const app = express();
const storage = new FileTokenStorage('./tokens.json');

const client = new EtsyClient(
  {
    apiKey: process.env.ETSY_API_KEY!,
    redirectUri: 'http://localhost:3000/callback',
    scopes: ['listings_r', 'shops_r', 'transactions_r']
  },
  storage
);

// Step 1: Start authentication
app.get('/auth/etsy', async (req, res) => {
  try {
    const authUrl = await client.getAuthorizationUrl();
    res.redirect(authUrl);
  } catch (error) {
    res.status(500).send('Failed to generate auth URL: ' + error.message);
  }
});

// Step 2: Handle callback
app.get('/callback', async (req, res) => {
  try {
    const code = req.query.code as string;

    if (!code) {
      return res.status(400).send('No authorization code received');
    }

    // Exchange code for tokens
    await client.exchangeAuthorizationCode(code);

    // Verify authentication
    const isAuth = await client.isAuthenticated();

    if (isAuth) {
      // Get user's shop
      const shop = await client.getShopByOwnerUserId();
      res.send(`
        <h1>Authentication Successful!</h1>
        <p>Connected to shop: ${shop.shop_name}</p>
        <p>Shop ID: ${shop.shop_id}</p>
        <a href="/dashboard">Go to Dashboard</a>
      `);
    } else {
      res.status(500).send('Authentication verification failed');
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).send('Authentication failed: ' + error.message);
  }
});

// Protected route example
app.get('/dashboard', async (req, res) => {
  try {
    if (!(await client.isAuthenticated())) {
      return res.redirect('/auth/etsy');
    }

    const shop = await client.getShopByOwnerUserId();
    const listings = await client.getListingsByShop(shop.shop_id.toString(), {
      limit: 10,
      state: 'active'
    });

    res.json({
      shop: shop.shop_name,
      activeListings: listings.results.length,
      listings: listings.results
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Start auth: http://localhost:3000/auth/etsy');
});
```

## Token Management

### Automatic Token Refresh

Tokens are automatically refreshed when they expire:

```typescript
// The client automatically refreshes tokens before they expire
const shop = await client.getShop('123');
// If token expired, it's refreshed automatically
```

### Manual Token Refresh

You can manually refresh tokens:

```typescript
try {
  await client.refreshAccessToken();
  console.log('Tokens refreshed successfully');
} catch (error) {
  console.error('Failed to refresh tokens:', error);
  // User needs to re-authenticate
}
```

### Token Expiration

- **Access Token**: Expires after 1 hour
- **Refresh Token**: Expires after 90 days

### Handling Token Expiration

```typescript
import { EtsyApiError } from '@profplum700/etsy-v3-api-client';

async function makeApiCall() {
  try {
    return await client.getShopByOwnerUserId();
  } catch (error) {
    if (error instanceof EtsyApiError && error.statusCode === 401) {
      // Token expired and refresh failed
      // Redirect user to re-authenticate
      console.log('Please re-authenticate');
      const authUrl = await client.getAuthorizationUrl();
      // Redirect to authUrl
    }
    throw error;
  }
}
```

### Token Storage Options

#### File Storage

```typescript
import { FileTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new FileTokenStorage('./tokens.json');
const client = new EtsyClient(config, storage);
```

#### Encrypted File Storage

**Recommended for production:**

```typescript
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client';
import crypto from 'crypto';

// Generate a 32-byte encryption key
const encryptionKey = process.env.ENCRYPTION_KEY ||
  crypto.randomBytes(32).toString('hex');

const storage = new EncryptedFileTokenStorage(
  './tokens.enc',
  encryptionKey
);

const client = new EtsyClient(config, storage);
```

#### Memory Storage

**For testing only:**

```typescript
import { MemoryTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new MemoryTokenStorage();
const client = new EtsyClient(config, storage);
```

#### Custom Storage

```typescript
import { TokenStorage, EtsyTokens } from '@profplum700/etsy-v3-api-client';
import Redis from 'ioredis';

class RedisTokenStorage implements TokenStorage {
  private redis: Redis;
  private key: string;

  constructor(redisUrl: string, key = 'etsy:tokens') {
    this.redis = new Redis(redisUrl);
    this.key = key;
  }

  async save(tokens: EtsyTokens): Promise<void> {
    await this.redis.set(this.key, JSON.stringify(tokens));
    // Set expiry based on refresh token lifetime
    await this.redis.expire(this.key, 90 * 24 * 60 * 60); // 90 days
  }

  async load(): Promise<EtsyTokens | null> {
    const data = await this.redis.get(this.key);
    return data ? JSON.parse(data) : null;
  }

  async clear(): Promise<void> {
    await this.redis.del(this.key);
  }
}

// Usage
const storage = new RedisTokenStorage('redis://localhost:6379');
const client = new EtsyClient(config, storage);
```

## Security Best Practices

### 1. Secure Storage

- **Never commit tokens** to version control
- Use encrypted storage in production
- Store encryption keys in environment variables
- Use proper file permissions (0600) for token files

### 2. Environment Variables

```bash
# .env
ETSY_API_KEY=your_api_key_here
ENCRYPTION_KEY=your_32_byte_encryption_key_here
REDIRECT_URI=https://yourdomain.com/callback
```

```typescript
import dotenv from 'dotenv';
dotenv.config();

const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.REDIRECT_URI!,
  scopes: ['listings_r', 'shops_r']
});
```

### 3. HTTPS in Production

Always use HTTPS for redirect URIs in production:

```typescript
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.NODE_ENV === 'production'
    ? 'https://yourdomain.com/callback'
    : 'http://localhost:3000/callback',
  scopes: ['listings_r', 'shops_r']
});
```

### 4. State Parameter

Add state parameter to prevent CSRF attacks:

```typescript
// Generate random state
const state = crypto.randomBytes(32).toString('hex');

// Store in session
req.session.oauthState = state;

// Add to auth URL
const authUrl = await client.getAuthorizationUrl({ state });

// Verify in callback
app.get('/callback', (req, res) => {
  const receivedState = req.query.state;
  const savedState = req.session.oauthState;

  if (receivedState !== savedState) {
    return res.status(400).send('Invalid state parameter');
  }

  // Proceed with code exchange
});
```

### 5. Scope Minimization

Only request scopes you actually need:

```typescript
// Bad - requesting unnecessary permissions
const client = new EtsyClient({
  scopes: ['listings_r', 'listings_w', 'shops_r', 'shops_w',
           'transactions_r', 'transactions_w', 'email_r']
});

// Good - only what you need
const client = new EtsyClient({
  scopes: ['listings_r', 'shops_r']  // Read-only access
});
```

## Advanced Topics

### Multi-User Applications

For apps serving multiple users:

```typescript
import { EtsyClient, TokenStorage, EtsyTokens } from '@profplum700/etsy-v3-api-client';

class DatabaseTokenStorage implements TokenStorage {
  constructor(private userId: string, private db: Database) {}

  async save(tokens: EtsyTokens): Promise<void> {
    await this.db.updateUser(this.userId, { etsyTokens: tokens });
  }

  async load(): Promise<EtsyTokens | null> {
    const user = await this.db.getUser(this.userId);
    return user?.etsyTokens || null;
  }

  async clear(): Promise<void> {
    await this.db.updateUser(this.userId, { etsyTokens: null });
  }
}

// Create client per user
function getClientForUser(userId: string): EtsyClient {
  const storage = new DatabaseTokenStorage(userId, db);
  return new EtsyClient(config, storage);
}

// Usage in route handler
app.get('/api/shop', async (req, res) => {
  const userId = req.user.id;
  const client = getClientForUser(userId);

  const shop = await client.getShopByOwnerUserId();
  res.json(shop);
});
```

### Token Rotation

Implement proactive token rotation:

```typescript
// Rotate tokens before expiry
setInterval(async () => {
  try {
    await client.refreshAccessToken();
    console.log('Tokens rotated successfully');
  } catch (error) {
    console.error('Token rotation failed:', error);
  }
}, 30 * 60 * 1000); // Every 30 minutes
```

### Logout / Revoke Access

```typescript
// Clear stored tokens
await client.clearTokens();

// User will need to re-authenticate
const isAuth = await client.isAuthenticated(); // false
```

## Troubleshooting

### Common Issues

**"Invalid redirect URI"**
- Ensure redirect URI in code matches exactly what's configured in Etsy app
- Check for trailing slashes
- Verify HTTP vs HTTPS

**"Invalid scope"**
- Check scope names are spelled correctly
- Ensure scopes are valid for Etsy v3 API

**"Token expired"**
- Implement automatic refresh
- Handle 401 errors and re-authenticate

**"State parameter mismatch"**
- Ensure state is stored and verified correctly
- Check session configuration

For more troubleshooting tips, see the [Troubleshooting Guide](../troubleshooting/common-issues.md).

## Next Steps

- [Listing Management](./listing-management.md)
- [Order Fulfillment](./order-fulfillment.md)
- [API Reference](../api-reference/README.md)
