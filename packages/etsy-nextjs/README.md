# @profplum700/etsy-nextjs

Next.js integration for the Etsy v3 API client. Seamlessly integrate Etsy into your Next.js applications with Server Components, API Routes, and more.

This package is based on the official Etsy OpenAPI specification (`https://www.etsy.com/openapi/generated/oas/3.0.0.json`), as referenced in Etsy's API documentation (`https://developers.etsy.com/documentation/reference`).

## Installation

```bash
npm install @profplum700/etsy-nextjs @profplum700/etsy-v3-api-client
```

## Features

- Server Components support
- API Routes helpers
- Automatic rate limiting
- Built-in caching
- Cookie-based token storage
- Edge Runtime compatibility
- TypeScript support
- Optimized bundle sizes with tree-shakeable exports

## Package Structure

This package provides three separate entry points to ensure optimal bundle sizes and prevent build errors:

### 📦 Entry Points

1. **`@profplum700/etsy-nextjs`** (Main Entry - Server-Only)
   - **Server-side code with zero React dependencies**
   - Safe for Next.js API Routes, Server Components, and Server Actions
   - Prevents "createContext is not a function" build errors
   - **Default export - use this for API routes and server code**
   - Exports: `configureEtsyServerClient`, `getEtsyServerClient`, `createEtsyServerClient`, `createEtsyApiRoute`

2. **`@profplum700/etsy-nextjs/server`** (Server-Only)
   - Explicit server-side entry point (same as main entry)
   - Server-side code with **zero React dependencies**
   - Optimized for Next.js Server Components, API Routes, and Server Actions
   - Exports: `configureEtsyServerClient`, `getEtsyServerClient`, `createEtsyServerClient`, `createEtsyApiRoute`

3. **`@profplum700/etsy-nextjs/client`** (Client-Only)
   - **Client-side React code**
   - **Must be imported explicitly for client components**
   - Optimized for browser environments
   - Exports: `EtsyNextClientProvider`, `useEtsyNextClient`

### 🎯 Why Separate Entry Points?

The main entry point now exports **only server-side code** to prevent React Context code (createContext, useContext) from being bundled with API routes. This eliminates the "createContext is not a function" build error that occurred when Next.js tried to analyze API routes during build time.

**Benefits:**
- ✅ **Safe by default**: Main entry is safe for API routes (no React dependencies)
- ✅ **Build stability**: No "createContext is not a function" errors
- ✅ **Zero React overhead**: Server bundles have no React dependencies
- ✅ **Tree-shakeable**: Only bundle what you need
- ✅ **Explicit imports**: Client code must be explicitly imported from `/client`
- ✅ **Type-safe**: Full TypeScript support for all entry points

### 💡 Usage Guide

**For API Routes and Server Components (default):**
```typescript
// Both work - main entry is now server-only
import { createEtsyApiRoute } from '@profplum700/etsy-nextjs';
import { createEtsyApiRoute } from '@profplum700/etsy-nextjs/server';
```

**For Client Components (explicit import required):**
```typescript
// Must import from /client subpath
import { EtsyNextClientProvider, useEtsyNextClient } from '@profplum700/etsy-nextjs/client';
```

**Note:** As of v2.3.6+, the main entry point only exports server-side code. Client-side features must be imported from `@profplum700/etsy-nextjs/client`.

## OAuth Authentication

This package provides complete OAuth 2.0 authentication handlers for Etsy API v3 with PKCE flow support.

### OAuth Route Setup

Create a catch-all route for OAuth handling:

```typescript
// app/api/etsy/auth/[...etsy]/route.ts
import '@/lib/etsy-server'; // Ensure config is loaded
import { createOAuthRoute } from '@profplum700/etsy-nextjs';

const handler = createOAuthRoute();
export { handler as GET, handler as POST };
```

This creates the following OAuth endpoints:
- `GET /api/etsy/auth/authorize` - Start OAuth flow
- `GET /api/etsy/auth/callback` - OAuth callback (receives code)
- `POST /api/etsy/auth/refresh` - Refresh access token
- `POST /api/etsy/auth/logout` - Clear auth cookies

### OAuth Flow Example

1. **Start OAuth Flow** - Redirect user to Etsy authorization:

```typescript
// In your component or page
<a href="/api/etsy/auth/authorize">Connect to Etsy</a>

// Or programmatically
const response = await fetch('/api/etsy/auth/authorize', {
  headers: { accept: 'application/json' }
});
const { authUrl } = await response.json();
window.location.href = authUrl;
```

2. **Handle Callback** - User is redirected back to your app with tokens automatically stored in cookies

3. **Use Authenticated Client** - Access tokens are automatically loaded from cookies:

