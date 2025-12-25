/**
 * Query Builder Module
 * Provides GraphQL-like fluent API for building Etsy API queries
 */

import { EtsyClient } from './client';
import {
  EtsyListing,
  EtsyShopReceipt,
  ListingParams,
  ListingIncludes,
  GetShopReceiptsParams
} from './types';

// ============================================================================
// Types
// ============================================================================

export type SortOrder = 'asc' | 'desc';
export type ListingState = 'active' | 'inactive' | 'sold_out' | 'draft' | 'expired';
export type ListingSortOn = 'created' | 'price' | 'updated' | 'score';

// ============================================================================
// Listing Query Builder
// ============================================================================

/**
 * Fluent query builder for listings
 */
export class ListingQueryBuilder {
  private client: EtsyClient;
  private shopId?: string;
  private params: ListingParams = {};
  private includeFields: ListingIncludes[] = [];

  constructor(client: EtsyClient, shopId?: string) {
    this.client = client;
    this.shopId = shopId;
  }

  /**
   * Filter by listing state
   */
  where(filters: {
    state?: ListingState;
    shop_section_id?: number;
  }): this {
    if (filters.state) {
      this.params.state = filters.state;
    }
    return this;
  }

  /**
   * Include related data
   */
  include(fields: ListingIncludes[]): this {
    this.includeFields = fields;
    this.params.includes = fields;
    return this;
  }

  /**
   * Set limit for results
   */
  limit(limit: number): this {
    this.params.limit = limit;
    return this;
  }

  /**
   * Set offset for pagination
   */
  offset(offset: number): this {
    this.params.offset = offset;
    return this;
  }

  /**
   * Sort results
   */
  sortBy(field: ListingSortOn, order: SortOrder = 'asc'): this {
    this.params.sort_on = field as typeof this.params.sort_on;
    this.params.sort_order = (order === 'asc' ? 'up' : 'down') as typeof this.params.sort_order;
    return this;
  }

  /**
   * Execute the query
   */
  async fetch(): Promise<EtsyListing[]> {
    if (!this.shopId) {
      throw new Error('Shop ID is required for listing queries');
    }
    return this.client.getListingsByShop(this.shopId, this.params);
  }

  /**
   * Fetch a single result
   */
  async first(): Promise<EtsyListing | null> {
    this.params.limit = 1;
    const results = await this.fetch();
    return results[0] || null;
  }

  /**
   * Count results (fetches with limit 1 and returns count)
   */
  async count(): Promise<number> {
    const results = await this.fetch();
    return results.length;
  }
}

// ============================================================================
// Receipt Query Builder
// ============================================================================

/**
 * Fluent query builder for receipts
 */
export class ReceiptQueryBuilder {
  private client: EtsyClient;
  private shopId: string;
  private params: GetShopReceiptsParams = {};

  constructor(client: EtsyClient, shopId: string) {
    this.client = client;
    this.shopId = shopId;
  }

  /**
   * Filter receipts
   */
  where(filters: {
    was_paid?: boolean;
    was_shipped?: boolean;
    was_delivered?: boolean;
    min_created?: number;
    max_created?: number;
  }): this {
    Object.assign(this.params, filters);
    return this;
  }

  /**
   * Set limit for results
   */
  limit(limit: number): this {
    this.params.limit = limit;
    return this;
  }

  /**
   * Set offset for pagination
   */
  offset(offset: number): this {
    this.params.offset = offset;
    return this;
  }

  /**
   * Sort results
   */
  sortBy(field: 'created' | 'updated', order: SortOrder = 'desc'): this {
    this.params.sort_on = field as typeof this.params.sort_on;
    this.params.sort_order = (order === 'asc' ? 'up' : 'down') as typeof this.params.sort_order;
    return this;
  }

  /**
   * Execute the query
   */
  async fetch(): Promise<EtsyShopReceipt[]> {
    return this.client.getShopReceipts(this.shopId, this.params);
  }

  /**
   * Fetch a single result
   */
  async first(): Promise<EtsyShopReceipt | null> {
    this.params.limit = 1;
    const results = await this.fetch();
    return results[0] || null;
  }
}

// ============================================================================
// Batch Query Executor
// ============================================================================

/**
 * Batch multiple queries together for efficient execution
 */
export class BatchQueryExecutor {
  private client: EtsyClient;
  private operations: Array<() => Promise<unknown>> = [];

  constructor(client: EtsyClient) {
    this.client = client;
  }

  /**
   * Add a shop query to the batch
   */
  getShop(shopId: string): this {
    this.operations.push(() => this.client.getShop(shopId));
    return this;
  }

  /**
   * Add a listings query to the batch
   */
  getListings(shopId: string, params?: ListingParams): this {
    this.operations.push(() => this.client.getListingsByShop(shopId, params));
    return this;
  }

  /**
   * Add a receipts query to the batch
   */
  getReceipts(shopId: string, params?: GetShopReceiptsParams): this {
    this.operations.push(() => this.client.getShopReceipts(shopId, params));
    return this;
  }

  /**
   * Add a custom query to the batch
   */
  custom<T>(operation: () => Promise<T>): this {
    this.operations.push(operation);
    return this;
  }

  /**
   * Execute all queries in parallel
   */
  async execute(): Promise<unknown[]> {
    return Promise.all(this.operations.map(op => op()));
  }

  /**
   * Execute all queries sequentially
   */
  async executeSequential(): Promise<unknown[]> {
    const results: unknown[] = [];
    for (const operation of this.operations) {
      results.push(await operation());
    }
    return results;
  }

  /**
   * Clear all operations
   */
  clear(): this {
    this.operations = [];
    return this;
  }

  /**
   * Get number of operations in batch
   */
  size(): number {
    return this.operations.length;
  }
}

// ============================================================================
// Query Builder Factory (Mixin for EtsyClient)
// ============================================================================

/**
 * Extended EtsyClient with query builder methods
 */
export interface EtsyClientWithQueryBuilder extends EtsyClient {
  /**
   * Create a listing query builder
   */
  listings(shopId?: string): ListingQueryBuilder;

  /**
   * Create a receipt query builder
   */
  receipts(shopId: string): ReceiptQueryBuilder;

  /**
   * Create a batch query executor
   */
  batch(): BatchQueryExecutor;
}

/**
 * Add query builder methods to EtsyClient
 */
export function withQueryBuilder(client: EtsyClient): EtsyClientWithQueryBuilder {
  const extendedClient = client as EtsyClientWithQueryBuilder;

  extendedClient.listings = function(shopId?: string): ListingQueryBuilder {
    return new ListingQueryBuilder(this, shopId);
  };

  extendedClient.receipts = function(shopId: string): ReceiptQueryBuilder {
    return new ReceiptQueryBuilder(this, shopId);
  };

  extendedClient.batch = function(): BatchQueryExecutor {
    return new BatchQueryExecutor(this);
  };

  return extendedClient;
}

// ============================================================================
// Standalone Factory Functions
// ============================================================================

/**
 * Create a listing query builder
 */
export function createListingQuery(client: EtsyClient, shopId?: string): ListingQueryBuilder {
  return new ListingQueryBuilder(client, shopId);
}

/**
 * Create a receipt query builder
 */
export function createReceiptQuery(client: EtsyClient, shopId: string): ReceiptQueryBuilder {
  return new ReceiptQueryBuilder(client, shopId);
}

/**
 * Create a batch query executor
 */
export function createBatchQuery(client: EtsyClient): BatchQueryExecutor {
  return new BatchQueryExecutor(client);
}
