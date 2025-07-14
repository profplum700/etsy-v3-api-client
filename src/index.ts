/**
 * Etsy API v3 Client Library
 * A comprehensive JavaScript/TypeScript client for the Etsy Open API v3
 * with OAuth 2.0 authentication
 */

// ============================================================================
// Main Client Export
// ============================================================================

export { EtsyClient } from './client';

// ============================================================================
// Authentication Exports
// ============================================================================

export { AuthHelper, ETSY_SCOPES, COMMON_SCOPE_COMBINATIONS } from './auth/auth-helper';
export { 
  TokenManager, 
  MemoryTokenStorage, 
  FileTokenStorage
} from './auth/token-manager';

// ============================================================================
// Rate Limiting Exports
// ============================================================================

export { EtsyRateLimiter, defaultRateLimiter } from './rate-limiting';


// ============================================================================
// Type Exports
// ============================================================================

export type {
  // Configuration Types
  EtsyClientConfig,
  AuthHelperConfig,
  
  // Authentication Types
  EtsyTokens,
  EtsyTokenResponse,
  TokenRefreshCallback,
  TokenStorage,
  
  // API Response Types
  EtsyApiResponse,
  EtsyUser,
  EtsyShop,
  EtsyShopSection,
  EtsyListing,
  EtsyListingImage,
  EtsyListingInventory,
  EtsyListingProduct,
  EtsyListingOffering,
  EtsyListingPropertyValue,
  
  // API Parameters
  ListingParams,
  SearchParams,
  
  // Rate Limiting Types
  RateLimitConfig,
  RateLimitStatus,
  
  // Utility Types
  CacheStorage,
  LoggerInterface
} from './types';

export {
  // Error Types
  EtsyApiError,
  EtsyAuthError,
  EtsyRateLimitError
} from './types';

// ============================================================================
// Utility Functions
// ============================================================================

import { EtsyClient } from './client';
import { AuthHelper } from './auth/auth-helper';
import { TokenManager } from './auth/token-manager';
import { EtsyRateLimiter } from './rate-limiting';
import { EtsyClientConfig, AuthHelperConfig, RateLimitConfig, TokenStorage } from './types';

/**
 * Create a new Etsy client with configuration
 */
export function createEtsyClient(config: EtsyClientConfig): EtsyClient {
  return new EtsyClient(config);
}

/**
 * Create an authentication helper
 */
export function createAuthHelper(config: AuthHelperConfig): AuthHelper {
  return new AuthHelper(config);
}

/**
 * Create a token manager
 */
export function createTokenManager(config: EtsyClientConfig, storage?: TokenStorage): TokenManager {
  return new TokenManager(config, storage);
}

/**
 * Create a rate limiter
 */
export function createRateLimiter(config?: Partial<RateLimitConfig>): EtsyRateLimiter {
  return new EtsyRateLimiter(config);
}


// ============================================================================
// Default Export
// ============================================================================

/**
 * Default export - the main EtsyClient class
 */
export default EtsyClient;

// ============================================================================
// Library Information
// ============================================================================

export const VERSION = '1.0.0';
export const LIBRARY_NAME = 'etsy-v3-api-client';

/**
 * Get library information
 */
export function getLibraryInfo(): {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  homepage: string;
} {
  return {
    name: LIBRARY_NAME,
    version: VERSION,
    description: 'JavaScript/TypeScript client for the Etsy Open API v3 with OAuth 2.0 authentication',
    author: 'Henry',
    license: 'MIT',
    homepage: 'https://github.com/ForestHillArtsHouse/etsy-v3-api-client#readme'
  };
}