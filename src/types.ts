/**
 * Core types for the Etsy API v3 client
 */

// ============================================================================
// Configuration Types
// ============================================================================

export interface EtsyClientConfig {
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
    minRequestInterval?: number;
  };
  caching?: {
    enabled: boolean;
    ttl?: number;
    storage?: CacheStorage;
  };
}

export interface AuthHelperConfig {
  keystring: string;
  redirectUri: string;
  scopes: string[];
  codeVerifier?: string;
  state?: string;
}

// ============================================================================
// Authentication Types
// ============================================================================

export interface EtsyTokens {
  access_token: string;
  refresh_token: string;
  expires_at: Date;
  token_type: string;
  scope: string;
}

export interface EtsyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
}

// ============================================================================
// Etsy API Response Types
// ============================================================================

export interface EtsyApiResponse<T> {
  count: number;
  results: T[];
}

export interface EtsyUser {
  user_id: number;
  shop_id?: number;
  login_name?: string;
  primary_email?: string;
  first_name?: string;
  last_name?: string;
  create_timestamp?: number;
  created_timestamp?: number;
  bio?: string;
  gender?: string;
  birth_month?: string;
  birth_day?: string;
  birth_year?: string;
  join_tsz?: number;
  city?: string;
  country_id?: number;
  region?: string;
  image_url_75x75?: string;
  num_favorers?: number;
}

export interface EtsyShop {
  shop_id: number;
  shop_name: string;
  user_id: number;
  create_date: number;
  title?: string;
  announcement?: string;
  currency_code: string;
  is_vacation: boolean;
  vacation_message?: string;
  sale_message?: string;
  digital_sale_message?: string;
  last_updated_tsz: number;
  listing_active_count: number;
  digital_listing_count: number;
  login_name: string;
  accepts_custom_requests: boolean;
  policy_welcome?: string;
  policy_payment?: string;
  policy_shipping?: string;
  policy_refunds?: string;
  policy_additional?: string;
  policy_seller_info?: string;
  policy_updated_tsz?: number;
  policy_has_private_receipt_info: boolean;
  has_unstructured_policies: boolean;
  policy_privacy?: string;
  vacation_autoreply?: string;
  url: string;
  image_url_760x100?: string;
  num_favorers: number;
  languages: string[];
  upcoming_local_event_id?: number;
  icon_url_fullxfull?: string;
  is_using_structured_policies: boolean;
  has_onboarded_structured_policies: boolean;
  include_dispute_form_link: boolean;
  is_direct_checkout_onboarded: boolean;
  is_calculated_eligible: boolean;
  is_opted_in_to_buyer_promise: boolean;
  is_shop_us_based: boolean;
  transaction_sold_count: number;
  shipping_from_country_iso: string;
  shop_location_country_iso: string;
  review_count: number;
  review_average: number;
}

export interface EtsyShopSection {
  shop_section_id: number;
  title: string;
  rank: number;
  user_id: number;
  active_listing_count: number;
}

export interface EtsyListing {
  listing_id: number;
  title: string;
  description?: string;
  price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  url: string;
  images?: Array<{
    url_570xN: string;
    alt_text?: string;
  }>;
  when_made?: string;
  shop_section_id?: number;
  tags?: string[];
  materials?: string[];
  style?: string[];
  item_length?: number;
  item_width?: number;
  item_height?: number;
  item_dimensions_unit?: string;
  state?: 'active' | 'inactive' | 'draft' | 'expired';
  creation_tsz?: number;
  ending_tsz?: number;
  original_creation_tsz?: number;
  last_modified_tsz?: number;
  views?: number;
  num_favorers?: number;
  shop_id?: number;
  user_id?: number;
  category_id?: number;
  is_supply?: boolean;
  is_private?: boolean;
  recipient?: string;
  occasion?: string;
  style_id?: number[];
  non_taxable?: boolean;
  is_customizable?: boolean;
  is_digital?: boolean;
  file_data?: string;
  can_write_inventory?: boolean;
  has_variations?: boolean;
  should_auto_renew?: boolean;
  language?: string;
  processing_min?: number;
  processing_max?: number;
  who_made?: string;
  is_mass_produced?: boolean;
  item_weight?: number;
  item_weight_unit?: string;
  shipping_template_id?: number;
  featured_rank?: number;
  skus?: string[];
  used_manufacturer?: boolean;
}

export interface EtsyListingImage {
  listing_image_id: number;
  hex_code?: string;
  red?: number;
  green?: number;
  blue?: number;
  hue?: number;
  saturation?: number;
  brightness?: number;
  is_black_and_white?: boolean;
  creation_tsz?: number;
  listing_id?: number;
  rank?: number;
  url_75x75?: string;
  url_170x135?: string;
  url_570xN?: string;
  url_fullxfull?: string;
  full_height?: number;
  full_width?: number;
  alt_text?: string;
}

export interface EtsyListingInventory {
  products: EtsyListingProduct[];
  price_on_property?: number[];
  quantity_on_property?: number[];
  sku_on_property?: number[];
}

export interface EtsyListingProduct {
  product_id: number;
  sku?: string;
  is_deleted?: boolean;
  offerings: EtsyListingOffering[];
  property_values?: EtsyListingPropertyValue[];
}

export interface EtsyListingOffering {
  offering_id: number;
  price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  quantity: number;
  is_enabled: boolean;
  is_deleted: boolean;
}

export interface EtsyListingPropertyValue {
  property_id: number;
  property_name: string;
  scale_id?: number;
  scale_name?: string;
  value_ids?: number[];
  values?: string[];
}


// ============================================================================
// API Method Parameters
// ============================================================================

export interface ListingParams {
  limit?: number;
  offset?: number;
  state?: 'active' | 'inactive' | 'draft' | 'expired';
  sort_on?: 'created' | 'ending' | 'price' | 'views' | 'score';
  sort_order?: 'up' | 'down';
  includes?: string[];
}

export interface SearchParams {
  keywords?: string;
  category?: string;
  limit?: number;
  offset?: number;
  sort_on?: 'created' | 'price' | 'score';
  sort_order?: 'up' | 'down';
  min_price?: number;
  max_price?: number;
  tags?: string[];
  location?: string;
  shop_location?: string;
}

// ============================================================================
// Rate Limiting Types
// ============================================================================

export interface RateLimitConfig {
  maxRequestsPerDay: number;
  maxRequestsPerSecond: number;
  minRequestInterval: number;
}

export interface RateLimitStatus {
  remainingRequests: number;
  resetTime: Date;
  canMakeRequest: boolean;
}

// ============================================================================
// Error Types
// ============================================================================

export class EtsyApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: unknown
  ) {
    super(message);
    this.name = 'EtsyApiError';
  }
}

export class EtsyAuthError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'EtsyAuthError';
  }
}

export class EtsyRateLimitError extends Error {
  constructor(message: string, public retryAfter?: number) {
    super(message);
    this.name = 'EtsyRateLimitError';
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export interface CacheStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface LoggerInterface {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Valid values for the when_made field in Etsy listings
 */
export const ETSY_WHEN_MADE_VALUES = [
  '1990s',
  '1980s',
  '1970s',
  '1960s',
  '1950s',
  '1940s',
  '1930s',
  '1920s',
  '1910s',
  '1900s',
  '1800s',
  '1700s',
  'before_1700'
] as const;