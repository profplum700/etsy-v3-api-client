# Error Codes Reference

**Last Updated:** 2025-11-07

Comprehensive reference for all error codes you might encounter when using the Etsy API v3 client.

## Table of Contents

- [HTTP Status Codes](#http-status-codes)
  - [400 Bad Request](#400-bad-request)
  - [401 Unauthorized](#401-unauthorized)
  - [403 Forbidden](#403-forbidden)
  - [404 Not Found](#404-not-found)
  - [409 Conflict](#409-conflict)
  - [429 Too Many Requests](#429-too-many-requests)
  - [500 Internal Server Error](#500-internal-server-error)
  - [502 Bad Gateway](#502-bad-gateway)
  - [503 Service Unavailable](#503-service-unavailable)
  - [504 Gateway Timeout](#504-gateway-timeout)
- [OAuth Error Codes](#oauth-error-codes)
- [Validation Errors](#validation-errors)
- [Rate Limiting](#rate-limiting)
- [Best Practices](#best-practices)

---

## HTTP Status Codes

### 400 Bad Request {#400}

**Meaning:** The request was malformed or contains invalid parameters.

**Common Causes:**

1. **Missing required parameters**
   ```typescript
   // ❌ Missing required 'who_made' field
   await client.createDraftListing({
     title: 'My Product',
     price: 29.99,
     quantity: 10,
     // who_made: 'i_did', // Required!
   });
   ```

2. **Invalid parameter format**
   ```typescript
   // ❌ Price must be a number, not a string
   await client.updateListing(listingId, {
     price: '29.99', // Should be: 29.99
   });
   ```

3. **Invalid enum value**
   ```typescript
   // ❌ Invalid 'when_made' value
   await client.createDraftListing({
     title: 'Product',
     when_made: 'yesterday', // Must be: '2020_2024', 'made_to_order', etc.
     // ...
   });
   ```

**Solutions:**

```typescript
try {
  await client.createDraftListing(params);
} catch (error) {
  if (error instanceof EtsyApiError && error.statusCode === 400) {
    console.error('Bad Request:', error.message);

    // Check validation errors
    if (error.details.validationErrors) {
      error.details.validationErrors.forEach(err => {
        console.error(`  - ${err.field}: ${err.message}`);
      });
    }

    // View suggestions
    console.log('\nSuggestions:');
    error.suggestions.forEach(s => console.log(`  • ${s}`));
  }
}
```

**Quick Fixes:**
- ✅ Review the [API documentation](https://developers.etsy.com/documentation/reference) for required parameters
- ✅ Validate parameter types before sending requests
- ✅ Use TypeScript for compile-time type checking
- ✅ Enable request validation in the client:
  ```typescript
  const client = new EtsyClient(config);
  // Validation is enabled by default in v2+
  ```

---

### 401 Unauthorized {#401}

**Meaning:** Invalid or expired access token.

**Common Causes:**

1. **Token expired** (tokens expire after 1 hour)
   ```typescript
   // Token from 2 hours ago
   const client = new EtsyClient({
     keystring: 'api-key',
     accessToken: 'old_token',
     refreshToken: 'refresh_token',
     expiresAt: new Date('2025-11-07T10:00:00Z'), // Expired!
   });
   ```

2. **Invalid token format**
   ```typescript
   // ❌ Wrong token format
   const client = new EtsyClient({
     keystring: 'api-key',
     accessToken: 'invalid_token_format',
     // ...
   });
   ```

3. **User revoked app permissions**
   - User went to Etsy settings and revoked your app's access

4. **Token for different shop**
   ```typescript
   // ❌ Using shop A's token to access shop B's data
   const clientA = new EtsyClient({ /* shop A tokens */ });
   await clientA.getShop('shop_b_id'); // 401 error
   ```

**Solutions:**

```typescript
try {
  await client.getUser();
} catch (error) {
  if (error instanceof EtsyApiError && error.statusCode === 401) {
    console.log('Authentication failed. Refreshing token...');

    // Refresh the token
    try {
      await client.refreshAccessToken();

      // Retry the request
      const user = await client.getUser();
      console.log('Success after refresh:', user);
    } catch (refreshError) {
      console.error('Token refresh failed. User needs to re-authenticate.');
      // Redirect user to OAuth flow
      window.location.href = '/auth/etsy';
    }
  }
}
```

**Automatic Token Refresh:**

```typescript
// Enable automatic token refresh
const client = new EtsyClient({
  keystring: process.env.ETSY_API_KEY!,
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_at,
  refreshSave: (newAccess, newRefresh, newExpires) => {
    // Save new tokens
    console.log('Tokens refreshed automatically');
    saveTokensToDatabase(newAccess, newRefresh, newExpires);
  },
});

// Client will automatically refresh when tokens expire
```

**Quick Fixes:**
- ✅ Implement automatic token refresh
- ✅ Check token expiry before making requests
- ✅ Handle re-authentication gracefully in your UI
- ✅ Use `EncryptedFileTokenStorage` or `SecureTokenStorage` for token management

---

### 403 Forbidden {#403}

**Meaning:** You don't have permission to access this resource.

**Common Causes:**

1. **Missing OAuth scopes**
   ```typescript
   // ❌ Trying to update listings without 'listings_w' scope
   const authHelper = new AuthHelper({
     keystring: 'api-key',
     redirectUri: 'callback-url',
     scopes: ['shops_r', 'listings_r'], // Missing 'listings_w'!
   });

   // Later:
   await client.updateListing(listingId, params); // 403 error
   ```

2. **App not approved for production**
   - Your app is still in development mode
   - You're trying to access production features
   - Need to submit app for Etsy review

3. **Accessing someone else's resource**
   ```typescript
   // ❌ Trying to update another shop's listing
   await client.updateListing('other_shops_listing_id', params); // 403
   ```

4. **API endpoint requires special permission**
   - Some endpoints require Etsy's explicit permission
   - Need to contact Etsy API support

**Solutions:**

```typescript
try {
  await client.updateListing(listingId, params);
} catch (error) {
  if (error instanceof EtsyApiError && error.statusCode === 403) {
    console.error('Permission denied:', error.message);

    // Check required scopes from suggestions
    console.log('\nRequired scopes:');
    error.suggestions
      .filter(s => s.includes('scope'))
      .forEach(s => console.log(`  ${s}`));

    // Redirect to re-authorize with additional scopes
    const authHelper = new AuthHelper({
      keystring: process.env.ETSY_API_KEY!,
      redirectUri: process.env.ETSY_REDIRECT_URI!,
      scopes: [
        'shops_r',
        'shops_w',
        'listings_r',
        'listings_w', // Add missing scope
        'transactions_r',
      ],
    });

    const authUrl = await authHelper.getAuthUrl();
    console.log('Re-authorize with new scopes:', authUrl);
  }
}
```

**OAuth Scopes Reference:**

| Scope | Description | Typical Use Cases |
|-------|-------------|-------------------|
| `shops_r` | Read shop information | View shop details, sections |
| `shops_w` | Write shop information | Update shop settings |
| `listings_r` | Read listings | View listings, inventory |
| `listings_w` | Write listings | Create/update listings |
| `listings_d` | Delete listings | Delete listings |
| `transactions_r` | Read orders | View receipts, transactions |
| `transactions_w` | Write orders | Update order status |
| `profile_r` | Read user profile | View user information |
| `profile_w` | Write user profile | Update user information |
| `email_r` | Read user email | Get user's email address |
| `recommend_r` | Read recommendations | Access recommendation data |
| `recommend_w` | Write recommendations | Provide recommendations |
| `feedback_r` | Read feedback | View shop reviews |

**Quick Fixes:**
- ✅ Request all scopes you'll need upfront
- ✅ Check Etsy's API documentation for required scopes per endpoint
- ✅ Submit your app for production approval if still in development
- ✅ Verify you're accessing resources that belong to your authenticated user

---

### 404 Not Found {#404}

**Meaning:** The requested resource doesn't exist.

**Common Causes:**

1. **Invalid resource ID**
   ```typescript
   // ❌ Typo in listing ID
   await client.getListing('12345678901'); // Should be '1234567890'
   ```

2. **Resource was deleted**
   ```typescript
   // Listing was deleted by user
   await client.getListing('deleted_listing_id'); // 404
   ```

3. **Resource belongs to different shop**
   ```typescript
   // ❌ Trying to access shop B's listing from shop A's client
   await clientShopA.getListing('shop_b_listing_id'); // 404
   ```

4. **Incorrect endpoint**
   ```typescript
   // ❌ Wrong API path
   await client.get('/v3/shops/12345/listing'); // Should be 'listings' (plural)
   ```

**Solutions:**

```typescript
try {
  const listing = await client.getListing(listingId);
} catch (error) {
  if (error instanceof EtsyApiError && error.statusCode === 404) {
    console.log('Listing not found. It may have been deleted.');

    // Check if it's in the shop's active listings
    const shop = await client.getShop(shopId);
    const listings = await client.getListingsByShop(shop.shop_id.toString());

    const exists = listings.some(l => l.listing_id.toString() === listingId);
    if (!exists) {
      console.log('Listing confirmed deleted or doesn\'t belong to this shop');
    }
  }
}
```

**Quick Fixes:**
- ✅ Verify resource IDs are correct and current
- ✅ Check if resource was deleted
- ✅ Ensure resource belongs to the authenticated shop
- ✅ Double-check API endpoint paths

---

### 409 Conflict {#409}

**Meaning:** Resource state conflict (race condition or outdated data).

**Common Causes:**

1. **Concurrent updates**
   ```typescript
   // ❌ Two processes updating same listing simultaneously
   await Promise.all([
     client.updateListing(listingId, { price: 10 }),
     client.updateListing(listingId, { price: 20 }),
   ]); // One might get 409
   ```

2. **Stale data**
   ```typescript
   // ❌ Trying to update based on outdated listing data
   const listing = await client.getListing(listingId); // Get at 10:00 AM
   // ... time passes ...
   // Someone else updates the listing at 10:30 AM
   await client.updateListing(listingId, {
     ...listing,
     price: 25,
   }); // Might get 409 if Etsy uses optimistic locking
   ```

**Solutions:**

```typescript
async function updateListingWithRetry(
  client: EtsyClient,
  listingId: string,
  updates: Partial<UpdateListingParams>,
  maxRetries = 3
) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // Get fresh data
      const listing = await client.getListing(listingId);

      // Apply updates
      const result = await client.updateListing(listingId, {
        ...updates,
      });

      return result;
    } catch (error) {
      if (error instanceof EtsyApiError && error.statusCode === 409) {
        console.log(`Conflict detected. Retrying ${i + 1}/${maxRetries}...`);

        if (i === maxRetries - 1) {
          throw error; // Max retries reached
        }

        // Wait before retrying (exponential backoff)
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );
      } else {
        throw error;
      }
    }
  }
}
```

**Quick Fixes:**
- ✅ Fetch fresh resource data before updating
- ✅ Implement retry logic with exponential backoff
- ✅ Use optimistic UI updates with rollback on conflict
- ✅ Avoid concurrent updates to the same resource

---

### 429 Too Many Requests {#429}

**Meaning:** You've exceeded Etsy's rate limits.

**Etsy Rate Limits:**
- **10 requests per second** (per API key)
- **10,000 requests per day** (per API key)

**Common Causes:**

1. **Too many requests in quick succession**
   ```typescript
   // ❌ Flooding the API
   const listings = [...]; // 1000 listings
   for (const listing of listings) {
     await client.updateListing(listing.listing_id, updates); // Too fast!
   }
   ```

2. **Multiple client instances**
   ```typescript
   // ❌ Multiple clients sharing same API key
   const client1 = new EtsyClient(config);
   const client2 = new EtsyClient(config);
   const client3 = new EtsyClient(config);
   // All three count towards the same rate limit!
   ```

3. **No rate limiting in custom implementation**
   ```typescript
   // ❌ Bypassing rate limiter
   const client = new EtsyClient({
     ...config,
     rateLimiting: { enabled: false }, // Don't do this!
   });
   ```

**Solutions:**

```typescript
try {
  await client.updateListing(listingId, updates);
} catch (error) {
  if (error instanceof EtsyApiError && error.statusCode === 429) {
    const retryAfter = error.getRetryAfter();
    const resetTime = error.getRateLimitReset();

    console.log(`Rate limited! Retry after ${retryAfter} seconds`);
    console.log(`Rate limit resets at: ${resetTime?.toLocaleString()}`);

    // Wait and retry
    await new Promise(resolve => setTimeout(resolve, retryAfter! * 1000));

    // Retry request
    await client.updateListing(listingId, updates);
  }
}
```

**Better Approach: Use Bulk Operations**

```typescript
// ✅ Use built-in bulk operations with rate limiting
const updates = [
  { listing_id: '123', price: 10 },
  { listing_id: '456', price: 20 },
  // ... 1000 items
];

const summary = await client.bulkOperations.bulkUpdateListings(updates, {
  concurrency: 5, // Max 5 parallel requests
  retryOnRateLimit: true,
  onProgress: (completed, total) => {
    console.log(`Progress: ${completed}/${total}`);
  },
});

console.log(`Success: ${summary.successful}, Failed: ${summary.failed}`);
```

**Global Rate Limiting (v2.3+):**

```typescript
// Share rate limit across multiple clients
import { GlobalRequestQueue } from '@profplum700/etsy-v3-api-client';

const queue = GlobalRequestQueue.getInstance();

const client1 = new EtsyClient(config1);
const client2 = new EtsyClient(config2);

// Both clients coordinate to avoid rate limits
await Promise.all([
  client1.getShop('shop1'),
  client2.getShop('shop2'),
]);
```

**Quick Fixes:**
- ✅ Enable built-in rate limiting (enabled by default)
- ✅ Use bulk operations for batch updates
- ✅ Implement exponential backoff retry
- ✅ Cache responses to reduce API calls
- ✅ Use GlobalRequestQueue for multiple clients (v2.3+)

---

### 500 Internal Server Error {#500}

**Meaning:** Etsy's server encountered an unexpected error.

**Common Causes:**

- Server-side bug in Etsy's API
- Database issues on Etsy's side
- Unexpected data format
- Temporary infrastructure problems

**Solutions:**

```typescript
try {
  await client.updateListing(listingId, updates);
} catch (error) {
  if (error instanceof EtsyApiError && error.statusCode === 500) {
    console.error('Etsy server error. This is not your fault.');

    if (error.isRetryable()) {
      console.log('Error is retryable. Waiting before retry...');

      // Exponential backoff retry
      for (let i = 0; i < 3; i++) {
        await new Promise(resolve =>
          setTimeout(resolve, Math.pow(2, i) * 1000)
        );

        try {
          return await client.updateListing(listingId, updates);
        } catch (retryError) {
          if (i === 2) throw retryError; // Max retries
        }
      }
    }
  }
}
```

**Quick Fixes:**
- ✅ Implement retry logic (exponential backoff)
- ✅ Check [Etsy API Status](https://status.etsy.com)
- ✅ Log errors for monitoring
- ✅ Set up alerting for repeated 500 errors
- ✅ Contact Etsy support if persistent

---

### 502 Bad Gateway {#502}

**Meaning:** Etsy's API gateway received an invalid response from upstream server.

**Solutions:** Same as [500 errors](#500). Implement retry with exponential backoff.

---

### 503 Service Unavailable {#503}

**Meaning:** Etsy's API is temporarily unavailable (maintenance or overload).

**Solutions:**

```typescript
try {
  await client.getShop(shopId);
} catch (error) {
  if (error instanceof EtsyApiError && error.statusCode === 503) {
    console.log('Etsy API is temporarily unavailable');
    console.log('Check status: https://status.etsy.com');

    // Retry with longer backoff
    await new Promise(resolve => setTimeout(resolve, 60000)); // 1 minute

    try {
      return await client.getShop(shopId);
    } catch (retryError) {
      console.error('API still unavailable. Try again later.');
    }
  }
}
```

---

### 504 Gateway Timeout {#504}

**Meaning:** Request took too long (Etsy's server timeout).

**Common Causes:**
- Complex query taking too long
- Large data set
- Etsy server overload

**Solutions:**

```typescript
// Reduce request complexity
// Instead of:
const listings = await client.getListingsByShop(shopId, {
  includes: ['Images', 'Inventory', 'Shipping', 'Production_Partners'], // Too much data
  limit: 100
});

// Try:
const listings = await client.getListingsByShop(shopId, {
  limit: 25, // Smaller batches
});
```

---

## OAuth Error Codes

### invalid_client

**Meaning:** Invalid API key (keystring).

**Solution:**
- Verify your API key in Etsy Developer Portal
- Check environment variables are set correctly

```bash
# .env
ETSY_API_KEY=your_actual_api_key_here
```

### invalid_grant

**Meaning:** Authorization code or refresh token is invalid/expired.

**Solutions:**
- Authorization code can only be used once
- Refresh token expires after 90 days of inactivity
- User may have revoked app access

```typescript
// If refresh fails, re-authenticate
try {
  await client.refreshAccessToken();
} catch (error) {
  if (error instanceof EtsyAuthError && error.code === 'invalid_grant') {
    console.log('Refresh token invalid. User must re-authenticate.');
    // Redirect to OAuth flow
  }
}
```

### access_denied

**Meaning:** User denied authorization.

**Solution:**
- User clicked "Deny" during OAuth
- Explain to user why you need access
- Improve your app's description and permissions request

### unauthorized_client

**Meaning:** Your app isn't authorized for this operation.

**Solutions:**
- App not approved for production
- Missing required app configuration
- Contact Etsy API support

---

## Validation Errors

### ValidationException

**Meaning:** Request failed client-side validation before sending to Etsy.

**Example:**

```typescript
import { ValidationException } from '@profplum700/etsy-v3-api-client';

try {
  await client.createDraftListing({
    title: '', // Empty title
    price: -10, // Negative price
    quantity: 'invalid', // Not a number
    who_made: 'invalid', // Invalid enum
  });
} catch (error) {
  if (error instanceof ValidationException) {
    console.error('Validation errors:');
    error.errors.forEach(err => {
      console.error(`  - ${err.field}: ${err.message}`);
    });
    // Output:
    //   - title: Title is required and cannot be empty
    //   - price: Price must be a positive number
    //   - quantity: Quantity must be a number
    //   - who_made: Must be one of: i_did, someone_else, collective
  }
}
```

**Quick Fixes:**
- ✅ Validation catches errors before API call (saves rate limit)
- ✅ Review error messages for specific field issues
- ✅ Use TypeScript for compile-time validation
- ✅ Check API documentation for valid values

---

## Rate Limiting

### Built-in Rate Limiter

```typescript
// Rate limiting is enabled by default
const client = new EtsyClient(config);

// Check rate limit status
const status = client.getRateLimitStatus();
console.log(`Remaining requests: ${status.remainingRequests}`);
console.log(`Reset time: ${status.resetTime}`);
console.log(`Can make request: ${status.canMakeRequest}`);

// Wait for rate limit
if (!status.canMakeRequest) {
  console.log('Rate limit reached. Waiting...');
  await new Promise(resolve =>
    setTimeout(resolve, status.resetTime.getTime() - Date.now())
  );
}
```

### Custom Rate Limiting

```typescript
const client = new EtsyClient({
  ...config,
  rateLimiting: {
    enabled: true,
    maxRequestsPerDay: 8000, // Lower than default 10,000
    maxRequestsPerSecond: 5, // Lower than default 10
    minRequestInterval: 200, // 200ms between requests
  },
});
```

---

## Best Practices

### 1. Always Handle Errors

```typescript
// ❌ Bad: Unhandled promise
client.getListing(listingId);

// ✅ Good: Proper error handling
try {
  const listing = await client.getListing(listingId);
  console.log(listing);
} catch (error) {
  if (error instanceof EtsyApiError) {
    console.error('Etsy API Error:');
    console.error(error.toString()); // Beautiful formatted error
  } else {
    console.error('Unexpected error:', error);
  }
}
```

### 2. Log Errors for Debugging

```typescript
try {
  await client.updateListing(listingId, updates);
} catch (error) {
  if (error instanceof EtsyApiError) {
    // Log to monitoring service (Sentry, LogRocket, etc.)
    logger.error('Etsy API Error', {
      ...error.toJSON(), // Includes all context
      userId: currentUser.id,
      operation: 'updateListing',
    });
  }
}
```

### 3. Implement Retry Logic

```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof EtsyApiError && error.isRetryable()) {
        const delay = Math.pow(2, i) * 1000; // Exponential backoff
        console.log(`Retry ${i + 1}/${maxRetries} after ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        throw error; // Not retryable
      }
    }
  }

  throw new Error('Max retries exceeded');
}

// Usage:
const listing = await withRetry(() => client.getListing(listingId));
```

### 4. Use Type Guards

```typescript
import { EtsyApiError, EtsyAuthError, ValidationException } from '@profplum700/etsy-v3-api-client';

try {
  await client.createDraftListing(params);
} catch (error) {
  if (error instanceof ValidationException) {
    // Handle validation errors
    handleValidationErrors(error.errors);
  } else if (error instanceof EtsyAuthError) {
    // Handle auth errors
    redirectToLogin();
  } else if (error instanceof EtsyApiError) {
    // Handle API errors
    if (error.statusCode === 429) {
      handleRateLimit(error);
    } else if (error.statusCode === 403) {
      handlePermissionDenied(error);
    } else {
      handleGenericError(error);
    }
  } else {
    // Handle unexpected errors
    console.error('Unexpected error:', error);
  }
}
```

### 5. Cache Responses

```typescript
// Enable caching to reduce API calls
const client = new EtsyClient({
  ...config,
  caching: {
    enabled: true,
    ttl: 300, // Cache for 5 minutes
  },
});

// Or use advanced caching (v2+)
import { AdvancedCacheManager } from '@profplum700/etsy-v3-api-client';

const cacheManager = new AdvancedCacheManager({
  defaultTTL: 300,
  maxSize: 100,
});

// Cache with tags
const listing = await client.getListing(listingId);
await cacheManager.set(
  `listing:${listingId}`,
  listing,
  300,
  ['listings', `shop:${listing.shop_id}`]
);

// Invalidate cache when updating
await client.updateListing(listingId, updates);
await cacheManager.invalidateByTags(['listings', `shop:${shopId}`]);
```

---

## Quick Reference

| Status | Error | Retryable? | Common Fix |
|--------|-------|------------|------------|
| 400 | Bad Request | ❌ No | Fix request parameters |
| 401 | Unauthorized | ⚠️ Sometimes | Refresh token or re-auth |
| 403 | Forbidden | ❌ No | Add required OAuth scopes |
| 404 | Not Found | ❌ No | Verify resource ID |
| 409 | Conflict | ✅ Yes | Fetch fresh data, retry |
| 429 | Rate Limited | ✅ Yes | Wait and retry |
| 500 | Server Error | ✅ Yes | Retry with backoff |
| 502 | Bad Gateway | ✅ Yes | Retry with backoff |
| 503 | Unavailable | ✅ Yes | Wait longer, retry |
| 504 | Timeout | ✅ Yes | Reduce request size |

---

## Related Documentation

- [Common Issues](./common-issues.md)
- [Authentication Guide](../guides/authentication.md)
- [Getting Started](../guides/getting-started.md)
- [Localhost Development](../guides/LOCALHOST_DEVELOPMENT.md)

---

## Still Need Help?

If you encounter an error not covered here:

1. Check the [Etsy API Documentation](https://developers.etsy.com/documentation/reference)
2. Search [GitHub Issues](https://github.com/profplum700/etsy-v3-api-client/issues)
3. Create a [new issue](https://github.com/profplum700/etsy-v3-api-client/issues/new) with:
   - Error message and stack trace
   - Request parameters (sanitize sensitive data!)
   - Expected vs actual behavior
   - Code sample to reproduce

---

**Document Version:** 1.0.0
**Last Updated:** 2025-11-07
