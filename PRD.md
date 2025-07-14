# Product Requirements Document: etsy-v3-api-client

## Overview
Extract the current Etsy API client implementation from the Forest Hill Arts House website into a standalone, public JavaScript library (`etsy-v3-api-client`) that can be published to npm and used in any JavaScript environment, following OAuth 2.0 authentication patterns similar to the Python `etsyv3` library.

## Goals
1. Create a production-ready, reusable Etsy API client library
2. Follow established OAuth 2.0 authentication patterns
3. Maintain all sophisticated features of the current implementation
4. Make the library valuable for the broader JavaScript community
5. Enable seamless integration back into the original project

## Target Audience
- JavaScript/TypeScript developers building Etsy integrations
- E-commerce developers working with Etsy API v3
- Node.js and browser application developers
- Developers migrating from Etsy API v2

## Project Structure

### Core Library Files
- **`src/client.ts`** - Main EtsyClient class (from `lib/etsy-client.ts`)
- **`src/auth/auth-helper.ts`** - OAuth 2.0 authentication helper
- **`src/auth/token-manager.ts`** - Token management and refresh logic
- **`src/config.ts`** - Configuration management (adapted from `lib/etsy-config.ts`)
- **`src/types.ts`** - TypeScript interfaces and types
- **`src/classification/index.ts`** - Product classification utilities (from `lib/product-classification.ts`)
- **`src/classification/era-mapping.ts`** - Era mapping utilities (from `lib/etsy-era-mapping.ts`)
- **`src/rate-limiting.ts`** - Rate limiting implementation
- **`src/index.ts`** - Main entry point with exports

### Build & Development
- **`package.json`** - NPM package configuration for public publishing
- **`tsconfig.json`** - TypeScript configuration for library builds
- **`rollup.config.js`** - Build configuration for ESM/CJS/UMD outputs
- **`jest.config.js`** - Test configuration
- **`.github/workflows/`** - CI/CD for automated testing and publishing

### Documentation
- **`README.md`** - Comprehensive usage guide and API documentation
- **`docs/authentication.md`** - Complete OAuth 2.0 flow documentation
- **`docs/usage-examples.md`** - Code examples for common use cases
- **`CHANGELOG.md`** - Version history
- **`examples/`** - Working examples for Node.js, browser, and frameworks

## Authentication System (Inspired by etsyv3 Python library)

### 1. AuthHelper Class
```typescript
interface AuthHelperConfig {
  keystring: string;           // Etsy API keystring
  redirectUri: string;         // One of your registered redirect URIs
  scopes: string[];           // List of required scopes
  codeVerifier?: string;      // PKCE code verifier (auto-generated if not provided)
  state?: string;             // OAuth state parameter (auto-generated if not provided)
}

class AuthHelper {
  constructor(config: AuthHelperConfig);
  
  // Step 1: Get authorization URL
  getAuthUrl(): string;
  
  // Step 2: Set authorization code from callback
  setAuthorizationCode(code: string, state: string): void;
  
  // Step 3: Exchange code for tokens
  async getAccessToken(): Promise<{
    access_token: string;
    refresh_token: string;
    expires_at: Date;
    token_type: string;
    scope: string;
  }>;
}
```

### 2. Authentication Flow
```typescript
// Step 1: Initialize auth helper
const authHelper = new AuthHelper({
  keystring: 'your-etsy-api-key',
  redirectUri: 'https://yourapp.com/auth/callback',
  scopes: ['listings_r', 'shops_r']
});

// Step 2: Get authorization URL
const authUrl = authHelper.getAuthUrl();
console.log('Go to:', authUrl);

// Step 3: Handle callback (in your callback handler)
authHelper.setAuthorizationCode(code, state);
const tokens = await authHelper.getAccessToken();

// Step 4: Use tokens to initialize EtsyClient
const client = new EtsyClient({
  keystring: 'your-etsy-api-key',
  accessToken: tokens.access_token,
  refreshToken: tokens.refresh_token,
  expiresAt: tokens.expires_at,
  refreshSave: (accessToken, refreshToken, expiresAt) => {
    // Save updated tokens to your storage
    saveTokens({ accessToken, refreshToken, expiresAt });
  }
});
```

### 3. EtsyClient Configuration
```typescript
interface EtsyClientConfig {
  keystring: string;
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  refreshSave?: (accessToken: string, refreshToken: string, expiresAt: Date) => void;
  
  // Optional configuration
  baseUrl?: string;
  rateLimiting?: {
    enabled: boolean;
    maxRequestsPerDay?: number;
    maxRequestsPerSecond?: number;
  };
  caching?: {
    enabled: boolean;
    ttl?: number;
    storage?: CacheStorage;
  };
}
```

## Key Features

