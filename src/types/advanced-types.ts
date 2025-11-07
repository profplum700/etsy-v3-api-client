/**
 * Advanced TypeScript types for better type safety and developer experience
 */

// ============================================================================
// Branded Types for IDs
// ============================================================================

/**
 * Brand type helper to create nominal types
 */
type Brand<K, T> = K & { __brand: T };

/**
 * Shop ID - branded string to prevent mixing with other ID types
 */
export type ShopId = Brand<string, 'ShopId'>;

/**
 * Listing ID - branded string to prevent mixing with other ID types
 */
export type ListingId = Brand<string, 'ListingId'>;

/**
 * User ID - branded string to prevent mixing with other ID types
 */
export type UserId = Brand<string, 'UserId'>;

/**
 * Receipt ID - branded string to prevent mixing with other ID types
 */
export type ReceiptId = Brand<string, 'ReceiptId'>;

/**
 * Transaction ID - branded string to prevent mixing with other ID types
 */
export type TransactionId = Brand<string, 'TransactionId'>;

/**
 * Shipping Profile ID - branded string to prevent mixing with other ID types
 */
export type ShippingProfileId = Brand<string, 'ShippingProfileId'>;

/**
 * Helper functions to create branded IDs
 */
export const BrandedIds = {
  shop: (id: string | number): ShopId => String(id) as ShopId,
  listing: (id: string | number): ListingId => String(id) as ListingId,
  user: (id: string | number): UserId => String(id) as UserId,
  receipt: (id: string | number): ReceiptId => String(id) as ReceiptId,
  transaction: (id: string | number): TransactionId => String(id) as TransactionId,
  shippingProfile: (id: string | number): ShippingProfileId => String(id) as ShippingProfileId,
};

// ============================================================================
// Taxonomy IDs - Const Enum
// ============================================================================

/**
 * Etsy Taxonomy IDs for major categories
 * Using const assertions for better autocomplete and type checking
 */
export const TAXONOMY_IDS = {
  // Top-level categories
  ACCESSORIES: 1665 as const,
  ART_AND_COLLECTIBLES: 1669 as const,
  BAGS_AND_PURSES: 1671 as const,
  BATH_AND_BEAUTY: 1670 as const,
  BOOKS_MOVIES_AND_MUSIC: 1673 as const,
  CLOTHING: 1664 as const,
  CRAFT_SUPPLIES_AND_TOOLS: 1672 as const,
  ELECTRONICS_AND_ACCESSORIES: 1674 as const,
  GIFTS: 1675 as const,
  HOME_AND_LIVING: 1668 as const,
  JEWELRY: 1667 as const,
  PAPER_AND_PARTY_SUPPLIES: 1676 as const,
  PET_SUPPLIES: 1677 as const,
  TOYS_AND_GAMES: 1678 as const,
  WEDDINGS: 1679 as const,

  // Common subcategories
  NECKLACES: 1110 as const,
  EARRINGS: 1113 as const,
  RINGS: 1117 as const,
  BRACELETS: 1116 as const,
  PAINTINGS: 1926 as const,
  PRINTS: 1925 as const,
  SCULPTURES: 1931 as const,
  WOMENS_CLOTHING: 1103 as const,
  MENS_CLOTHING: 1104 as const,
  KIDS_CLOTHING: 1105 as const,
  HOME_DECOR: 1122 as const,
  FURNITURE: 1124 as const,
  LIGHTING: 1125 as const,
} as const;

/**
 * Type representing valid taxonomy IDs
 */
export type TaxonomyId = typeof TAXONOMY_IDS[keyof typeof TAXONOMY_IDS];

/**
 * Helper to check if a number is a valid taxonomy ID
 */
export function isTaxonomyId(id: number): id is TaxonomyId {
  return Object.values(TAXONOMY_IDS).includes(id as TaxonomyId);
}

// ============================================================================
// Listing State - Discriminated Union
// ============================================================================

/**
 * Base listing properties shared across all states
 */
interface BaseListingProperties {
  listing_id: ListingId;
  user_id: UserId;
  shop_id: ShopId;
  title: string;
  description: string;
  price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  taxonomy_id: number;
  created_timestamp: number;
  updated_timestamp: number;
}

/**
 * Active listing with view metrics
 */
export interface ActiveListing extends BaseListingProperties {
  state: 'active';
  url: string;
  views: number;
  num_favorers: number;
  quantity: number;
  is_digital: boolean;
  file_data?: string;
  can_write_inventory: boolean;
  should_auto_renew: boolean;
  processing_min?: number;
  processing_max?: number;
  tags: string[];
  materials: string[];
  shipping_profile_id: ShippingProfileId | null;
  return_policy_id: number | null;
  production_partner_ids: number[];
  who_made: 'i_did' | 'someone_else' | 'collective';
  when_made: string;
  is_supply: boolean;
  item_weight?: number;
  item_weight_unit?: string;
  item_dimensions?: {
    length?: number;
    width?: number;
    height?: number;
  };
}

/**
 * Draft listing (not yet published)
 */
