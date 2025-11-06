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
   
  refreshSave?: (_accessToken: string, _refreshToken: string, _expiresAt: Date) => void;
  
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

// Token Management Types

export type TokenRefreshCallback = (_accessToken: string, _refreshToken: string, _expiresAt: Date) => void;

export type TokenRotationCallback = (oldTokens: EtsyTokens, newTokens: EtsyTokens) => void | Promise<void>;

export interface TokenStorage {

  save(_tokens: EtsyTokens): Promise<void>;
  load(): Promise<EtsyTokens | null>;
  clear(): Promise<void>;
}

/**
 * Configuration for proactive token rotation
 */
export interface TokenRotationConfig {
  /**
   * Enable automatic proactive token rotation
   * @default false
   */
  enabled: boolean;

  /**
   * Rotate tokens this many milliseconds before they expire
   * @default 900000 (15 minutes)
   */
  rotateBeforeExpiry: number;

  /**
   * Callback function called when tokens are rotated
   * Useful for notifying other services or logging
   */
  onRotation?: TokenRotationCallback;

  /**
   * Automatically schedule background rotation checks
   * @default false
   */
  autoSchedule?: boolean;

  /**
   * Interval in milliseconds for checking if rotation is needed (only when autoSchedule is true)
   * @default 60000 (1 minute)
   */
  checkInterval?: number;
}

// ============================================================================
// Etsy API Response Types
// ============================================================================

/**
 * Pagination metadata from Etsy API responses
 */
export interface EtsyPagination {
  /**
   * Offset for the next page of results
   */
  next_offset?: number;

  /**
   * Effective limit used for this request
   */
  effective_limit?: number;

  /**
   * Effective offset used for this request
   */
  effective_offset?: number;
}

export interface EtsyApiResponse<T> {
  /**
   * Number of items returned in the current page (not total available)
   */
  count: number;

  /**
   * Array of result items
   */
  results: T[];

  /**
   * Pagination metadata (only present in paginated responses)
   */
  pagination?: EtsyPagination;
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

export interface EtsySellerTaxonomyNode {
  id: number;
  level: number;
  name: string;
  parent_id: number | null;
  children: EtsySellerTaxonomyNode[];
  full_path_taxonomy_ids: number[];
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

/**
 * Structured error details from Etsy API
 */
export interface EtsyErrorDetails {
  statusCode: number;
  errorCode?: string;
  field?: string;
  suggestion?: string;
  retryAfter?: number;
}

export class EtsyApiError extends Error {
  public details: EtsyErrorDetails;

  constructor(
    message: string,
    public _statusCode?: number,
    public _response?: unknown,
    public _retryAfter?: number
  ) {
    super(message);
    this.name = 'EtsyApiError';

    // Initialize structured error details
    this.details = {
      statusCode: _statusCode || 0,
      retryAfter: _retryAfter
    };

    // Try to extract additional details from response
    if (_response && typeof _response === 'object') {
      const resp = _response as Record<string, unknown>;
      this.details.errorCode = (resp.error_code || resp.code) as string | undefined;
      this.details.field = resp.field as string | undefined;
      this.details.suggestion = (resp.suggestion || resp.message) as string | undefined;
    }
  }

  /**
   * HTTP status code associated with the error, if available.
   */
  get statusCode(): number | undefined {
    return this._statusCode;
  }

  /**
   * Raw response body returned by the Etsy API, if available.
   */
  get response(): unknown | undefined {
    return this._response;
  }

  /**
   * Check if this error is retryable
   * @returns true if the error indicates a transient failure that can be retried
   */
  isRetryable(): boolean {
    if (!this._statusCode) {
      return false;
    }

    // Rate limiting errors are retryable
    if (this._statusCode === 429) {
      return true;
    }

    // Server errors (5xx) are generally retryable
    if (this._statusCode >= 500 && this._statusCode < 600) {
      return true;
    }

    // Specific retryable client errors
    const retryableClientErrors = [408, 409, 423, 425];
    if (retryableClientErrors.includes(this._statusCode)) {
      return true;
    }

    return false;
  }

