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

Two classes take part. `AuthHelper` runs the OAuth 2.0 PKCE flow: it builds the authorization URL and exchanges the returned code for tokens. `EtsyClient` makes API calls with those tokens, refreshes them when they expire, and hands each refreshed set to `refreshSaveAsync` so it can be saved.

This Express app serves a single Etsy account and keeps its tokens in a file:

```typescript
import express from 'express';
import {
  AuthHelper,
  EtsyAuthError,
  EtsyClient,
  EtsyTokens,
  FileTokenStorage
} from '@profplum700/etsy-v3-api-client';

const app = express();
const storage = new FileTokenStorage('./tokens.json');

const KEYSTRING = process.env.ETSY_API_KEY!;
const SHARED_SECRET = process.env.ETSY_SHARED_SECRET!;
const REDIRECT_URI = 'http://localhost:3000/callback';
const SCOPES = ['listings_r', 'shops_r', 'transactions_r'];

// One AuthHelper per login attempt, keyed by its state value. Each holds the
// PKCE code verifier that the callback needs to exchange the code for tokens.
const pendingLogins = new Map<string, AuthHelper>();

// The signed-in client, or null until someone authorises the app.
let client: EtsyClient | null = null;

function createClient(tokens: EtsyTokens): EtsyClient {
  return new EtsyClient({
    keystring: KEYSTRING,
    sharedSecret: SHARED_SECRET,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at,
    // Etsy invalidates the old refresh token on every refresh, so save each
    // new set. The client waits for this save before it uses the new token.
    refreshSaveAsync: (accessToken, refreshToken, expiresAt) =>
      storage.save({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: 'Bearer',
        scope: tokens.scope
      }),
    // Delete the saved tokens when client.clearTokens() is called
    refreshClearAsync: () => storage.clear()
  });
}

// Step 1: Start authentication
app.get('/auth/etsy', async (req, res) => {
  try {
    const auth = new AuthHelper({
      keystring: KEYSTRING,
      redirectUri: REDIRECT_URI,
      scopes: SCOPES
    });
    const state = await auth.getState();
    pendingLogins.set(state, auth);
    // Forget login attempts that are never completed
    setTimeout(() => pendingLogins.delete(state), 10 * 60 * 1000).unref();

    res.redirect(await auth.getAuthUrl());
  } catch (error) {
    console.error('Failed to start authentication:', error);
    res.status(500).send('Failed to start authentication');
  }
});

// Step 2: Handle callback
app.get('/callback', async (req, res) => {
  const { code, state, error } = req.query;

  if (typeof error === 'string') {
    return res.status(400).send('Authorization was declined');
  }
  if (typeof code !== 'string' || typeof state !== 'string') {
    return res.status(400).send('Missing code or state');
  }

  // The state must match a login this server started (CSRF protection)
  const auth = pendingLogins.get(state);
  pendingLogins.delete(state);
  if (!auth) {
    return res.status(400).send('Unknown or expired login attempt');
  }

  try {
    // Exchange the code for tokens
    await auth.setAuthorizationCode(code, state);
    const tokens = await auth.getAccessToken();

    // Save them first, then create the client from them
    await storage.save(tokens);
    client = createClient(tokens);

    res.redirect('/dashboard');
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).send('Authentication failed');
  }
});

// Protected route example
app.get('/dashboard', async (req, res) => {
  if (!client) {
    return res.redirect('/auth/etsy');
  }

  try {
    const shop = await client.getShop(); // the authorised user's shop
    const listings = await client.getListingsByShop(shop.shop_id.toString(), {
      limit: 10,
      state: 'active'
    });

    res.json({
      shop: shop.shop_name,
      activeListings: listings.length,
      listings
    });
  } catch (error) {
    // Etsy refused the refresh token (expired, or access was removed):
    // the user has to authorise the app again.
    if (error instanceof EtsyAuthError && error.code === 'REAUTH_REQUIRED') {
      await client.clearTokens(); // deletes the saved tokens and cached data
      client = null;
      return res.redirect('/auth/etsy');
    }
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load shop data' });
  }
});

async function main() {
  // Pick up tokens saved by an earlier run
  const saved = await storage.load();
  if (saved) client = createClient(saved);

  app.listen(3000, () => {
    console.log('Server running on http://localhost:3000');
    console.log('Start auth: http://localhost:3000/auth/etsy');
  });
}

main();
```

The access token lasts an hour and the client refreshes it when needed, so after the first login the app keeps working across restarts until the refresh token expires or the user removes the app's access.

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

### Refresh Token Rotation and Failed Saves

Etsy issues a new refresh token on every refresh, and the old one may stop
working. The client saves the new tokens (token storage, `refreshSave` or
`refreshSaveAsync`) before it uses them. If the save fails, the call throws
`EtsyAuthError` with code `TOKEN_SAVE_FAILED` and the storage error as
`error.cause`. The new tokens are then held only in memory; the next refresh
retries the save without asking Etsy again.

If the process exits before a save succeeds, the new refresh token is lost,
and Etsy may require the user to authorise again. Handle `TOKEN_SAVE_FAILED`
explicitly:

```typescript
import { EtsyAuthError } from '@profplum700/etsy-v3-api-client';

async function getShop(shopId: string) {
  try {
    return await client.getShop(shopId);
  } catch (error) {
    if (error instanceof EtsyAuthError && error.code === 'TOKEN_SAVE_FAILED') {
      // The new tokens are only in memory: keep the process running and retry
      // the save. refreshToken() re-saves the pending tokens without asking
      // Etsy again. Log the code, not error.cause: a custom save callback's
      // error may contain tokens.
      console.error('Saving refreshed tokens failed:', error.code);
      setTimeout(() => {
        client.refreshToken().catch((retryError) => {
          console.error('Retrying the token save failed:',
            retryError instanceof EtsyAuthError ? retryError.code : 'unknown error');
        });
      }, 30_000);
      return undefined;
    }
    throw error;
  }
}
```

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

