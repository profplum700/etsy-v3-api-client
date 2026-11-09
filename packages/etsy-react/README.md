# @profplum700/etsy-react

React hooks for the Etsy v3 API client. Simplify your Etsy integrations with powerful, type-safe React hooks.

This package is based on the official Etsy OpenAPI specification (`https://www.etsy.com/openapi/generated/oas/3.0.0.json`), as referenced in Etsy's API documentation (`https://developers.etsy.com/documentation/reference`).

## Installation

```bash
npm install @profplum700/etsy-react @profplum700/etsy-v3-api-client
```

## Quick Start

> **Trusted environments only.** These hooks call `EtsyClient` methods in the browser. `EtsyClient` requires your Etsy app's shared secret and sends it with every API request, so anyone who can load your app can read the secret from its JavaScript. Use the hooks only where everyone who can load the app may hold the secret, such as an internal tool for your own team. In a public web app, call Etsy from your server instead (see [Browser Usage](https://github.com/profplum700/etsy-v3-api-client#browser-usage)). A server-proxy mode for these hooks is tracked in [#107](https://github.com/profplum700/etsy-v3-api-client/issues/107).

Create the client once. The tokens come from your OAuth flow (see the [authentication guide](https://github.com/profplum700/etsy-v3-api-client/blob/master/docs/guides/authentication.md)):

```tsx
// etsy-client.ts
import { EtsyClient } from '@profplum700/etsy-v3-api-client';
import { tokens, saveTokens, clearTokens } from './token-store'; // your own token storage

export const client = new EtsyClient({
  // Bundlers only expose prefixed variables to browser code. This uses Vite
  // (import.meta.env.VITE_*); with Create React App use process.env.REACT_APP_*.
  // Either way the values end up in the bundle: see the warning above.
  keystring: import.meta.env.VITE_ETSY_API_KEY,
  sharedSecret: import.meta.env.VITE_ETSY_SHARED_SECRET,
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_at,
  // Etsy invalidates the old refresh token on each refresh, so save every
  // new set: (accessToken, refreshToken, expiresAt) => Promise<void>
  refreshSaveAsync: saveTokens,
  // Delete the saved tokens when client.clearTokens() is called. Required with
  // refreshSaveAsync, or clearTokens() throws TOKEN_CLEAR_CALLBACK_REQUIRED.
  refreshClearAsync: clearTokens,
});
```

Then wrap your app in `EtsyProvider`:

```tsx
import React from 'react';
import { EtsyProvider, useShop, useListings, useUpdateListing } from '@profplum700/etsy-react';
import { client } from './etsy-client';

function App() {
  return (
    <EtsyProvider client={client}>
      <ShopDashboard />
    </EtsyProvider>
  );
}

function ShopDashboard() {
  const { data: shop, loading, error } = useShop('123');
  const { data: listings, hasMore, loadMore } = useListings('123', {
    state: 'active',
    limit: 25,
  });
  const { mutate: updateListing } = useUpdateListing();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <h1>{shop.title}</h1>
      <ListingGrid
        listings={listings}
        onUpdate={(id, updates) =>
          updateListing({ shopId: '123', listingId: id, updates })
        }
      />
      {hasMore && <button onClick={loadMore}>Load More</button>}
    </div>
  );
}
```

## Hooks

### Context Hooks

#### `useEtsyClient()`
Get the Etsy client instance from context.

```tsx
const client = useEtsyClient();
```

### Query Hooks

#### `useShop(shopId, options?)`
Fetch shop details.

```tsx
const { data, loading, error, refetch } = useShop('123');
```

#### `useListings(shopId, listingsOptions?, queryOptions?)`
Fetch shop listings with pagination support.

```tsx
const {
  data: listings,
  loading,
  error,
  hasMore,
  loadMore,
  currentPage,
  totalPages,
} = useListings('123', {
  state: 'active',
  limit: 25,
  sort_on: 'created',
  sort_order: 'desc',
});
```

#### `useListing(listingId, options?)`
Fetch a single listing.

```tsx
const { data, loading, error } = useListing('456');
```

#### `useReceipts(shopId, receiptsOptions?, queryOptions?)`
Fetch shop receipts with pagination.

```tsx
const {
  data: receipts,
  loading,
  hasMore,
  loadMore,
} = useReceipts('123', {
  was_paid: true,
  limit: 25,
});
```

#### `useReceipt(shopId, receiptId, options?)`
Fetch a single receipt.

```tsx
const { data, loading } = useReceipt('123', '789');
```

### Mutation Hooks

#### `useUpdateListing(options?)`
Update a listing.

```tsx
const { mutate, loading, error } = useUpdateListing({
  onSuccess: (data) => console.log('Updated:', data),
  onError: (error) => console.error('Error:', error),
});

// Use it
mutate({
  shopId: '123',
  listingId: '456',
  updates: { title: 'New Title', price: 29.99 },
});
```

#### `useCreateDraftListing(options?)`
Create a new draft listing.

```tsx
const { mutate } = useCreateDraftListing();

mutate({
  shopId: '123',
  params: {
    quantity: 1,
    title: 'My Product',
    description: 'Product description',
    price: 19.99,
    who_made: 'i_did',
    when_made: '2020_2026',
    taxonomy_id: 123,
  },
});
```

#### `useDeleteListing(options?)`
Delete a listing.

```tsx
const { mutate } = useDeleteListing();

mutate({ listingId: '456' });
```

#### `useUpdateInventory(options?)`
Update listing inventory.

```tsx
const { mutate } = useUpdateInventory();

mutate({
  listingId: '456',
  updates: {
    products: [
      {
        sku: 'SKU-001',
        property_values: [], // No variations
        offerings: [{
          price: 29.99,
          quantity: 10,
          is_enabled: true,
          readiness_state_id: null,
        }],
      },
    ],
  },
});
```

#### `useUploadListingImage(options?)`
Upload an image to a listing.

```tsx
const { mutate, loading } = useUploadListingImage();

mutate({
  shopId: '123',
  listingId: '456',
  image: imageFile, // File or Buffer
  rank: 1,
});
```

## Advanced Usage

### Auto-refetch on Interval

```tsx
const { data } = useReceipts('123', { was_paid: false }, {
  refetchInterval: 60000, // Refetch every minute
});
```

### Refetch on Window Focus

```tsx
const { data } = useShop('123', {
  refetchOnWindowFocus: true,
});
```

### Conditional Queries

```tsx
const { data } = useShop(shopId, {
  enabled: !!shopId, // Only fetch when shopId is available
});
```

### Optimistic Updates

```tsx
const { mutate } = useUpdateListing({
  onSuccess: (updatedListing) => {
    // Update local state optimistically
    setListings((prev) =>
      prev.map((listing) =>
        listing.listing_id === updatedListing.listing_id
          ? updatedListing
          : listing
      )
    );
  },
});
```

## TypeScript Support

All hooks are fully typed with TypeScript. The package includes comprehensive type definitions.

```tsx
import type {
  UseQueryOptions,
  UseQueryResult,
  UseMutationOptions,
  UseMutationResult,
  UsePaginatedQueryResult,
} from '@profplum700/etsy-react';
```

## API

### Query Options

```typescript
interface UseQueryOptions<T> {
  enabled?: boolean;
  refetchInterval?: number;
  refetchOnWindowFocus?: boolean;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
}
```

### Mutation Options

```typescript
interface UseMutationOptions<TData, TVariables> {
  onSuccess?: (data: TData, variables: TVariables) => void;
  onError?: (error: Error, variables: TVariables) => void;
  onSettled?: (data: TData | undefined, error: Error | null, variables: TVariables) => void;
}
```

## License

MIT

## Related Packages

- [@profplum700/etsy-v3-api-client](../etsy-v3-api-client) - Core API client
- [@profplum700/etsy-nextjs](../etsy-nextjs) - Next.js integration
- [@profplum700/etsy-cli](../etsy-cli) - CLI tool
- [@profplum700/etsy-admin-ui](../etsy-admin-ui) - Admin dashboard components
