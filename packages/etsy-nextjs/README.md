# @profplum700/etsy-nextjs

Next.js integration for the Etsy v3 API client. Seamlessly integrate Etsy into your Next.js applications with Server Components, API Routes, and more.

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
   - Safe to use in Next.js Server Components, API Routes, and Server Actions
   - Prevents "createContext is not a function" build errors
   - Exports: `configureEtsyServerClient`, `getEtsyServerClient`, `createEtsyServerClient`, `createEtsyApiRoute`
   - **Note:** Identical to `/server` entry point

2. **`@profplum700/etsy-nextjs/server`** (Server-Only - Explicit)
   - Same as main entry point, provided for explicit clarity
   - Use when you want to be explicit about importing server-only code
   - Exports: `configureEtsyServerClient`, `getEtsyServerClient`, `createEtsyServerClient`, `createEtsyApiRoute`

3. **`@profplum700/etsy-nextjs/client`** (Client-Only - Required for React Components)
   - **Client-side React code**
   - **Must be used in client components (files with `'use client'`)**
   - Exports: `EtsyNextClientProvider`, `useEtsyNextClient`

### 🎯 Why Separate Entry Points?

The main entry point now contains **only server-side code** to prevent build errors. Previously, React Context code (createContext, useContext) was bundled with server-side exports, causing "createContext is not a function" errors when importing in Next.js API routes or Server Components.

**Benefits:**
- ✅ **Build stability**: No "createContext is not a function" errors in API routes
- ✅ **Zero React overhead**: Server bundles have no React dependencies
- ✅ **Tree-shakeable**: Only bundle what you need
- ✅ **Smaller bundles**: Optimized for both client and server environments
- ✅ **Type-safe**: Full TypeScript support for all entry points

### 💡 Migration Guide

#### For Server-Side Code (API Routes, Server Components)
**No changes needed** - the main entry point is now server-only:
```typescript
// Both of these work identically (server-only exports)
import { getEtsyServerClient } from '@profplum700/etsy-nextjs';
import { getEtsyServerClient } from '@profplum700/etsy-nextjs/server';
```

#### For Client-Side Code (React Components)
**⚠️ BREAKING CHANGE** - You MUST now import from `/client`:

**Before (v2.3.1 and earlier):**
```typescript
import { EtsyNextClientProvider, useEtsyNextClient } from '@profplum700/etsy-nextjs';
```

**After (v2.4.0+):**
```typescript
'use client';

import { EtsyNextClientProvider, useEtsyNextClient } from '@profplum700/etsy-nextjs/client';
```

**Why this change?**
This ensures React code is never accidentally bundled in server contexts, preventing build errors like "createContext is not a function" when the package is used in Next.js API routes.

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
// Server types - main entry only exports server types
import type {
  EtsyServerClientConfig,
  EtsyApiRouteConfig,
} from '@profplum700/etsy-nextjs';

// Or explicitly from /server
import type {
  EtsyServerClientConfig,
  EtsyApiRouteConfig,
} from '@profplum700/etsy-nextjs/server';

// Client types - must import from /client
import type {
  EtsyNextClientProvider,
  useEtsyNextClient,
} from '@profplum700/etsy-nextjs/client';
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