`EtsyClient` takes a single config object and does not accept a storage object. To keep tokens across restarts, load the saved set from your storage when you create the client, and save every refreshed set through `refreshSaveAsync`. The client waits for `refreshSaveAsync` to finish before it uses the new access token. This matters because Etsy invalidates the old refresh token on each refresh, so a refresh that is never saved locks the app out on the next start.

This helper works with any `TokenStorage`. The examples below use it:

```typescript
import { EtsyClient, TokenStorage } from '@profplum700/etsy-v3-api-client';

async function createClientFromStorage(storage: TokenStorage): Promise<EtsyClient> {
  // Load the tokens saved after the user authorised the app
  const saved = await storage.load();
  if (!saved) throw new Error('No saved tokens: authorise the app first');

  return new EtsyClient({
    keystring: process.env.ETSY_API_KEY!,
    sharedSecret: process.env.ETSY_SHARED_SECRET!,
    accessToken: saved.access_token,
    refreshToken: saved.refresh_token,
    expiresAt: saved.expires_at,
    // Save every refreshed token set before the client uses it
    refreshSaveAsync: (accessToken, refreshToken, expiresAt) =>
      storage.save({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: expiresAt,
        token_type: 'Bearer',
        scope: saved.scope
      }),
    // Delete the saved tokens when client.clearTokens() is called
    refreshClearAsync: () => storage.clear()
  });
}
```

#### File Storage

```typescript
import { FileTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new FileTokenStorage('./tokens.json');
const client = await createClientFromStorage(storage);
```

#### Encrypted File Storage

**Recommended for production:**

```typescript
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client';

// ENCRYPTION_KEY holds 32 random bytes as hex, generated once and kept, e.g.
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// A new key on each start would make the saved tokens unreadable.
const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: Buffer.from(process.env.ENCRYPTION_KEY!, 'hex')
});

const client = await createClientFromStorage(storage);
```

#### Memory Storage

**For testing only:** tokens are lost when the process exits, and the storage starts empty, so save a token set before creating the client.

```typescript
import { MemoryTokenStorage } from '@profplum700/etsy-v3-api-client';

const storage = new MemoryTokenStorage();
await storage.save(testTokens); // an EtsyTokens object from your test setup
const client = await createClientFromStorage(storage);
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
    if (!data) return null;
    const tokens = JSON.parse(data);
    // JSON stores dates as strings; turn expires_at back into a Date
    return { ...tokens, expires_at: new Date(tokens.expires_at) };
  }

  async clear(): Promise<void> {
    await this.redis.del(this.key);
  }
}

// Usage
const storage = new RedisTokenStorage('redis://localhost:6379');
const client = await createClientFromStorage(storage);
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

// Create client per user, starting from that user's saved tokens.
// createClientFromStorage is the helper from "Token Storage Options";
// it saves each refreshed token set back to this user's row.
function getClientForUser(userId: string): Promise<EtsyClient> {
  const storage = new DatabaseTokenStorage(userId, db);
  return createClientFromStorage(storage);
}

// Usage in route handler
app.get('/api/shop', async (req, res) => {
  const userId = req.user.id;
  const client = await getClientForUser(userId);

  const shop = await client.getShopByOwnerUserId();
  res.json(shop);
});
```

### Token Rotation

To refresh tokens before they expire, pass `tokenRotation` in the client config. The client's own token manager rotates the tokens it signs requests with. Etsy invalidates the old refresh token on each rotation, so if you keep tokens between runs, `config` must also set `refreshSave` or `refreshSaveAsync` to save each rotated set; `onRotation` alone does not save anything:

```typescript
const client = new EtsyClient({
  ...config,
  tokenRotation: {
    enabled: true,
    rotateBeforeExpiry: 15 * 60 * 1000, // rotate 15 minutes before expiry
    autoSchedule: true,                 // check in the background
    checkInterval: 60 * 1000,           // every minute
    onRotation: (oldTokens, newTokens) => {
      console.log('Tokens rotated, new expiry:', newTokens.expires_at);
    }
  }
});

// When you discard the client:
client.stopTokenRotation();
```

Do not rotate with a separate `TokenManager` next to the client: Etsy invalidates the old refresh token on each refresh, so the client would be left holding a spent one. See [Proactive Token Rotation](../PHASE5-SECURITY.md#proactive-token-rotation) for the full options.

### Logout / Revoke Access

`client.clearTokens()` signs the user out. It waits for any token refresh already under way, then clears the client's tokens, deletes the saved copy through `refreshClearAsync` (and token storage, if one is attached), and clears the response cache:

```typescript
await client.clearTokens();

// Calls on this client now throw EtsyAuthError NO_TOKENS instead of serving
// cached data, and createClientFromStorage(storage) throws until the user
// authorises again
```

When `config` sets `refreshSaveAsync`, it must also set `refreshClearAsync`, as `createClientFromStorage` above does. Without it `clearTokens()` throws `EtsyAuthError` with code `TOKEN_CLEAR_CALLBACK_REQUIRED`, because it cannot delete the saved tokens.

This removes your copy of the tokens only. It does not revoke the app's access at Etsy.

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