  /**
   * Get the retry-after value in seconds (for rate limit errors)
   * @returns Number of seconds to wait before retrying, or null if not specified
   */
  getRetryAfter(): number | null {
    return this._retryAfter || null;
  }

  /**
   * Get the rate limit reset time (for rate limit errors)
   * @returns Date when the rate limit resets, or null if not a rate limit error
   */
  getRateLimitReset(): Date | null {
    if (this._statusCode !== 429 || !this._retryAfter) {
      return null;
    }

    // Calculate reset time based on retry-after
    return new Date(Date.now() + this._retryAfter * 1000);
  }

  /**
   * Get a user-friendly error message with suggestions
   */
  getUserFriendlyMessage(): string {
    let message = this.message;

    // Add suggestion if available
    if (this.details.suggestion) {
      message += `\nSuggestion: ${this.details.suggestion}`;
    }

    // Add retry information
    if (this.isRetryable()) {
      const retryAfter = this.getRetryAfter();
      if (retryAfter) {
        message += `\nRetry after ${retryAfter} seconds.`;
      } else {
        message += '\nThis error can be retried.';
      }
    }

    return message;
  }
}

export class EtsyAuthError extends Error {
  constructor(message: string, public _code?: string) {
    super(message);
    this.name = 'EtsyAuthError';
  }

  /**
   * OAuth / auth error code returned by Etsy, if provided.
   */
  get code(): string | undefined {
    return this._code;
  }
}

export class EtsyRateLimitError extends Error {
  constructor(message: string, public _retryAfter?: number) {
    super(message);
    this.name = 'EtsyRateLimitError';
  }

  /**
   * Number of seconds suggested by Etsy to wait before retrying the request.
   */
  get retryAfter(): number | undefined {
    return this._retryAfter;
  }
}

// ============================================================================
// Utility Types
// ============================================================================

export interface CacheStorage {
   
  get(_key: string): Promise<string | null>;
   
  set(_key: string, _value: string, _ttl?: number): Promise<void>;
   
