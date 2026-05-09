/**
 * Cloudflare Worker-safe entrypoint.
 *
 * This surface intentionally exports the request client and environment-safe
 * helpers only. Node-only storage/security helpers and browser-only storage
 * adapters remain available from the default, browser, and node entrypoints.
 */

export { EtsyClient } from './client';

export { EtsyRateLimiter, defaultRateLimiter, ETSY_RATE_LIMITS } from './rate-limiting';

export {
  PaginatedResults,
  createPaginatedResults,
  type PaginationOptions,
  type PageFetcher
} from './pagination';

export {
  RetryManager,
  withRetry,
  DEFAULT_RETRY_CONFIG,
  type RetryConfig,
  type RetryOptions
} from './retry';

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

export {
  isBrowser,
  isNode,
  isWebWorker,
  hasFetch,
  hasWebCrypto,
  getEnvironmentInfo,
  getAvailableStorage
} from './utils/environment';

export {
  EtsyApiError,
  EtsyAuthError,
  EtsyRateLimitError
} from './types';

export type {
  EtsyClientConfig,
  TokenProvider,
  EtsyApiResponse,
  EtsyPagination,
  EtsyUser,
  EtsyShop,
  EtsyShopSection,
  EtsyListing,
  EtsyReview,
  EtsyListingImage,
  EtsyListingInventory,
  EtsyListingProduct,
  EtsyListingOffering,
  EtsyListingPropertyValue,
  EtsySellerTaxonomyNode,
  UpdateShopParams,
  CreateShopSectionParams,
  UpdateShopSectionParams,
  CreateDraftListingParams,
  UpdateListingParams,
  UpdateListingInventoryParams,
  EtsyShopReceipt,
  EtsyShopReceiptTransaction,
  EtsyShopReceiptShipment,
  EtsyShippingProfile,
  EtsyShippingProfileDestination,
  EtsyShippingProfileUpgrade,
  EtsyPaymentAccountLedgerEntry,
  EtsyPayment,
  EtsyBuyerTaxonomyNode,
  EtsyBuyerTaxonomyProperty,
  EtsyListingProperty,
  EtsyShopProductionPartner,
  EtsyListingFile,
  EtsyListingVideo,
  EtsyListingTranslation,
  EtsyListingVariationImage,
  EtsyUserAddress,
  EtsyShippingCarrier,
  EtsyListingPersonalization,
  RateLimitStatus,
  LoggerInterface,
  CacheStorage
} from './types';