export interface DraftListing extends BaseListingProperties {
  state: 'draft';
  url?: undefined;
  views?: undefined;
  num_favorers?: undefined;
  quantity?: number;
  is_digital?: boolean;
}

/**
 * Inactive listing (deactivated by seller)
 */
export interface InactiveListing extends BaseListingProperties {
  state: 'inactive';
  url?: undefined;
  views?: undefined;
  num_favorers?: undefined;
  deactivation_reason?: string;
  deactivated_at?: number;
}

/**
 * Expired listing (not renewed)
 */
export interface ExpiredListing extends BaseListingProperties {
  state: 'expired';
  url?: undefined;
  views?: undefined;
  num_favorers?: undefined;
  expired_at: number;
}

/**
 * Sold out listing
 */
export interface SoldOutListing extends BaseListingProperties {
  state: 'sold_out';
  url: string;
  views: number;
  num_favorers: number;
  quantity: 0;
  sold_out_at: number;
}

/**
 * Discriminated union of all listing states
 */
export type EtsyListingByState =
  | ActiveListing
  | DraftListing
  | InactiveListing
  | ExpiredListing
  | SoldOutListing;

/**
 * Type guard for active listings
 */
export function isActiveListing(listing: EtsyListingByState): listing is ActiveListing {
  return listing.state === 'active';
}

/**
 * Type guard for draft listings
 */
export function isDraftListing(listing: EtsyListingByState): listing is DraftListing {
  return listing.state === 'draft';
}

/**
 * Type guard for inactive listings
 */
export function isInactiveListing(listing: EtsyListingByState): listing is InactiveListing {
  return listing.state === 'inactive';
}

// ============================================================================
// OAuth Scopes - Template Literal Types
// ============================================================================

/**
 * Available OAuth scope categories
 */
type ScopeCategory = 'shops' | 'listings' | 'transactions' | 'profile' | 'email' | 'recommend' | 'feedback';

/**
 * Available OAuth scope actions
 */
type ScopeAction = 'r' | 'w' | 'd';

/**
 * OAuth scope as template literal type
 */
export type EtsyScope = `${ScopeCategory}_${ScopeAction}`;

/**
 * All valid Etsy OAuth scopes
 */
export const ETSY_OAUTH_SCOPES: Record<EtsyScope, string> = {
  'shops_r': 'Read shop information',
  'shops_w': 'Write shop information',
  'listings_r': 'Read listings',
  'listings_w': 'Write listings',
  'listings_d': 'Delete listings',
  'transactions_r': 'Read transactions',
  'transactions_w': 'Write transactions',
  'profile_r': 'Read user profile',
  'profile_w': 'Write user profile',
  'email_r': 'Read user email',
  'recommend_r': 'Read recommendations',
  'recommend_w': 'Write recommendations',
  'feedback_r': 'Read feedback',
};

/**
 * Helper to validate scope
 */
export function isValidScope(scope: string): scope is EtsyScope {
  return scope in ETSY_OAUTH_SCOPES;
}

// ============================================================================
// Property IDs - Template Literal Types
// ============================================================================

/**
 * Standard dimension property IDs
 */
export type DimensionProperty = 'width' | 'height' | 'depth' | 'diameter' | 'length' | 'weight';

/**
 * Custom numeric property IDs
 */
export type CustomPropertyId = `${number}`;

/**
 * All property IDs (standard dimensions or custom numeric)
 */
export type PropertyId = DimensionProperty | CustomPropertyId;

// ============================================================================
// Result Types
// ============================================================================

/**
 * Success result type
 */
export interface Success<T> {
  success: true;
  data: T;
}

/**
 * Error result type
 */
export interface Failure<E = Error> {
  success: false;
  error: E;
}

/**
 * Result type (either success or failure)
 */
export type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Helper to create success result
 */
export function success<T>(data: T): Success<T> {
  return { success: true, data };
}

/**
 * Helper to create failure result
 */
export function failure<E = Error>(error: E): Failure<E> {
  return { success: false, error };
}

/**
 * Type guard for success result
 */
export function isSuccess<T, E>(result: Result<T, E>): result is Success<T> {
  return result.success === true;
}

/**
 * Type guard for failure result
 */
export function isFailure<T, E>(result: Result<T, E>): result is Failure<E> {
  return result.success === false;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Make specific properties required
 */
export type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/**
 * Make specific properties optional
 */
export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

/**
 * Extract non-nullable properties
 */
export type NonNullableFields<T> = {
  [P in keyof T]: NonNullable<T[P]>;
};

/**
 * Deep partial type
 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/**
 * Deep readonly type
 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

// ============================================================================
// API Response Types
// ============================================================================

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  count: number;
  results: T[];
  offset?: number;
  limit?: number;
  has_more?: boolean;
  next_page?: string;
}

/**
 * Generic API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  meta?: {
    request_id?: string;
    timestamp?: number;
  };
}

// ============================================================================
// Exports
// ============================================================================

/**
 * Re-export all advanced types for easy access
 */
export type {
  Brand,
};