  delete(_key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface LoggerInterface {
   
  debug(_message: string, ..._args: unknown[]): void;
   
  info(_message: string, ..._args: unknown[]): void;
   
  warn(_message: string, ..._args: unknown[]): void;
   
  error(_message: string, ..._args: unknown[]): void;
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

// ============================================================================
// Shop Management Types
// ============================================================================

export interface UpdateShopParams {
  title?: string;
  announcement?: string;
  sale_message?: string;
  digital_sale_message?: string;
}

export interface CreateShopSectionParams {
  title: string;
}

export interface UpdateShopSectionParams {
  title: string;
}

// ============================================================================
// Shop Receipts/Orders Types
// ============================================================================

export interface EtsyShopReceipt {
  receipt_id: number;
  receipt_type: number;
  seller_user_id: number;
  seller_email: string;
  buyer_user_id: number;
  buyer_email: string;
  name: string;
  first_line: string;
  second_line?: string;
  city: string;
  state?: string;
  zip: string;
  status: 'open' | 'completed' | 'payment-processing' | 'canceled';
  formatted_address: string;
  country_iso: string;
  payment_method: string;
  payment_email?: string;
  message_from_seller?: string;
  message_from_buyer?: string;
  message_from_payment?: string;
  is_paid: boolean;
  is_shipped: boolean;
  create_timestamp: number;
  created_timestamp: number;
  update_timestamp: number;
  updated_timestamp: number;
  is_gift: boolean;
  gift_message?: string;
  grandtotal: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  subtotal: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  total_price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  total_shipping_cost: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  total_tax_cost: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  total_vat_cost: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  discount_amt: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  gift_wrap_price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  shipments?: EtsyShopReceiptShipment[];
  transactions?: EtsyShopReceiptTransaction[];
  refunds?: EtsyShopRefund[];
}

export interface EtsyShopReceiptTransaction {
  transaction_id: number;
  title: string;
  description: string;
  seller_user_id: number;
  buyer_user_id: number;
  create_timestamp: number;
  created_timestamp: number;
  paid_timestamp: number;
  shipped_timestamp: number;
  quantity: number;
  listing_image_id?: number;
  receipt_id: number;
  is_digital: boolean;
  file_data: string;
  listing_id: number;
  transaction_type: string;
  product_id?: number;
  sku?: string;
  price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  shipping_cost: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  variations?: EtsyTransactionVariation[];
  product_data?: EtsyListingProduct[];
  shipping_profile_id?: number;
  min_processing_days?: number;
  max_processing_days?: number;
  shipping_method?: string;
  shipping_upgrade?: string;
  expected_ship_date?: number;
  buyer_coupon?: number;
  shop_coupon?: number;
}

export interface EtsyTransactionVariation {
  property_id: number;
  value_id: number;
  formatted_name: string;
  formatted_value: string;
}

export interface EtsyShopReceiptShipment {
  receipt_shipping_id: number;
  shipment_notification_timestamp: number;
  carrier_name: string;
  tracking_code: string;
}

export interface EtsyShopRefund {
  amount: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  created_timestamp: number;
  reason?: string;
  note_from_issuer?: string;
  status: string;
}

export interface GetShopReceiptsParams {
  limit?: number;
  offset?: number;
  sort_on?: 'created' | 'updated' | 'paid';
  sort_order?: 'up' | 'down';
  min_created?: number;
  max_created?: number;
  min_last_modified?: number;
  max_last_modified?: number;
  was_paid?: boolean;
  was_shipped?: boolean;
  was_delivered?: boolean;
}

export interface UpdateShopReceiptParams {
  was_shipped?: boolean;
  was_paid?: boolean;
  message_from_seller?: string;
}

// ============================================================================
// Shipping Profile Types
// ============================================================================

export interface EtsyShippingProfile {
  shipping_profile_id: number;
  title: string;
  user_id: number;
  min_processing_days: number;
  max_processing_days: number;
  processing_days_display_label: string;
  origin_country_iso: string;
  origin_postal_code?: string;
  profile_type: 'manual' | 'calculated';
  domestic_handling_fee?: number;
  international_handling_fee?: number;
  shipping_profile_destinations?: EtsyShippingProfileDestination[];
  shipping_profile_upgrades?: EtsyShippingProfileUpgrade[];
}

export interface EtsyShippingProfileDestination {
  shipping_profile_destination_id: number;
  shipping_profile_id: number;
  origin_country_iso: string;
  destination_country_iso?: string;
  destination_region: string;
  primary_cost: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  secondary_cost: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  shipping_carrier_id?: number;
  mail_class?: string;
  min_delivery_days?: number;
  max_delivery_days?: number;
}

export interface EtsyShippingProfileUpgrade {
  shipping_profile_id: number;
  upgrade_id: number;
  upgrade_name: string;
  type: string;
  rank: number;
  language: string;
  price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  secondary_price: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  shipping_carrier_id: number;
  mail_class?: string;
  min_delivery_days?: number;
  max_delivery_days?: number;
}

export interface CreateShippingProfileParams {
  title: string;
  origin_country_iso: string;
  primary_cost: number;
  secondary_cost: number;
  min_processing_days: number;
  max_processing_days: number;
  processing_days_display_label?: string;
  origin_postal_code?: string;
  destination_country_iso?: string;
  destination_region?: string;
  mail_class?: string;
  min_delivery_days?: number;
  max_delivery_days?: number;
}

export interface UpdateShippingProfileParams {
  title?: string;
  origin_country_iso?: string;
  min_processing_days?: number;
  max_processing_days?: number;
  processing_days_display_label?: string;
  origin_postal_code?: string;
}

export interface CreateShippingProfileDestinationParams {
  primary_cost: number;
  secondary_cost: number;
  destination_country_iso?: string;
  destination_region?: string;
  mail_class?: string;
  min_delivery_days?: number;
  max_delivery_days?: number;
}

export interface UpdateShippingProfileDestinationParams {
  primary_cost?: number;
  secondary_cost?: number;
  destination_country_iso?: string;
  destination_region?: string;
  mail_class?: string;
  min_delivery_days?: number;
  max_delivery_days?: number;
}

export interface CreateReceiptShipmentParams {
  tracking_code: string;
  carrier_name: string;
  send_bcc?: boolean;
  note_to_buyer?: string;
}

// ============================================================================
// Payment & Ledger Types
// ============================================================================

export interface EtsyPaymentAccountLedgerEntry {
  entry_id: number;
  ledger_id: number;
  sequence_number: number;
  amount: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  currency: string;
  description: string;
  balance: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  create_date: number;
  created_timestamp: number;
  ledger_type: string;
  entry_type: string;
  reference_type?: string;
  reference_id?: string;
  payment_adjustments?: EtsyPaymentAdjustment[];
}

export interface EtsyPaymentAdjustment {
  payment_adjustment_id: number;
  payment_id: number;
  status: string;
  is_success: boolean;
  user_id: number;
  reason_code: string;
  total_adjustment_amount: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  shop_total_adjustment_amount: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  buyer_total_adjustment_amount: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  total_fee_adjustment_amount: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  create_timestamp: number;
  created_timestamp: number;
  update_timestamp: number;
  updated_timestamp: number;
}

export interface EtsyPayment {
  payment_id: number;
  buyer_user_id: number;
  shop_id: number;
  receipt_id: number;
  amount_gross: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  amount_fees: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  amount_net: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  posted_gross: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  posted_fees: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  posted_net: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  adjusted_gross: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  adjusted_fees: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  adjusted_net: {
    amount: number;
    divisor: number;
    currency_code: string;
  };
  currency: string;
  shop_currency: string;
  buyer_currency: string;
  shipping_user_id?: number;
  shipping_address_id?: number;
  billing_address_id: number;
  status: string;
  shipped_timestamp?: number;
  create_timestamp: number;
  created_timestamp: number;
  update_timestamp: number;
  updated_timestamp: number;
  payment_adjustments?: EtsyPaymentAdjustment[];
}

export interface GetPaymentAccountLedgerEntriesParams {
  min_created: number;
  max_created: number;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Listing Write Operations Types
// ============================================================================

export interface CreateDraftListingParams {
  quantity: number;
  title: string;
  description: string;
  price: number;
  who_made: 'i_did' | 'someone_else' | 'collective';
  when_made: typeof ETSY_WHEN_MADE_VALUES[number] | 'made_to_order';
  taxonomy_id: number;
  shipping_profile_id?: number;
  return_policy_id?: number;
  materials?: string[];
  shop_section_id?: number;
  processing_min?: number;
  processing_max?: number;
  tags?: string[];
  styles?: string[];
  item_weight?: number;
  item_length?: number;
  item_width?: number;
  item_height?: number;
  item_weight_unit?: 'oz' | 'lb' | 'g' | 'kg';
  item_dimensions_unit?: 'in' | 'ft' | 'mm' | 'cm' | 'm' | 'yd' | 'inches';
  is_personalizable?: boolean;
  personalization_is_required?: boolean;
  personalization_char_count_max?: number;
  personalization_instructions?: string;
  production_partner_ids?: number[];
  image_ids?: number[];
  is_supply?: boolean;
  is_customizable?: boolean;
  is_taxable?: boolean;
  type?: 'physical' | 'download' | 'both';
}

export interface UpdateListingParams {
  image_ids?: number[];
  title?: string;
  description?: string;
  materials?: string[];
  should_auto_renew?: boolean;
  shipping_profile_id?: number;
  return_policy_id?: number;
  shop_section_id?: number;
  item_weight?: number;
  item_length?: number;
  item_width?: number;
  item_height?: number;
  item_weight_unit?: 'oz' | 'lb' | 'g' | 'kg';
  item_dimensions_unit?: 'in' | 'ft' | 'mm' | 'cm' | 'm' | 'yd' | 'inches';
  is_taxable?: boolean;
  taxonomy_id?: number;
  tags?: string[];
  who_made?: 'i_did' | 'someone_else' | 'collective';
  when_made?: typeof ETSY_WHEN_MADE_VALUES[number] | 'made_to_order';
  featured_rank?: number;
  is_personalizable?: boolean;
  personalization_is_required?: boolean;
  personalization_char_count_max?: number;
  personalization_instructions?: string;
  state?: 'active' | 'inactive' | 'draft';
  is_supply?: boolean;
  production_partner_ids?: number[];
  type?: 'physical' | 'download' | 'both';
  styles?: string[];
  processing_min?: number;
  processing_max?: number;
}

export interface UpdateListingInventoryParams {
  products: Array<{
    sku?: string;
    property_values?: Array<{
      property_id: number;
      property_name?: string;
      scale_id?: number;
      scale_name?: string;
      value_ids?: number[];
      values?: string[];
    }>;
    offerings: Array<{
      offering_id?: number;
      price: number;
      quantity: number;
      is_enabled: boolean;
    }>;
  }>;
  price_on_property?: number[];
  quantity_on_property?: number[];
  sku_on_property?: number[];
}

// ============================================================================
// Listing Property Types
// ============================================================================

export interface EtsyListingProperty {
  property_id: number;
  name: string;
  display_name: string;
  scales?: EtsyListingPropertyScale[];
  possible_values?: EtsyListingPropertyValue[];
  selected_values?: EtsyListingPropertyValue[];
  supports_attributes?: boolean;
  supports_variations?: boolean;
  is_multivalued?: boolean;
  is_required?: boolean;
  max_values_allowed?: number;
}

export interface EtsyListingPropertyScale {
  scale_id: number;
  display_name: string;
  description?: string;
}

// ============================================================================
// Taxonomy Types (Extended)
// ============================================================================

export interface EtsyBuyerTaxonomyNode {
  id: number;
  level: number;
  name: string;
  parent_id: number | null;
  children: EtsyBuyerTaxonomyNode[];
  full_path_taxonomy_ids: number[];
}

export interface EtsyBuyerTaxonomyPropertyScale {
  scale_id: number;
  display_name: string;
  description?: string;
}

export interface EtsyBuyerTaxonomyPropertyValue {
  value_id: number;
  name: string;
  scale_id?: number;
  equal_to?: number[];
}

export interface EtsyBuyerTaxonomyProperty {
  property_id: number;
  name: string;
  display_name: string;
  scales?: EtsyBuyerTaxonomyPropertyScale[];
  possible_values?: EtsyBuyerTaxonomyPropertyValue[];
  selected_values?: EtsyBuyerTaxonomyPropertyValue[];
  supports_attributes: boolean;
  supports_variations: boolean;
  is_multivalued: boolean;
  is_required: boolean;
  max_values_allowed?: number;
}

// ============================================================================
// Shop Production Partner Types
// ============================================================================

export interface EtsyShopProductionPartner {
  production_partner_id: number;
  partner_name: string;
  location: string;
}

// ============================================================================
// File Upload Types
// ============================================================================

export interface UploadListingImageParams {
  image: File | Blob | Buffer;
  listing_id: number;
  rank?: number;
  overwrite?: boolean;
  is_watermarked?: boolean;
  alt_text?: string;
}

export interface UploadListingFileParams {
  file: File | Blob | Buffer;
  listing_id: number;
  name?: string;
  rank?: number;
}