```typescript
// Server Component
import { getEtsyServerClient } from '@profplum700/etsy-nextjs';

export default async function MyShopPage() {
  const client = await getEtsyServerClient(); // Tokens loaded from cookies
  const shop = await client.getShop('me'); // Get authenticated user's shop
  return <div>{shop.title}</div>;
}
```

4. **Refresh Tokens** - Automatically handled, or manually refresh:

```typescript
await fetch('/api/etsy/auth/refresh', { method: 'POST' });
```

5. **Logout** - Clear all auth cookies:

```typescript
await fetch('/api/etsy/auth/logout', { method: 'POST' });
```

### OAuth Security Features

- **PKCE Flow**: Secure OAuth 2.0 flow with code challenge/verifier
- **State Verification**: CSRF protection with state parameter validation
- **Secure Cookies**: HTTP-only cookies for token storage
- **Automatic Token Refresh**: Tokens are automatically refreshed when expired
- **Cookie Expiration**: Tokens expire based on Etsy's token lifetime

### OAuth Configuration

Configure OAuth settings in your server config:

```typescript
// lib/etsy-server.ts
import { configureEtsyServerClient } from '@profplum700/etsy-nextjs';

configureEtsyServerClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.ETSY_REDIRECT_URI!, // e.g., http://localhost:3000/api/etsy/auth/callback
  scopes: [
    'listings_r',    // Read listings
    'listings_w',    // Write listings
    'shops_r',       // Read shops
    'transactions_r', // Read transactions
  ],
  cookieName: 'etsy-tokens', // Optional custom cookie name
});
```

### OAuth Cookie Names

The OAuth handler uses the following cookies:

- `etsy_access_token` - Access token
- `etsy_refresh_token` - Refresh token
- `etsy_token_type` - Token type (Bearer)
- `etsy_expires_at` - Token expiration timestamp
- `etsy_oauth_state` - OAuth state (temporary, for callback)
- `etsy_code_verifier` - PKCE code verifier (temporary, for callback)
- `etsy-tokens` - Combined tokens (for compatibility)

All cookies are HTTP-only and secure in production.

## Quick Start

### 1. Configure the Server Client

Create a configuration file (e.g., `lib/etsy-server.ts`):

```typescript
import { configureEtsyServerClient } from '@profplum700/etsy-nextjs/server';

configureEtsyServerClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.ETSY_REDIRECT_URI!,
  scopes: ['listings_r', 'listings_w', 'shops_r'],
});
```

### 2. Use in Server Components

```typescript
// app/shop/[shopId]/page.tsx
import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';

export default async function ShopPage({ params }: { params: { shopId: string } }) {
  const client = await getEtsyServerClient();
  const shop = await client.getShop(params.shopId);

  return (
    <div>
      <h1>{shop.title}</h1>
      <p>{shop.announcement}</p>
    </div>
  );
}
```

### 3. Create API Routes

```typescript
// app/api/etsy/[...path]/route.ts
import { createEtsyApiRoute } from '@profplum700/etsy-nextjs/server';

export const { GET, POST, PUT, DELETE } = createEtsyApiRoute({
  apiKey: process.env.ETSY_API_KEY!,
  rateLimit: {
    requests: 100,
    window: 60000, // 1 minute
  },
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
  },
});
```

### 4. Use in Client Components

```typescript
'use client';

import { EtsyNextClientProvider, useEtsyNextClient } from '@profplum700/etsy-nextjs/client';
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  apiKey: process.env.NEXT_PUBLIC_ETSY_API_KEY!,
});

export default function App({ children }) {
  return (
    <EtsyNextClientProvider client={client} apiEndpoint="/api/etsy">
      {children}
    </EtsyNextClientProvider>
  );
}

function MyComponent() {
  const { client } = useEtsyNextClient();

  // Use the client in your component
  const handleFetch = async () => {
    const shop = await client.getShop('123');
    console.log(shop);
  };

  return <button onClick={handleFetch}>Fetch Shop</button>;
}
```

## API Reference

### Server-Side

#### `configureEtsyServerClient(config)`

Configure the global Etsy server client.

```typescript
interface EtsyServerClientConfig {
  apiKey: string;
  redirectUri?: string;
  scopes?: string[];
  cookieName?: string;
  encryptionKey?: string;
}
```

#### `getEtsyServerClient()`

Get the configured Etsy server client instance. Use in Server Components and Server Actions.

```typescript
const client = await getEtsyServerClient();
```

#### `createEtsyServerClient(config)`

Create a new Etsy server client with custom configuration.

```typescript
const client = createEtsyServerClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.ETSY_REDIRECT_URI!,
});
```

#### `createEtsyApiRoute(config)`

Create API route handlers with built-in rate limiting and caching.

```typescript
interface EtsyApiRouteConfig {
  apiKey: string;
  redirectUri?: string;
  scopes?: string[];
  rateLimit?: {
    requests: number;
    window: number; // in milliseconds
  };
  cache?: {
    enabled: boolean;
    ttl: number; // in seconds
  };
}
```

