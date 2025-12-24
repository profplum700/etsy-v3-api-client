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
  FileTokenStorage,
  LocalStorageTokenStorage,
  SessionStorageTokenStorage,
  createDefaultTokenStorage
} from './auth/token-manager';

// ============================================================================
// Rate Limiting Exports
// ============================================================================

export { EtsyRateLimiter, defaultRateLimiter } from './rate-limiting';

// ============================================================================
// Request Queue Exports
// ============================================================================

export { GlobalRequestQueue, getGlobalQueue, withQueue } from './request-queue';
export type { RequestPriority, QueueOptions } from './request-queue';

// ============================================================================
// Pagination Exports (Phase 1)
// ============================================================================

export {
  PaginatedResults,
  createPaginatedResults,
  type PaginationOptions,
  type PageFetcher
} from './pagination';

// ============================================================================
// Retry Logic Exports (Phase 1)
// ============================================================================

export {
  RetryManager,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type RetryOptions
} from './retry';

// ============================================================================
// Webhook Support Exports (Phase 1)
// ============================================================================

export {
  EtsyWebhookHandler,
  createWebhookHandler,
  type WebhookConfig,
  type EtsyWebhookEventType,
  type EtsyWebhookEvent,
  type WebhookEventHandler
} from './webhooks';

// ============================================================================
// Bulk Operations Exports (Phase 2)
// ============================================================================

export {
  BulkOperationManager,
  createBulkOperationManager,
  executeBulkOperation,
  type BulkOperationConfig,
  type BulkOperationResult,
  type BulkOperationError,
  type BulkUpdateListingOperation,
  type BulkImageUploadOperation,
  type BulkOperationSummary
} from './bulk-operations';

// ============================================================================
// Advanced Caching Exports (Phase 2)
// ============================================================================

export {
  LRUCache,
  LFUCache,
  CacheWithInvalidation,
  RedisCacheStorage,
  createCacheStorage,
  createCacheWithInvalidation,
  createRedisCacheStorage,
  type AdvancedCachingConfig,
  type CacheStrategy,
  type CacheEntry,
  type CacheStats,
  type RedisConfig,
  type RedisClientLike
} from './advanced-caching';

// ============================================================================
// Query Builder Exports (Phase 2)
// ============================================================================

export {
  ListingQueryBuilder,
  ReceiptQueryBuilder,
  BatchQueryExecutor,
  withQueryBuilder,
  createListingQuery,
  createReceiptQuery,
  createBatchQuery,
  type EtsyClientWithQueryBuilder,
  type SortOrder,
  type ListingState,
  type ListingSortOn
} from './query-builder';

// ============================================================================
// Validation Exports (Phase 2)
// ============================================================================

export {
  Validator,
  FieldValidator,
  ValidationException,
  field,
  CreateListingSchema,
  UpdateListingSchema,
  UpdateShopSchema,
  validateOrThrow,
  validate,
  createValidator,
  combineValidators,
  type ValidationResult,
  type ValidationError,
  type ValidationSchema,
  type ValidatorFunction,
  type ValidationOptions
} from './validation';

// ============================================================================
// Security Exports (Phase 5)
// ============================================================================

export {
  // Encryption utilities
  encryptAES256GCM,
  decryptAES256GCM,
  generateEncryptionKey,
  deriveKeyFromPassword,
  validateEncryptionKey,
  type EncryptedData,

  // Encrypted storage
  EncryptedFileTokenStorage,
  type EncryptedStorageConfig,

  // Browser secure storage
  SecureTokenStorage,
  isSecureStorageSupported,
  type SecureTokenStorageConfig,

  // Webhook security
  WebhookSecurity,
  createWebhookSecurity,
  type WebhookSecurityConfig
} from './security';

// ============================================================================
// Plugin System Exports
// ============================================================================

export {
  PluginManager,
  createAnalyticsPlugin,
  createRetryPlugin,
  createLoggingPlugin,
  createCachingPlugin,
  createRateLimitPlugin,
  type EtsyPlugin,
  type PluginRequestConfig,
  type PluginResponse,
  type AnalyticsPluginConfig,
  type RetryPluginConfig,
  type LoggingPluginConfig,
  type CachingPluginConfig,
  type RateLimitPluginConfig,
} from './plugins';

// ============================================================================
// Utility Exports
// ============================================================================

export {
  isBrowser,
  isNode,
  hasLocalStorage,
  hasSessionStorage,
  getEnvironmentInfo,
  getAvailableStorage
} from './utils/environment';

export {
  generateCodeVerifier,
  generateState,
  createCodeChallenge,
  generateRandomBase64Url,
  sha256,
  sha256Base64Url
} from './utils/crypto';


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
  TokenRotationCallback,
  TokenStorage,
  TokenRotationConfig,

  // API Response Types
  EtsyApiResponse,
  EtsyPagination,
  EtsyUser,
  EtsyShop,
  EtsyShopSection,
  EtsyListing,
  EtsyListingImage,
  EtsyListingInventory,
  EtsyListingProduct,
  EtsyListingOffering,
  EtsyListingPropertyValue,
  EtsySellerTaxonomyNode,

  // Shop Management Types
  UpdateShopParams,
  CreateShopSectionParams,
  UpdateShopSectionParams,

  // Shop Receipts/Orders Types
  EtsyShopReceipt,
  EtsyShopReceiptTransaction,
  EtsyShopReceiptShipment,
  EtsyShopRefund,
  EtsyTransactionVariation,
  GetShopReceiptsParams,
  UpdateShopReceiptParams,

  // Shipping Profile Types
  EtsyShippingProfile,
  EtsyShippingProfileDestination,
  EtsyShippingProfileUpgrade,
  CreateShippingProfileParams,
  UpdateShippingProfileParams,
  CreateShippingProfileDestinationParams,
  UpdateShippingProfileDestinationParams,
  CreateReceiptShipmentParams,

  // Payment & Ledger Types
  EtsyPaymentAccountLedgerEntry,
  EtsyPaymentAdjustment,
  EtsyPayment,
  GetPaymentAccountLedgerEntriesParams,

  // Listing Write Operations Types
  CreateDraftListingParams,
  UpdateListingParams,
  UpdateListingInventoryParams,

  // Listing Property Types
  EtsyListingProperty,
  EtsyListingPropertyScale,

  // Extended Taxonomy Types
  EtsyBuyerTaxonomyNode,
  EtsyBuyerTaxonomyProperty,
  EtsyBuyerTaxonomyPropertyScale,
  EtsyBuyerTaxonomyPropertyValue,

  // Shop Production Partner Types
  EtsyShopProductionPartner,

  // File Upload Types
  UploadListingImageParams,
  UploadListingFileParams,

  // API Parameters
  ListingParams,
  SearchParams,

  // Rate Limiting Types
  RateLimitConfig,
  RateLimitStatus,
  EtsyRateLimitHeaders,
  RateLimitErrorType,
  ApproachingLimitCallback,

  // Error Types (Phase 1)
  EtsyErrorDetails,

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

export const VERSION = '2.2.0';
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
    author: 'profplum700',
    license: 'MIT',
    homepage: 'https://github.com/ForestHillArtsHouse/etsy-v3-api-client#readme'
  };
}