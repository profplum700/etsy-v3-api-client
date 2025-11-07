# Migration Guide

**Last Updated:** 2025-11-07

This guide helps you migrate between major versions of `@profplum700/etsy-v3-api-client`.

## Table of Contents

- [Migrating from v1.x to v2.x](#migrating-from-v1x-to-v2x)
- [Migrating from v2.x to v2.3+](#migrating-from-v2x-to-v23)
- [Quick Migration Checklist](#quick-migration-checklist)
- [Breaking Changes by Version](#breaking-changes-by-version)
- [New Features by Version](#new-features-by-version)

---

## Migrating from v1.x to v2.x

### Summary

**Good news!** v2 is fully backward compatible with v1. No breaking changes!

However, v2 introduces many new features and improvements that you should adopt for better performance, security, and developer experience.

### Step 1: Update Package Version

```bash
# Using npm
npm install @profplum700/etsy-v3-api-client@latest

# Using yarn
yarn upgrade @profplum700/etsy-v3-api-client

# Using pnpm
pnpm update @profplum700/etsy-v3-api-client
```

### Step 2: Your Existing Code Continues to Work

```typescript
// ✅ v1 code still works in v2!
import { EtsyClient, AuthHelper } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  keystring: 'your-api-key',
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
  expiresAt: new Date(),
});

// All v1 methods still work
const user = await client.getUser();
const listings = await client.findAllActiveListingsByShop({ shop_id: 'shop-id' });
```

### Step 3: Adopt New Features (Recommended)

While not required, you should adopt these new features for better functionality:

#### 1. Use New Typed Methods

```typescript
// Before (v1): Generic get method
const result = await client.get('/application/shops/12345/listings');

// After (v2): Type-safe method with autocomplete
const result = await client.getListingsByShop('12345');
// ✅ Better: TypeScript knows the return type
// ✅ Better: Autocomplete for parameters
// ✅ Better: Built-in validation
```

#### 2. Enhanced Error Handling

```typescript
// Before (v1): Basic error catching
try {
  await client.createDraftListing(params);
} catch (error) {
  console.error('Error:', error.message);
}

// After (v2): Detailed error information with suggestions
try {
  await client.createDraftListing(params);
} catch (error) {
  if (error instanceof EtsyApiError) {
    console.error(error.toString());
    // Output includes:
    // - Status code
    // - Error code
    // - Endpoint
    // - Actionable suggestions
    // - Documentation link
    // - Timestamp

    // Check if retryable
    if (error.isRetryable()) {
      const retryAfter = error.getRetryAfter();
      console.log(`Can retry after ${retryAfter} seconds`);
    }

    // Get JSON for logging
    console.log(JSON.stringify(error.toJSON(), null, 2));
  }
}
```

#### 3. Leverage New Packages (Optional)

v2 introduced companion packages for specific use cases:

```bash
# For Next.js applications
npm install @profplum700/etsy-nextjs

# For React applications (hooks)
npm install @profplum700/etsy-react

# For CLI usage
npm install -g @profplum700/etsy-cli

# For pre-built admin UI components
npm install @profplum700/etsy-admin-ui
```

**Next.js Integration:**

```typescript
// Before (v1): Manual setup
// ... lots of boilerplate code ...

// After (v2): Use etsy-nextjs package
import { createEtsyApiRoute } from '@profplum700/etsy-nextjs';

// app/api/etsy/[...etsy]/route.ts
export const { GET, POST } = createEtsyApiRoute({
  keystring: process.env.ETSY_API_KEY!,
  redirectUri: process.env.ETSY_REDIRECT_URI!,
  scopes: ['shops_r', 'listings_r', 'listings_w'],
  // Automatic OAuth, token management, error handling!
});
```

**React Hooks:**

```typescript
// Before (v1): Manual state management
const [listings, setListings] = useState([]);
const [loading, setLoading] = useState(false);

useEffect(() => {
  setLoading(true);
  client.getListingsByShop(shopId)
    .then(setListings)
    .finally(() => setLoading(false));
}, [shopId]);

// After (v2): Use etsy-react hooks
import { useListings } from '@profplum700/etsy-react';

const { data: listings, isLoading, error } = useListings(shopId);
// ✅ Automatic loading states
// ✅ Automatic error handling
// ✅ Automatic caching
```

#### 4. Encrypted Token Storage

```typescript
// Before (v1): No built-in token encryption

// After (v2): Use encrypted storage for Node.js
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client/security';

const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: process.env.ENCRYPTION_KEY!, // 32-byte key
});

const client = new EtsyClient(
  {
    keystring: process.env.ETSY_API_KEY!,
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt: tokens.expires_at,
  },
  storage // Pass storage to constructor
);
```

#### 5. Advanced Caching

```typescript
// Before (v1): Basic caching
const client = new EtsyClient({
  keystring: 'api-key',
  accessToken: 'token',
  refreshToken: 'refresh',
  expiresAt: new Date(),
  caching: { enabled: true }
});

// After (v2): Advanced caching with tags and selective invalidation
import { AdvancedCacheManager } from '@profplum700/etsy-v3-api-client';

const cacheManager = new AdvancedCacheManager({
  defaultTTL: 300, // 5 minutes
  maxSize: 100,
});

// Cache with tags
await cacheManager.set('listings:123', data, 300, ['listings', 'shop:123']);

// Invalidate by tag
await cacheManager.invalidateByTags(['shop:123']);
// All cached items with tag 'shop:123' are now invalidated
```

#### 6. Bulk Operations

```typescript
// Before (v1): Manual loops
const updates = [...]; // 100 listings to update
for (const update of updates) {
  await client.updateListing(update); // Slow, sequential
}

// After (v2): Use bulk operations
const bulkManager = client.bulkOperations;

const summary = await bulkManager.bulkUpdateListings(updates, {
  concurrency: 5, // 5 parallel requests
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  },
  onError: (error, item) => {
    console.error(`Failed to update ${item.listing_id}:`, error);
  },
});

console.log(`Success: ${summary.successful}, Failed: ${summary.failed}`);
```

#### 7. Request Validation

```typescript
// Before (v1): No built-in validation

// After (v2): Automatic validation with helpful errors
const client = new EtsyClient(config);

try {
  await client.createDraftListing({
    title: '', // Invalid: empty title
    price: -10, // Invalid: negative price
    quantity: 'invalid', // Invalid: not a number
  });
} catch (error) {
  if (error instanceof ValidationException) {
    console.error('Validation errors:', error.errors);
    // [
    //   { field: 'title', message: 'Title is required' },
    //   { field: 'price', message: 'Price must be positive' },
    //   { field: 'quantity', message: 'Quantity must be a number' }
    // ]
  }
}
```

### Step 4: Update Environment Variables (If Using New Packages)

```bash
# .env.local

# Core credentials (same as v1)
ETSY_API_KEY=your_api_key

# New in v2: For automatic OAuth flow
ETSY_REDIRECT_URI=https://your-app.com/api/etsy/callback
ETSY_SCOPES=shops_r,shops_w,listings_r,listings_w

# New in v2: For encrypted token storage
ENCRYPTION_KEY=your_32_byte_encryption_key_here
```

---

## Migrating from v2.x to v2.3+

### Summary

v2.3+ introduces enhanced error handling, better documentation, and quality-of-life improvements. No breaking changes!

### New in v2.3+

#### 1. Enhanced Error Messages

```typescript
// Now errors include:
// - Actionable suggestions based on error type
// - Documentation links
// - Validation error details
// - Endpoint context

try {
  await client.updateListing(listingId, params);
} catch (error) {
  if (error instanceof EtsyApiError) {
    // New properties in v2.3+
    console.log(error.suggestions); // Array of helpful suggestions
    console.log(error.docsUrl); // Link to error documentation
    console.log(error.endpoint); // Which endpoint failed
    console.log(error.timestamp); // When error occurred

    // Pretty-printed error with all context
    console.error(error.toString());
  }
}
```

#### 2. SecureTokenStorage for Browsers

```typescript
// New in v2.3: Encrypted token storage for browsers
import { SecureTokenStorage } from '@profplum700/etsy-v3-api-client/browser';

const storage = new SecureTokenStorage();

// Tokens are encrypted using Web Crypto API
await storage.save({
  access_token: 'token',
  refresh_token: 'refresh',
  expires_at: new Date(),
  token_type: 'Bearer',
  scope: 'shops_r listings_r',
});

// Automatically decrypts and validates
const tokens = await storage.load();
```

#### 3. Global Request Queue

```typescript
// New in v2.3: Share rate limit across multiple clients
import { GlobalRequestQueue } from '@profplum700/etsy-v3-api-client';

const queue = GlobalRequestQueue.getInstance();

// All client instances now share the same rate limit tracker
const client1 = new EtsyClient(config1);
const client2 = new EtsyClient(config2);

// They coordinate to avoid hitting rate limits
await Promise.all([
  client1.getShop('shop1'),
  client2.getShop('shop2'),
]);
```

#### 4. Improved TypeScript Types

```typescript
// New in v2.3: Branded types for IDs
type ShopId = string & { __brand: 'ShopId' };
type ListingId = string & { __brand: 'ListingId' };

// Prevents mixing up IDs
function getShop(shopId: ShopId) { /* ... */ }
function getListing(listingId: ListingId) { /* ... */ }

// TypeScript catches mistakes:
const shopId = '123' as ShopId;
const listingId = '456' as ListingId;

getListing(shopId); // ❌ TypeScript error!
getListing(listingId); // ✅ Correct
```

#### 5. Better Documentation

- New: [Localhost Development Guide](./docs/guides/LOCALHOST_DEVELOPMENT.md)
- New: [Error Codes Reference](./docs/troubleshooting/ERROR_CODES.md)
- Updated: All existing guides with v2.3 examples

---

## Quick Migration Checklist

### From v1 to v2

- [ ] Update package: `npm install @profplum700/etsy-v3-api-client@latest`
- [ ] Test existing functionality (should work as-is)
- [ ] Review new error handling features
- [ ] Consider using typed methods instead of generic `get()`/`post()`
- [ ] Evaluate companion packages for your use case:
  - [ ] `@profplum700/etsy-nextjs` for Next.js
  - [ ] `@profplum700/etsy-react` for React
  - [ ] `@profplum700/etsy-cli` for CLI tools
  - [ ] `@profplum700/etsy-admin-ui` for admin interfaces
- [ ] Enable encrypted token storage for sensitive environments
- [ ] Implement bulk operations for batch updates
- [ ] Add request validation for better error messages

### From v2.x to v2.3+

- [ ] Update package: `npm install @profplum700/etsy-v3-api-client@latest`
- [ ] Update error handling to use new `suggestions` and `docsUrl` properties
- [ ] Consider using `SecureTokenStorage` for browsers
- [ ] Enable global request queue if using multiple clients
- [ ] Review new TypeScript types for better type safety
- [ ] Read new documentation:
  - [ ] [Localhost Development](./docs/guides/LOCALHOST_DEVELOPMENT.md)
  - [ ] [Error Codes](./docs/troubleshooting/ERROR_CODES.md)

---

## Breaking Changes by Version

### v2.0.0

**None!** v2 is fully backward compatible with v1.

### v2.3.0

**None!** v2.3 is fully backward compatible with v2.x.

---

## New Features by Version

### v2.3.0 (Latest)

- ✨ Enhanced error messages with actionable suggestions
- ✨ SecureTokenStorage for browsers (Web Crypto API)
- ✨ Global request queue for cross-client rate limiting
- ✨ Improved TypeScript types (branded types, better inference)
- ✨ Localhost development guide
- ✨ Error codes documentation
- ✨ Plugin system for extending client functionality

### v2.2.0

- ✨ Advanced caching with tag-based invalidation
- ✨ Query builder for complex API queries
- ✨ Pagination helper utilities
- ✨ Webhook signature verification
- ✨ Request retry with exponential backoff

### v2.1.0

- ✨ Bulk operations manager
- ✨ Request validation schemas
- ✨ Token rotation and proactive refresh
- ✨ Comprehensive test coverage improvements

### v2.0.0

- ✨ 70+ API endpoints (up from 20 in v1)
- ✨ `@profplum700/etsy-nextjs` package for Next.js
- ✨ `@profplum700/etsy-react` package for React hooks
- ✨ `@profplum700/etsy-cli` command-line tool
- ✨ `@profplum700/etsy-admin-ui` pre-built components
- ✨ Encrypted file token storage (Node.js)
- ✨ Enhanced security features
- ✨ Improved documentation and examples
- ✨ Better TypeScript support
- ✨ Zero runtime dependencies

---

## Common Migration Scenarios

### Scenario 1: Express.js API

**v1 Approach:**

```typescript
// server.js (v1)
import express from 'express';
import { EtsyClient, AuthHelper } from '@profplum700/etsy-v3-api-client';

const app = express();

app.get('/auth', async (req, res) => {
  const authHelper = new AuthHelper(config);
  const authUrl = await authHelper.getAuthUrl();
  res.redirect(authUrl);
});

app.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  const authHelper = new AuthHelper(config);
  await authHelper.setAuthorizationCode(code, state);
  const tokens = await authHelper.getAccessToken();
  // ... save tokens ...
  res.redirect('/dashboard');
});

app.get('/api/listings', async (req, res) => {
  const client = new EtsyClient(config);
  const listings = await client.getListingsByShop(shopId);
  res.json(listings);
});
```

**v2 Approach (Still Works!):**

The v1 approach still works in v2. But you can improve it:

```typescript
// server.js (v2)
import express from 'express';
import { EtsyClient, AuthHelper } from '@profplum700/etsy-v3-api-client';
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client/security';

const app = express();

// Use encrypted token storage
const tokenStorage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: process.env.ENCRYPTION_KEY!,
});

// ... same auth routes as v1 ...

app.get('/api/listings', async (req, res) => {
  try {
    const tokens = await tokenStorage.load();
    if (!tokens) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const client = new EtsyClient(
      {
        keystring: process.env.ETSY_API_KEY!,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expires_at,
      },
      tokenStorage
    );

    const listings = await client.getListingsByShop(shopId);
    res.json(listings);
  } catch (error) {
    if (error instanceof EtsyApiError) {
      // v2: Enhanced error handling
      return res.status(error.statusCode || 500).json({
        error: error.message,
        suggestions: error.suggestions,
        docsUrl: error.docsUrl,
      });
    }
    throw error;
  }
});
```

### Scenario 2: Next.js Application

**v1 Approach:**

```typescript
// app/api/etsy/callback/route.ts (v1)
// ... lots of manual OAuth handling ...
// ... manual token management ...
// ... manual error handling ...
```

**v2 Approach:**

```bash
# Install Next.js package
npm install @profplum700/etsy-nextjs
```

```typescript
// app/api/etsy/[...etsy]/route.ts (v2)
import { createEtsyApiRoute } from '@profplum700/etsy-nextjs';

export const { GET, POST } = createEtsyApiRoute({
  keystring: process.env.ETSY_API_KEY!,
  redirectUri: process.env.ETSY_REDIRECT_URI!,
  scopes: ['shops_r', 'listings_r', 'listings_w'],
});

// That's it! Automatic OAuth, token management, and error handling
```

```typescript
// app/dashboard/page.tsx (v2)
import { useListings } from '@profplum700/etsy-react';

export default function Dashboard() {
  const { data: listings, isLoading, error } = useListings(shopId);

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {listings.map(listing => (
        <div key={listing.listing_id}>{listing.title}</div>
      ))}
    </div>
  );
}
```

### Scenario 3: CLI Tool

**v1 Approach:**

```typescript
// scripts/sync-listings.ts (v1)
import { EtsyClient } from '@profplum700/etsy-v3-api-client';

const client = new EtsyClient({
  keystring: process.env.ETSY_API_KEY!,
  accessToken: process.env.ETSY_ACCESS_TOKEN!,
  refreshToken: process.env.ETSY_REFRESH_TOKEN!,
  expiresAt: new Date(process.env.ETSY_EXPIRES_AT!),
});

async function sync() {
  const listings = await client.getListingsByShop(shopId);
  console.log(`Found ${listings.length} listings`);
  // ... sync logic ...
}

sync();
```

**v2 Approach:**

```bash
# Install CLI package
npm install -g @profplum700/etsy-cli

# Or use in project
npm install @profplum700/etsy-cli
```

```bash
# Initialize CLI
etsy-cli init

# Authenticate
etsy-cli auth

# List listings with table view
etsy-cli listings list

# Bulk update from CSV
etsy-cli listings bulk-update --file updates.csv
```

Or continue using your custom script with v2 improvements:

```typescript
// scripts/sync-listings.ts (v2)
import { EtsyClient } from '@profplum700/etsy-v3-api-client';
import { EncryptedFileTokenStorage } from '@profplum700/etsy-v3-api-client/security';

const storage = new EncryptedFileTokenStorage({
  filePath: './tokens.enc',
  encryptionKey: process.env.ENCRYPTION_KEY!,
});

async function sync() {
  const tokens = await storage.load();
  if (!tokens) {
    console.error('Not authenticated. Run authentication flow first.');
    process.exit(1);
  }

  const client = new EtsyClient(
    {
      keystring: process.env.ETSY_API_KEY!,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokens.expires_at,
    },
    storage
  );

  try {
    const listings = await client.getListingsByShop(shopId);
    console.log(`Found ${listings.length} listings`);
    // ... sync logic ...
  } catch (error) {
    if (error instanceof EtsyApiError) {
      console.error(error.toString()); // v2: Beautiful error output
      process.exit(1);
    }
    throw error;
  }
}

sync();
```

---

## Need Help?

If you encounter issues during migration:

1. **Check the documentation:**
   - [Getting Started Guide](./docs/guides/getting-started.md)
   - [Authentication Guide](./docs/guides/authentication.md)
   - [Troubleshooting](./docs/troubleshooting/common-issues.md)

2. **Search existing issues:**
   - [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)

3. **Create a new issue:**
   - [Report a problem](https://github.com/profplum700/etsy-v3-api-client/issues/new)
   - Include: version you're migrating from/to, error messages, code samples

4. **Join the community:**
   - Check out [example projects](./examples/)
   - Share your use case for better support

---

## Feedback

Found this migration guide helpful? Have suggestions for improvements? Please [open an issue](https://github.com/profplum700/etsy-v3-api-client/issues) or submit a pull request!

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-07
**Covers:** v1.x → v2.x → v2.3+
