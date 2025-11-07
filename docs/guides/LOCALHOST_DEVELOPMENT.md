# Localhost Development Guide

**Last Updated:** 2025-11-07

## Overview

Testing OAuth flows on localhost can be challenging because Etsy's OAuth redirect URIs typically require production URLs. This guide provides multiple approaches to develop and test your Etsy integration locally.

## Table of Contents

- [The Challenge](#the-challenge)
- [Method 1: Using ngrok (Recommended for Quick Testing)](#method-1-using-ngrok-recommended-for-quick-testing)
- [Method 2: Mock Authentication (For Rapid Development)](#method-2-mock-authentication-for-rapid-development)
- [Method 3: Developer Tokens (For API Testing)](#method-3-developer-tokens-for-api-testing)
- [Method 4: Local HTTPS with Self-Signed Certificates](#method-4-local-https-with-self-signed-certificates)
- [Best Practices](#best-practices)
- [Troubleshooting](#troubleshooting)

---

## The Challenge

When developing on localhost, you'll encounter this issue:

```typescript
// ❌ This doesn't work on localhost
const authHelper = new AuthHelper({
  keystring: process.env.ETSY_API_KEY,
  redirectUri: 'http://localhost:3000/callback', // Etsy requires HTTPS
  scopes: ['shops_r', 'listings_r']
});

const authUrl = await authHelper.getAuthUrl();
// Etsy OAuth will reject localhost redirect URIs
```

**Why?** Etsy's OAuth implementation requires:
- HTTPS protocol (except for approved localhost URIs)
- Publicly accessible redirect URIs (for production apps)
- Pre-configured redirect URIs in your app settings

---

## Method 1: Using ngrok (Recommended for Quick Testing)

**Best for:** Quick testing, demos, sharing with team members

### Step 1: Install ngrok

```bash
# macOS
brew install ngrok

# Windows (with Chocolatey)
choco install ngrok

# Or download from https://ngrok.com/download
```

### Step 2: Start Your Local Server

```bash
# Start your Next.js/React app
npm run dev
# Usually runs on http://localhost:3000
```

### Step 3: Create ngrok Tunnel

```bash
# Expose your local server
ngrok http 3000

# Output:
# Forwarding  https://abc123.ngrok.io -> http://localhost:3000
```

### Step 4: Update Etsy App Settings

1. Go to [Etsy Developer Portal](https://www.etsy.com/developers/your-apps)
2. Select your app
3. Add the ngrok URL to **Redirect URIs**:
   ```
   https://abc123.ngrok.io/api/etsy/callback
   ```

### Step 5: Update Your Code

```typescript
// .env.local
ETSY_REDIRECT_URI=https://abc123.ngrok.io/api/etsy/callback

// Your authentication code
const authHelper = new AuthHelper({
  keystring: process.env.ETSY_API_KEY!,
  redirectUri: process.env.ETSY_REDIRECT_URI!, // Uses ngrok URL
  scopes: ['shops_r', 'listings_r', 'listings_w']
});
```

### Step 6: Test OAuth Flow

```bash
# Access your app via ngrok URL
open https://abc123.ngrok.io
```

### Pros & Cons

✅ **Pros:**
- Real OAuth flow testing
- Works exactly like production
- Can share URL with teammates
- Supports webhooks testing

❌ **Cons:**
- URL changes on each restart (unless you have paid plan)
- Requires internet connection
- Must update Etsy settings when URL changes

### ngrok Pro Tips

```bash
# Custom subdomain (requires paid plan)
ngrok http 3000 --subdomain=my-etsy-app

# Keep using the same subdomain every time:
# https://my-etsy-app.ngrok.io

# Inspect traffic
# Visit http://127.0.0.1:4040 to see all requests
```

---

## Method 2: Mock Authentication (For Rapid Development)

**Best for:** UI development, testing non-OAuth features, rapid iteration

### Overview

Create a mock authentication system that bypasses OAuth during development.

### Implementation

#### 1. Create Mock Authentication Helper

```typescript
// lib/etsy-mock-auth.ts

export interface MockTokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  timestamp: number;
}

/**
 * Mock authentication for local development
 * DO NOT USE IN PRODUCTION
 */
export class MockEtsyAuth {
  private static readonly STORAGE_KEY = 'mock_etsy_token';

  /**
   * Generate mock tokens for development
   */
  static generateMockToken(): MockTokenData {
    return {
      accessToken: `mock_access_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      refreshToken: `mock_refresh_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      expiresAt: Date.now() + 24 * 60 * 60 * 1000, // 24 hours
      timestamp: Date.now(),
    };
  }

  /**
   * Save mock token to sessionStorage
   */
  static saveMockToken(token?: MockTokenData): void {
    const tokenData = token || this.generateMockToken();

    if (typeof window !== 'undefined') {
      sessionStorage.setItem(this.STORAGE_KEY, JSON.stringify(tokenData));
    }
  }

  /**
   * Load mock token from sessionStorage
   */
  static loadMockToken(): MockTokenData | null {
    if (typeof window === 'undefined') return null;

    const stored = sessionStorage.getItem(this.STORAGE_KEY);
    if (!stored) return null;

    try {
      const token = JSON.parse(stored) as MockTokenData;

      // Check if expired
      if (Date.now() > token.expiresAt) {
        this.clearMockToken();
        return null;
      }

      return token;
    } catch {
      return null;
    }
  }

  /**
   * Clear mock token
   */
  static clearMockToken(): void {
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(this.STORAGE_KEY);
    }
  }

  /**
   * Check if mock token exists and is valid
   */
  static hasMockToken(): boolean {
    const token = this.loadMockToken();
    return token !== null;
  }
}
```

#### 2. Create Development-Only Auth Endpoint

```typescript
// app/api/dev-auth/route.ts (Next.js App Router)

import { NextResponse } from 'next/server';
import { MockEtsyAuth } from '@/lib/etsy-mock-auth';

/**
 * Development-only mock authentication endpoint
 * Remove or disable in production!
 */
export async function GET() {
  // CRITICAL: Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Not available in production' },
      { status: 404 }
    );
  }

  // Generate mock token
  const mockToken = MockEtsyAuth.generateMockToken();

  // In a real scenario, you might want to also return mock user data
  const mockUserData = {
    user_id: 'mock_user_123',
    primary_email: 'dev@localhost.test',
    first_name: 'Developer',
    last_name: 'Mode',
    shop_id: 'mock_shop_456',
    shop_name: 'Dev Test Shop',
  };

  return NextResponse.json({
    ...mockToken,
    user: mockUserData,
  });
}
```

#### 3. Use Mock Auth in Your App

```typescript
// contexts/EtsyAuthContext.tsx

export function useEtsyAuth() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const mockAuthenticate = async () => {
    // Development mode: use mock authentication
    if (process.env.NODE_ENV === 'development' &&
        process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true') {

      const response = await fetch('/api/dev-auth');
      const mockData = await response.json();

      MockEtsyAuth.saveMockToken(mockData);
      setIsAuthenticated(true);

      console.log('[DEV] Mock authentication successful:', mockData.user);
      return;
    }

    // Production mode: use real OAuth
    const authHelper = new AuthHelper({
      keystring: process.env.NEXT_PUBLIC_ETSY_API_KEY!,
      redirectUri: process.env.NEXT_PUBLIC_ETSY_REDIRECT_URI!,
      scopes: ['shops_r', 'listings_r'],
    });

    const authUrl = await authHelper.getAuthUrl();
    window.location.href = authUrl;
  };

  return { isAuthenticated, authenticate: mockAuthenticate };
}
```

#### 4. Configure Environment Variables

```bash
# .env.local

# Enable mock auth for development
NODE_ENV=development
NEXT_PUBLIC_USE_MOCK_AUTH=true

# Real OAuth credentials (used when mock is disabled)
NEXT_PUBLIC_ETSY_API_KEY=your_real_api_key
NEXT_PUBLIC_ETSY_REDIRECT_URI=https://your-production-url.com/callback
```

### Testing with Mock Client

```typescript
// __tests__/etsy-client.test.ts

import { MockEtsyAuth } from '@/lib/etsy-mock-auth';
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

describe('Etsy Client with Mock Auth', () => {
  it('should use mock tokens for development', () => {
    const mockToken = MockEtsyAuth.generateMockToken();
    MockEtsyAuth.saveMockToken(mockToken);

    const token = MockEtsyAuth.loadMockToken();
    expect(token).toBeDefined();
    expect(token?.accessToken).toContain('mock_access_');
  });
});
```

### Pros & Cons

✅ **Pros:**
- No external dependencies (ngrok, etc.)
- Works offline
- Fast iteration cycle
- Great for UI development
- Easy to set up

❌ **Cons:**
- Not testing real OAuth flow
- Mock data may not match production exactly
- Must remember to test with real OAuth before deploying

---

## Method 3: Developer Tokens (For API Testing)

**Best for:** Testing API endpoints, scripts, CLI tools

### Overview

Use long-lived developer tokens for testing API functionality without OAuth.

### Getting a Developer Token

1. Complete the OAuth flow **once** in production or staging
2. Save the access token and refresh token
3. Use them for local development

### Implementation

```typescript
// lib/etsy-dev-client.ts

import { EtsyClient } from '@profplum700/etsy-v3-api-client';

/**
 * Create Etsy client for development with saved tokens
 */
export function createDevEtsyClient() {
  // SECURITY: Store these in .env.local, NEVER commit to git
  const accessToken = process.env.ETSY_DEV_ACCESS_TOKEN!;
  const refreshToken = process.env.ETSY_DEV_REFRESH_TOKEN!;
  const expiresAt = process.env.ETSY_DEV_EXPIRES_AT
    ? new Date(process.env.ETSY_DEV_EXPIRES_AT)
    : new Date(Date.now() + 3600000); // 1 hour from now

  if (!accessToken || !refreshToken) {
    throw new Error(
      'Missing ETSY_DEV_ACCESS_TOKEN or ETSY_DEV_REFRESH_TOKEN. ' +
      'Please set these in .env.local'
    );
  }

  return new EtsyClient({
    keystring: process.env.ETSY_API_KEY!,
    accessToken,
    refreshToken,
    expiresAt,
    refreshSave: (newAccess, newRefresh, newExpires) => {
      // Optional: Log when tokens are refreshed
      console.log('[DEV] Tokens refreshed. Update your .env.local:');
      console.log(`ETSY_DEV_ACCESS_TOKEN=${newAccess}`);
      console.log(`ETSY_DEV_REFRESH_TOKEN=${newRefresh}`);
      console.log(`ETSY_DEV_EXPIRES_AT=${newExpires.toISOString()}`);
    },
  });
}
```

### Environment Configuration

```bash
# .env.local (NEVER commit this file!)

# Etsy API Key
ETSY_API_KEY=your_api_key

# Developer tokens (get these from completing OAuth once)
ETSY_DEV_ACCESS_TOKEN=your_saved_access_token
ETSY_DEV_REFRESH_TOKEN=your_saved_refresh_token
ETSY_DEV_EXPIRES_AT=2025-12-31T00:00:00.000Z
```

### Usage in Scripts

```typescript
// scripts/sync-listings.ts

import { createDevEtsyClient } from '../lib/etsy-dev-client';

async function syncListings() {
  const client = createDevEtsyClient();

  try {
    const user = await client.getUser();
    console.log('Authenticated as:', user.primary_email);

    const listings = await client.findAllActiveListingsByShop({ shop_id: 'your_shop_id' });
    console.log(`Found ${listings.length} listings`);

    // Process listings...
  } catch (error) {
    console.error('Error:', error);
  }
}

syncListings();
```

### CLI Usage

```bash
# Run your script
node scripts/sync-listings.ts

# Or with ts-node
ts-node scripts/sync-listings.ts
```

### Pros & Cons

✅ **Pros:**
- Real API calls with production data
- No ngrok or proxies needed
- Works offline (except for API calls)
- Great for scripts and CLI tools
- Automatic token refresh

❌ **Cons:**
- Tokens expire (need to refresh)
- Must complete OAuth flow once to get tokens
- Can't test OAuth flow itself
- Security risk if tokens are leaked

### Security Best Practices

1. **Never commit tokens to git:**
   ```bash
   # .gitignore
   .env.local
   .env.*.local
   ```

2. **Use environment variables:**
   ```typescript
   // ✅ Good
   const token = process.env.ETSY_DEV_ACCESS_TOKEN;

   // ❌ Bad
   const token = 'hardcoded_token_here';
   ```

3. **Rotate tokens regularly:**
   - Generate new tokens monthly
   - Immediately revoke if compromised

4. **Limit scopes:**
   - Only request scopes you need for development
   - Use read-only scopes when possible

---

## Method 4: Local HTTPS with Self-Signed Certificates

**Best for:** Testing HTTPS-specific features, SSL/TLS testing

### Overview

Run your local server with HTTPS using self-signed certificates.

### Setup for Next.js

#### 1. Generate Self-Signed Certificate

```bash
# Create certificate directory
mkdir -p .certificates

# Generate certificate (valid for 365 days)
openssl req -x509 -out .certificates/localhost.crt \
  -keyout .certificates/localhost.key \
  -newkey rsa:2048 -nodes -sha256 \
  -subj '/CN=localhost' \
  -extensions EXT -config <( \
   printf "[dn]\nCN=localhost\n[req]\ndistinguished_name = dn\n[EXT]\nsubjectAltName=DNS:localhost\nkeyUsage=digitalSignature\nextendedKeyUsage=serverAuth")
```

#### 2. Create HTTPS Server Script

```javascript
// server.js
const { createServer } = require('https');
const { parse } = require('url');
const next = require('next');
const fs = require('fs');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

const httpsOptions = {
  key: fs.readFileSync('./.certificates/localhost.key'),
  cert: fs.readFileSync('./.certificates/localhost.crt'),
};

app.prepare().then(() => {
  createServer(httpsOptions, (req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  }).listen(3000, (err) => {
    if (err) throw err;
    console.log('> Ready on https://localhost:3000');
  });
});
```

#### 3. Update package.json

```json
{
  "scripts": {
    "dev": "node server.js",
    "dev:http": "next dev"
  }
}
```

#### 4. Trust the Certificate

```bash
# macOS
sudo security add-trusted-cert -d -r trustRoot \
  -k /Library/Keychains/System.keychain .certificates/localhost.crt

# Windows (PowerShell as Administrator)
certutil -addstore -f "ROOT" .certificates\localhost.crt

# Linux
sudo cp .certificates/localhost.crt /usr/local/share/ca-certificates/
sudo update-ca-certificates
```

#### 5. Update Etsy Redirect URI

```
https://localhost:3000/api/etsy/callback
```

### Pros & Cons

✅ **Pros:**
- True HTTPS testing
- No external services needed
- Works offline
- Persistent URL

❌ **Cons:**
- Certificate trust warnings
- More complex setup
- May need to update Etsy settings
- Certificate expires after 1 year

---

## Best Practices

### 1. Environment-Specific Configuration

```typescript
// config/etsy.config.ts

export const etsyConfig = {
  development: {
    useMockAuth: true,
    redirectUri: 'http://localhost:3000/callback',
    logLevel: 'debug',
  },
  staging: {
    useMockAuth: false,
    redirectUri: 'https://staging.example.com/callback',
    logLevel: 'info',
  },
  production: {
    useMockAuth: false,
    redirectUri: 'https://app.example.com/callback',
    logLevel: 'error',
  },
};

export const getEtsyConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return etsyConfig[env as keyof typeof etsyConfig];
};
```

### 2. Feature Flags

```typescript
// lib/feature-flags.ts

export const featureFlags = {
  useMockAuth: process.env.NEXT_PUBLIC_USE_MOCK_AUTH === 'true',
  useNgrok: process.env.NEXT_PUBLIC_USE_NGROK === 'true',
  debugMode: process.env.NODE_ENV === 'development',
};
```

### 3. Conditional Rendering

```typescript
// components/AuthButton.tsx

export function AuthButton() {
  if (process.env.NODE_ENV === 'development') {
    return (
      <div>
        <button onClick={realAuth}>Real OAuth</button>
        <button onClick={mockAuth}>Mock Auth (Dev)</button>
      </div>
    );
  }

  return <button onClick={realAuth}>Sign in with Etsy</button>;
}
```

### 4. Safety Checks

```typescript
// Prevent mock auth in production
if (process.env.NODE_ENV === 'production' && process.env.USE_MOCK_AUTH) {
  throw new Error(
    'CRITICAL: Mock authentication is enabled in production! ' +
    'This is a serious security issue. ' +
    'Set USE_MOCK_AUTH=false immediately.'
  );
}
```

---

## Troubleshooting

### Issue: "redirect_uri_mismatch" Error

**Cause:** The redirect URI in your code doesn't match what's configured in Etsy.

**Solution:**
1. Check your Etsy app settings
2. Ensure the redirect URI matches exactly (including protocol, domain, path)
3. Common mistakes:
   - `http://` vs `https://`
   - Trailing slash: `/callback` vs `/callback/`
   - Port number: `:3000` vs `:3001`

### Issue: ngrok URL Changes Every Restart

**Solution:** Use a custom subdomain (requires ngrok paid plan):
```bash
ngrok http 3000 --subdomain=my-consistent-name
```

Or use [ngrok config file](https://ngrok.com/docs/secure-tunnels/ngrok-agent/reference/config):
```yaml
# ~/.ngrok2/ngrok.yml
authtoken: your_auth_token
tunnels:
  etsy:
    proto: http
    addr: 3000
    subdomain: my-etsy-app
```

### Issue: Mock Token Expires

**Solution:** Extend expiry time or add auto-refresh:
```typescript
static generateMockToken(): MockTokenData {
  return {
    accessToken: `mock_access_${Date.now()}`,
    refreshToken: `mock_refresh_${Date.now()}`,
    expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000, // 30 days
    timestamp: Date.now(),
  };
}
```

### Issue: CORS Errors in Browser

**Cause:** Browser blocking requests to Etsy API.

**Solution:** Make requests from server-side:
```typescript
// ❌ Don't call Etsy API directly from browser
const listings = await fetch('https://api.etsy.com/v3/...');

// ✅ Call your own API, which calls Etsy
const listings = await fetch('/api/etsy/listings');
```

### Issue: Self-Signed Certificate Not Trusted

**Solution:**
1. Accept the warning in browser (dev only!)
2. Or properly install the certificate (see Method 4)
3. Or use ngrok instead

---

## Summary

| Method | Best For | Setup Difficulty | Real OAuth | Real API |
|--------|----------|------------------|-----------|----------|
| ngrok | Quick testing, webhooks | Easy | ✅ Yes | ✅ Yes |
| Mock Auth | UI development | Easy | ❌ No | ❌ No |
| Dev Tokens | Scripts, API testing | Medium | ❌ No | ✅ Yes |
| Local HTTPS | HTTPS features | Hard | ✅ Yes | ✅ Yes |

**Recommendation:**
- **Start with ngrok** for initial setup and testing
- **Use mock auth** for rapid UI development
- **Switch to dev tokens** for API integration
- **Test with real OAuth** before production deployment

---

## Related Documentation

- [Authentication Guide](./authentication.md)
- [Getting Started](./getting-started.md)
- [Troubleshooting Common Issues](../troubleshooting/common-issues.md)
- [Security Best Practices](../../SECURITY.md)

---

## Questions or Issues?

If you encounter problems not covered in this guide:
1. Check [Troubleshooting](../troubleshooting/common-issues.md)
2. Search [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)
3. Create a new issue with details about your setup

**Remember:** Never commit OAuth tokens, API keys, or mock authentication code to production!