### Core API Methods (Following Python library patterns)
- **Shop and Listing Methods**: getUser(), getShop(), getShopSections(), getListingsByShop(), etc.
- **Product Classification**: classifyProduct(), classifyProducts(), calculateItemAge(), etc.
- **Search Methods**: findAllListingsActive(), with comprehensive filtering
- **Image and Inventory**: getListingImages(), getListingInventory()

### Advanced Features
- **Token Management**: Automatic token refresh, validation, secure storage patterns
- **Rate Limiting**: Configurable limits (10 requests/second, 10,000/day), queue management
- **Error Handling**: Comprehensive error types, retry logic with exponential backoff
- **Caching**: Configurable strategies, Memory/Redis/custom storage support
- **Environment Support**: Node.js, browser, framework integrations

## Key Adaptations for Public Library

### 1. Remove Next.js Dependencies
- Replace `next/cache` revalidation with generic caching interface
- Remove Next.js specific `revalidate` and `tags` from fetch options
- Make caching optional/configurable

### 2. Environment-Agnostic Design
- Support both Node.js and browser environments
- Flexible credential management (env vars, direct config, or callback)
- Optional dependency injection for custom storage/caching

### 3. Database-Agnostic Classification
- Remove Supabase-specific code from classification utilities
- Make database operations optional
- Provide generic interfaces for custom database integration

### 4. Enhanced Error Handling
- Comprehensive error types for different API failures
- Retry logic with exponential backoff
- Better debugging and logging options

## Implementation Phases

### Phase 1: Core Authentication & Client (Week 1)
1. ✅ Set up project structure and build system
2. ✅ Create package.json with npm configuration
3. ✅ Set up TypeScript configuration
4. ✅ Set up build system (Rollup) for multiple outputs
5. ✅ Extract and adapt types from existing code
6. ✅ Create AuthHelper with OAuth 2.0 flow
7. ✅ Implement token management and refresh logic
8. ✅ Extract and adapt EtsyClient class
9. ✅ Remove Next.js dependencies and make environment-agnostic

### Phase 2: API Methods & Classification (Week 2)
1. ✅ Extract product classification system
2. ✅ Extract era mapping utilities
3. ✅ Create main entry point with exports
4. ✅ Add comprehensive TypeScript definitions
5. ✅ Implement rate limiting

### Phase 3: Documentation & Examples (Week 3)
1. ✅ Set up Jest testing configuration
2. ✅ Port existing tests to new library structure
3. ✅ Create comprehensive README.md
4. ✅ Create authentication documentation
5. ✅ Create usage examples for different environments

### Phase 4: Testing & Publishing (Week 4)
1. ✅ Set up CI/CD pipeline
2. ✅ Publish to npm registry
3. ✅ Update original project to use new library
4. ✅ Test integration in current project

## Success Metrics

### Technical Metrics
- **Test Coverage**: 90%+ code coverage
- **Bundle Size**: < 50KB gzipped
- **TypeScript Support**: Full type definitions
- **Environment Support**: Node.js 16+, modern browsers
- **Build Outputs**: ESM, CJS, UMD formats

### Usage Metrics
- **npm Downloads**: Track adoption after publishing
- **GitHub Stars**: Community engagement
- **Issues/PRs**: Community contributions
- **Documentation**: Clear examples and guides

## Risk Assessment

### Technical Risks
- **OAuth Flow Complexity**: Mitigated by following established patterns
- **Rate Limiting**: Handled with queue management and backoff
- **Token Management**: Secure patterns with refresh logic
- **Environment Compatibility**: Extensive testing across platforms

### Business Risks
- **API Changes**: Etsy API v3 is stable, monitor for updates
- **Security**: Follow OAuth best practices, no token logging
- **Maintenance**: Clear documentation and community support

## Integration Back to Current Project

### 1. Package Dependencies
```json
{
  "dependencies": {
    "etsy-v3-api-client": "^1.0.0"
  }
}
```

### 2. Import Migration
```typescript
// Before
import { etsyClient } from './lib/etsy-client';
import { classifyProducts } from './lib/product-classification';

// After  
import { EtsyClient, classifyProducts } from 'etsy-v3-api-client';
const client = new EtsyClient(config);
```

### 3. Configuration Migration
- Move environment variables to library config
- Update initialization code
- Maintain all existing functionality

## Deliverables

### Library Package
- **npm package**: `etsy-v3-api-client`
- **Multiple formats**: ESM, CJS, UMD
- **TypeScript support**: Full type definitions
- **Documentation**: Comprehensive README and examples
- **Testing**: 90%+ test coverage

### Integration
- **Updated project**: Uses new library instead of local files
- **Maintained functionality**: All existing features work
- **Improved maintainability**: Centralized Etsy API logic

This creates a production-ready, reusable library while maintaining all the sophisticated features of the current implementation, making it valuable for the broader JavaScript community.