/**
 * Advanced Pagination Support for Etsy API v3 Client
 * Provides automatic pagination with async iteration support
 */

import { EtsyApiResponse } from './types';

/**
 * Configuration options for paginated requests
 */
export interface PaginationOptions {
  /**
   * Number of items per page (default: 25)
   */
  limit?: number;

  /**
   * Initial offset (default: 0)
   */
  offset?: number;

  /**
   * Maximum number of pages to fetch (optional, for safety)
   */
  maxPages?: number;

  /**
   * Maximum total items to fetch (optional, for safety)
   */
  maxItems?: number;
}

/**
 * Function type for fetching a page of data
 */
export type PageFetcher<T> = (limit: number, offset: number) => Promise<EtsyApiResponse<T>>;

/**
 * Paginated results class with async iteration support
 * @example
 * ```typescript
 * const listings = new PaginatedResults(
 *   (limit, offset) => client.getListingsByShop('123', { limit, offset })
 * );
 *
 * // Iterate through all items
 * for await (const listing of listings) {
 *   console.log(listing.title);
 * }
 *
 * // Or get all at once
 * const allListings = await listings.getAll();
 * ```
 */
export class PaginatedResults<T> implements AsyncIterable<T> {
  private fetcher: PageFetcher<T>;
  private options: Required<PaginationOptions>;
  private currentPage: T[] = [];
  private currentOffset: number;
  private totalCount: number | null = null;
  private hasMore: boolean = true;

  constructor(fetcher: PageFetcher<T>, options: PaginationOptions = {}) {
    this.fetcher = fetcher;
    this.options = {
      limit: options.limit || 25,
      offset: options.offset || 0,
      maxPages: options.maxPages || Infinity,
      maxItems: options.maxItems || Infinity
    };
    this.currentOffset = this.options.offset;
  }

  /**
   * Async iterator implementation - allows for await...of loops
   */
  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let pageCount = 0;
    let itemCount = 0;

    while (this.hasMore && pageCount < this.options.maxPages && itemCount < this.options.maxItems) {
      const page = await this.fetchPage();
      pageCount++;

      for (const item of page) {
        if (itemCount >= this.options.maxItems) {
          return;
        }
        yield item;
        itemCount++;
      }

      if (!this.hasMore) {
        break;
      }
    }
  }

  /**
   * Fetch all items across all pages
   * @returns Array of all items
   */
  async getAll(): Promise<T[]> {
    const items: T[] = [];
    for await (const item of this) {
      items.push(item);
    }
    return items;
  }

  /**
   * Get the current page of results
   */
  getCurrentPage(): T[] {
    return this.currentPage;
  }

  /**
   * Check if there are more pages to fetch
   */
  hasNextPage(): boolean {
    return this.hasMore;
  }

  /**
   * Get the next page of results
   * @returns Array of items in the next page
   */
  async getNextPage(): Promise<T[]> {
    if (!this.hasMore) {
      return [];
    }
    return this.fetchPage();
  }

  /**
   * Get the count from the last fetched page
   * NOTE: This is NOT the total available items, but rather the number of items
   * returned in the most recent page. Etsy's API does not provide total count.
   * Returns null if no pages have been fetched yet.
   *
   * @deprecated This method does not return total count as originally intended.
   * It will be removed in a future version.
   */
  getTotalCount(): number | null {
    return this.totalCount;
  }

  /**
   * Reset pagination to the beginning
   */
  reset(): void {
    this.currentOffset = this.options.offset;
    this.currentPage = [];
    this.totalCount = null;
    this.hasMore = true;
  }

  /**
   * Internal method to fetch a single page
   */
  private async fetchPage(): Promise<T[]> {
    const response = await this.fetcher(this.options.limit, this.currentOffset);

    this.currentPage = response.results;
    // Note: response.count is the number of items in the current page, not total available
    this.totalCount = response.count;

    // Determine if there are more pages:
    // 1. If pagination.next_offset is provided, there are more pages (Etsy API standard)
    // 2. If pagination exists but next_offset is not present, no more pages
    // 3. If no pagination metadata, fall back to checking results length
    if (response.pagination) {
      if (response.pagination.next_offset !== undefined) {
        // Etsy provides explicit next_offset - there are more pages
        this.hasMore = true;
        this.currentOffset = response.pagination.next_offset;
      } else {
        // Pagination exists but no next_offset - we're at the end
        this.hasMore = false;
      }
    } else {
      // No pagination metadata - fall back to checking page size
      // If we got fewer results than the limit, we've reached the end
      this.hasMore = response.results.length === this.options.limit;
      // Calculate next offset
      this.currentOffset += this.options.limit;
    }

    return this.currentPage;
  }
}

/**
 * Helper function to create a paginated result set
 * @param fetcher Function that fetches a page of data
 * @param options Pagination options
 * @returns PaginatedResults instance
 */
export function createPaginatedResults<T>(
  fetcher: PageFetcher<T>,
  options?: PaginationOptions
): PaginatedResults<T> {
  return new PaginatedResults(fetcher, options);
}
