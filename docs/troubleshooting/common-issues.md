# Troubleshooting Common Issues

This guide covers common issues you might encounter when using the Etsy v3 API client and how to resolve them.

## Table of Contents

- [Authentication Issues](#authentication-issues)
- [API Errors](#api-errors)
- [Rate Limiting](#rate-limiting)
- [Token Management](#token-management)
- [Network Issues](#network-issues)
- [Data Validation](#data-validation)

## Authentication Issues

### "Invalid redirect URI"

**Problem**: OAuth flow fails with redirect URI mismatch.

**Solution**:
```typescript
// Ensure redirect URI matches EXACTLY what's configured in Etsy app
// Including:
// - HTTP vs HTTPS
// - Trailing slashes
// - Port numbers
// - Domain name

// ❌ Wrong
redirectUri: 'http://localhost:3000/callback/' // Extra trailing slash

// ✅ Correct
redirectUri: 'http://localhost:3000/callback'
```

**Check**:
1. Go to Etsy Developer Portal
2. Check your app's redirect URI configuration
3. Ensure it matches your code exactly

### "Invalid authorization code"

**Problem**: Code exchange fails.

**Causes**:
- Code already used
- Code expired (expires in 60 seconds)
- Code from different app

**Solution**:
```typescript
app.get('/callback', async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    return res.status(400).send('No code provided');
  }

  try {
    // Exchange code immediately
    await client.exchangeAuthorizationCode(code);
    res.send('Success!');
  } catch (error) {
    console.error('Exchange failed:', error);

    // If code expired, redirect to re-authenticate
    if (error.message.includes('invalid_grant')) {
      const authUrl = await client.getAuthorizationUrl();
      return res.redirect(authUrl);
    }

    res.status(500).send('Authentication failed');
  }
});
```

### "401 Unauthorized" on API calls

**Problem**: API requests fail with 401 error.

**Causes**:
- No tokens stored
- Tokens expired
- Invalid tokens
- Missing scopes

**Solution**:
```typescript
async function makeAuthenticatedRequest() {
  // Check if authenticated
  if (!(await client.isAuthenticated())) {
    console.log('Not authenticated, redirecting to auth flow');
    // Redirect to authentication
    return;
  }

  try {
    return await client.getShopByOwnerUserId();
  } catch (error) {
    if (error.statusCode === 401) {
      // Try refreshing token
      try {
        await client.refreshAccessToken();
        return await client.getShopByOwnerUserId(); // Retry
      } catch (refreshError) {
        // Refresh failed, need to re-authenticate
        console.log('Token refresh failed, please re-authenticate');
        await client.clearTokens();
        // Redirect to auth flow
      }
    }
    throw error;
  }
}
```

### "Insufficient scope"

**Problem**: API call fails because required scope is missing.

**Solution**:
```typescript
// Ensure you request all needed scopes
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: 'http://localhost:3000/callback',
  scopes: [
    'listings_r',      // For reading listings
    'listings_w',      // For creating/updating listings
    'shops_r',         // For reading shop data
    'transactions_r',  // For reading orders
    // Add all scopes you need
  ]
});

// If you need additional scopes later, user must re-authenticate
```

## API Errors

### "404 Not Found"

**Problem**: Resource doesn't exist.

**Causes**:
- Wrong ID
- Resource deleted
- Wrong shop ID

**Solution**:
```typescript
async function safeFetch(id: string) {
  try {
    return await client.getListing(id);
  } catch (error) {
    if (error.statusCode === 404) {
      console.log(`Listing ${id} not found`);
      return null;
    }
    throw error;
  }
}
```

### "400 Bad Request"

**Problem**: Invalid request parameters.

**Solution**:
```typescript
// Validate data before sending
function validateListingData(data: any): string[] {
  const errors = [];

  if (!data.title || data.title.length > 140) {
    errors.push('Title must be 1-140 characters');
  }

  if (!data.price || data.price <= 0) {
    errors.push('Price must be positive');
  }

  if (!data.quantity || data.quantity < 1) {
    errors.push('Quantity must be at least 1');
  }

  if (!data.who_made || !['i_did', 'someone_else', 'collective'].includes(data.who_made)) {
    errors.push('Invalid who_made value');
  }

  return errors;
}

// Use before creating listing
const errors = validateListingData(data);
if (errors.length > 0) {
  console.error('Validation errors:', errors);
  return;
}

await client.createDraftListing(shopId, data);
```

### "403 Forbidden"

**Problem**: No permission to access resource.

**Causes**:
- Trying to access another user's data
- Missing required scope
- Resource ownership issue

**Solution**:
```typescript
// Always use the authenticated user's shop
const shop = await client.getShopByOwnerUserId();
const shopId = shop.shop_id.toString();

// Use shopId for all operations
await client.getListingsByShop(shopId, { limit: 10 });
```

## Rate Limiting

### "429 Too Many Requests"

**Problem**: Exceeded rate limit.

**Etsy Rate Limits**:
- 10 requests per second
- 10,000 requests per day per app

**Solution**:
```typescript
// Use built-in rate limiting
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.REDIRECT_URI!,
  scopes: ['listings_r'],
  rateLimit: {
    maxRequests: 10,  // Max 10 requests
    windowMs: 1000    // Per second
  }
});

// For bulk operations, add delays
async function bulkUpdate(listings: any[]) {
  for (const listing of listings) {
    await client.updateListing(shopId, listing.id, listing.updates);

    // Wait 100ms between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
}

// Handle 429 errors with retry
async function makeRequestWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (error.statusCode === 429 && i < maxRetries - 1) {
        // Wait before retrying (exponential backoff)
        const delay = Math.pow(2, i) * 1000;
        console.log(`Rate limited, waiting ${delay}ms before retry ${i + 1}`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}

// Usage
const listing = await makeRequestWithRetry(() =>
  client.getListing('123')
);
```

## Token Management

### "Token storage failed"

**Problem**: Cannot save/load tokens.

**Causes**:
- File permissions
- Disk space
- Invalid path

**Solution**:
```typescript
import { FileTokenStorage } from '@profplum700/etsy-v3-api-client';
import fs from 'fs';
import path from 'path';

// Ensure directory exists
const tokenDir = './data';
if (!fs.existsSync(tokenDir)) {
  fs.mkdirSync(tokenDir, { recursive: true });
}

const tokenPath = path.join(tokenDir, 'tokens.json');

try {
  const storage = new FileTokenStorage(tokenPath);
  const client = new EtsyClient(config, storage);
} catch (error) {
  console.error('Storage initialization failed:', error);
  // Fall back to memory storage
  const storage = new MemoryTokenStorage();
  const client = new EtsyClient(config, storage);
}
```

### "Refresh token expired"

**Problem**: Refresh token expired (90 days).

**Solution**:
```typescript
async function ensureAuthenticated() {
  try {
    // Try to use existing tokens
    const isAuth = await client.isAuthenticated();

    if (!isAuth) {
      console.log('Not authenticated');
      // Redirect to auth flow
      return false;
    }

    return true;
  } catch (error) {
    if (error.message.includes('refresh_token') || error.message.includes('expired')) {
      console.log('Refresh token expired, need to re-authenticate');
      await client.clearTokens();
      // Redirect to auth flow
      return false;
    }
    throw error;
  }
}

// Check periodically
setInterval(async () => {
  const isAuth = await ensureAuthenticated();
  if (!isAuth) {
    console.log('Re-authentication required');
  }
}, 24 * 60 * 60 * 1000); // Daily
```

## Network Issues

### "ECONNREFUSED" / "ETIMEDOUT"

**Problem**: Cannot connect to Etsy API.

**Causes**:
- Network connectivity
- Firewall
- Proxy configuration
- DNS issues

**Solution**:
```typescript
import axios from 'axios';

// Test connectivity
async function testConnection() {
  try {
    await axios.get('https://openapi.etsy.com/v3/application/openapi-ping');
    console.log('Etsy API is reachable');
    return true;
  } catch (error) {
    console.error('Cannot reach Etsy API:', error.message);
    return false;
  }
}

// Use with timeout
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.REDIRECT_URI!,
  scopes: ['listings_r'],
  timeout: 30000 // 30 second timeout
});

// Implement retry logic
async function makeRequestWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3
): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;

      if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
        console.log(`Retry ${i + 1}/${retries} after network error`);
        await new Promise(r => setTimeout(r, 2000 * (i + 1)));
      } else {
        throw error;
      }
    }
  }
  throw new Error('Max retries exceeded');
}
```

### "Request timed out"

**Problem**: Request takes too long.

**Solution**:
```typescript
// Increase timeout
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.REDIRECT_URI!,
  scopes: ['listings_r'],
  timeout: 60000 // 60 seconds
});

// For specific operations that may be slow
async function slowOperation() {
  try {
    return await client.getListingsByShop(shopId, { limit: 100 });
  } catch (error) {
    if (error.code === 'ETIMEDOUT') {
      console.log('Request timed out, trying with smaller limit');
      // Retry with smaller page size
      return await client.getListingsByShop(shopId, { limit: 25 });
    }
    throw error;
  }
}
```

## Data Validation

### "Invalid image format"

**Problem**: Image upload fails.

**Solution**:
```typescript
import sharp from 'sharp';

async function validateAndResizeImage(
  imagePath: string
): Promise<Buffer> {
  const image = sharp(imagePath);
  const metadata = await image.metadata();

  // Check format
  if (!['jpeg', 'jpg', 'png', 'gif'].includes(metadata.format!)) {
    throw new Error('Invalid image format. Use JPEG, PNG, or GIF');
  }

  // Check size (max 10MB for Etsy)
  const stats = fs.statSync(imagePath);
  if (stats.size > 10 * 1024 * 1024) {
    throw new Error('Image too large (max 10MB)');
  }

  // Resize if needed (Etsy recommends 2000x2000 minimum)
  if (metadata.width! < 2000 || metadata.height! < 2000) {
    console.log('Resizing image to meet minimum dimensions');
    return await image
      .resize(2000, 2000, { fit: 'inside' })
      .jpeg({ quality: 90 })
      .toBuffer();
  }

  return fs.readFileSync(imagePath);
}

// Usage
const imageBuffer = await validateAndResizeImage('./product.jpg');
await client.uploadListingImage(shopId, listingId, imageBuffer);
```

### "Invalid taxonomy_id"

**Problem**: Creating listing fails with invalid category.

**Solution**:
```typescript
// Get valid taxonomy IDs
const taxonomy = await client.getSellerTaxonomy();

function findValidTaxonomyIds(
  taxonomy: any[],
  searchTerm: string
): number[] {
  const results: number[] = [];

  function search(nodes: any[]) {
    for (const node of nodes) {
      if (node.name.toLowerCase().includes(searchTerm.toLowerCase())) {
        // Only use leaf nodes (no children)
        if (!node.children || node.children.length === 0) {
          results.push(node.id);
        }
      }

      if (node.children) {
        search(node.children);
      }
    }
  }

  search(taxonomy);
  return results;
}

// Find category
const ceramicIds = findValidTaxonomyIds(taxonomy, 'ceramic');
console.log('Valid ceramic category IDs:', ceramicIds);

// Use in listing
await client.createDraftListing(shopId, {
  taxonomy_id: ceramicIds[0], // Use first match
  // ... other fields
});
```

## Getting Help

If you're still experiencing issues:

1. **Check the error message**: Most errors include helpful details
2. **Enable debug logging**: Set `DEBUG=etsy:*` environment variable
3. **Check Etsy API status**: [https://status.etsy.com/](https://status.etsy.com/)
4. **Review API documentation**: [https://developers.etsy.com/documentation](https://developers.etsy.com/documentation)
5. **GitHub Issues**: [Report bugs or ask questions](https://github.com/profplum700/etsy-v3-api-client/issues)

## Debug Mode

Enable debug logging:

```typescript
// Set environment variable
process.env.DEBUG = 'etsy:*';

// Or use a logger
const client = new EtsyClient({
  apiKey: process.env.ETSY_API_KEY!,
  redirectUri: process.env.REDIRECT_URI!,
  scopes: ['listings_r'],
  // Logger configuration (if supported)
  logger: {
    debug: console.debug,
    info: console.info,
    warn: console.warn,
    error: console.error
  }
});
```

## Common Patterns

### Comprehensive Error Handling

```typescript
import { EtsyApiError } from '@profplum700/etsy-v3-api-client';

async function robustApiCall<T>(
  fn: () => Promise<T>
): Promise<T | null> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof EtsyApiError) {
      switch (error.statusCode) {
        case 400:
          console.error('Bad request:', error.message);
          break;
        case 401:
          console.error('Unauthorized - check authentication');
          break;
        case 403:
          console.error('Forbidden - check permissions');
          break;
        case 404:
          console.error('Not found');
          return null; // Return null for not found
        case 429:
          console.error('Rate limited');
          // Could retry with backoff
          break;
        case 500:
        case 502:
        case 503:
          console.error('Server error - retry later');
          break;
        default:
          console.error(`API error ${error.statusCode}:`, error.message);
      }
    } else {
      console.error('Unexpected error:', error);
    }

    return null;
  }
}

// Usage
const listing = await robustApiCall(() =>
  client.getListing('123')
);

if (listing) {
  console.log('Found listing:', listing.title);
} else {
  console.log('Could not fetch listing');
}
```