#### `createOAuthRoute()`

Create OAuth 2.0 authentication route handlers with PKCE flow support.

```typescript
const handler = createOAuthRoute();
export { handler as GET, handler as POST };
```

**Features:**
- Handles authorize, callback, refresh, and logout actions
- PKCE flow with code challenge/verifier
- State verification for CSRF protection
- Secure HTTP-only cookie storage
- Automatic token storage in compatible format

**Endpoints Created:**
- `GET /authorize` - Start OAuth flow
- `GET /callback` - Handle OAuth callback
- `POST /refresh` - Refresh access token
- `POST /logout` - Clear authentication cookies

**Types:**
```typescript
interface OAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
}
```

### Client-Side

#### `<EtsyNextClientProvider>`

Provider component for client-side Etsy client.

```tsx
<EtsyNextClientProvider client={client} apiEndpoint="/api/etsy">
  {children}
</EtsyNextClientProvider>
```

#### `useEtsyNextClient()`

Hook to access the Etsy client in client components.

```typescript
const { client, apiEndpoint } = useEtsyNextClient();
```

## Usage Examples

### Server Component with Data Fetching

```typescript
// app/listings/page.tsx
import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';

export default async function ListingsPage() {
  const client = await getEtsyServerClient();
  const response = await client.getListingsByShop('123', {
    state: 'active',
    limit: 25,
  });

  return (
    <div>
      <h1>Listings</h1>
      <ul>
        {response.results.map((listing) => (
          <li key={listing.listing_id}>{listing.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

### API Route with Rate Limiting

```typescript
// app/api/shop/[shopId]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { shopId: string } }
) {
  try {
    const client = await getEtsyServerClient();
    const shop = await client.getShop(params.shopId);

    return NextResponse.json(shop);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch shop' },
      { status: 500 }
    );
  }
}
```

### Server Action

```typescript
'use server';

import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';
import { revalidatePath } from 'next/cache';

export async function updateListing(shopId: string, listingId: string, updates: any) {
  const client = await getEtsyServerClient();
  const result = await client.updateListing(shopId, listingId, updates);

  // Revalidate the page to show updated data
  revalidatePath(`/listings/${listingId}`);

  return result;
}
```

### Static Site Generation (SSG)

```typescript
// app/shop/[shopId]/page.tsx
import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';

export async function generateStaticParams() {
  // Generate paths for your shops
  return [
    { shopId: '123' },
    { shopId: '456' },
  ];
}

export default async function ShopPage({ params }: { params: { shopId: string } }) {
  const client = await getEtsyServerClient();
  const shop = await client.getShop(params.shopId);

  return <div>{shop.title}</div>;
}
```

### Incremental Static Regeneration (ISR)

```typescript
// app/listings/page.tsx
import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';

export const revalidate = 3600; // Revalidate every hour

export default async function ListingsPage() {
  const client = await getEtsyServerClient();
  const response = await client.getListingsByShop('123');

  return <div>{/* Render listings */}</div>;
}
```

## Environment Variables

```env
# Required
ETSY_API_KEY=your_api_key

# Optional
ETSY_REDIRECT_URI=http://localhost:3000/auth/callback
ETSY_SCOPES=listings_r,listings_w,shops_r
```

## TypeScript Support

All functions and components are fully typed with TypeScript.

```typescript
// Server types
import type {
  EtsyServerClientConfig,
  EtsyApiRouteConfig,
} from '@profplum700/etsy-nextjs/server';

// Client types (if needed)
import type {
  EtsyNextClientProvider,
  useEtsyNextClient,
} from '@profplum700/etsy-nextjs/client';

// Or use the main entry for all types
import type {
  EtsyServerClientConfig,
  EtsyApiRouteConfig,
} from '@profplum700/etsy-nextjs';
```

## Best Practices

1. **Use Server Components for Data Fetching**: Fetch data on the server to reduce client bundle size and improve performance.

2. **Implement Rate Limiting**: Use the built-in rate limiting in API routes to prevent abuse.

3. **Cache Responses**: Enable caching for frequently accessed data to reduce API calls.

4. **Secure Your Keys**: Never expose your API key in client-side code. Use server-side rendering or API routes.

5. **Handle Errors Gracefully**: Always wrap API calls in try-catch blocks and provide user feedback.

## License

MIT

## Related Packages

- [@profplum700/etsy-v3-api-client](../etsy-v3-api-client) - Core API client
- [@profplum700/etsy-react](../etsy-react) - React hooks
- [@profplum700/etsy-cli](../etsy-cli) - CLI tool
- [@profplum700/etsy-admin-ui](../etsy-admin-ui) - Admin dashboard components
