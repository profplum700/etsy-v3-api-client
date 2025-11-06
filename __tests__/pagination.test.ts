/**
 * Tests for Pagination Support (Phase 1)
 */

import { PaginatedResults, createPaginatedResults, PageFetcher } from '../src/pagination';
import { EtsyApiResponse } from '../src/types';

// Mock listing type for testing
interface MockListing {
  listing_id: number;
  title: string;
}

describe('PaginatedResults', () => {
  // Helper function to create a mock page fetcher
  const createMockFetcher = (totalItems: number): PageFetcher<MockListing> => {
    return async (limit: number, offset: number): Promise<EtsyApiResponse<MockListing>> => {
      const results: MockListing[] = [];
      const start = offset;
      const end = Math.min(offset + limit, totalItems);

      for (let i = start; i < end; i++) {
        results.push({
          listing_id: i,
          title: `Listing ${i}`
        });
      }

      return {
        count: totalItems,
        results
      };
    };
  };

  describe('constructor', () => {
    it('should create instance with default options', () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher);

      expect(paginated).toBeInstanceOf(PaginatedResults);
      expect(paginated.hasNextPage()).toBe(true);
    });

    it('should create instance with custom options', () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, {
        limit: 50,
        offset: 10,
        maxPages: 5
      });

      expect(paginated).toBeInstanceOf(PaginatedResults);
    });
  });

  describe('async iteration', () => {
    it('should iterate through all items', async () => {
      const fetcher = createMockFetcher(75);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      const items: MockListing[] = [];
      for await (const item of paginated) {
        items.push(item);
      }

      expect(items.length).toBe(75);
      expect(items[0].listing_id).toBe(0);
      expect(items[74].listing_id).toBe(74);
    });

    it('should respect maxPages option', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, {
        limit: 10,
        maxPages: 3
      });

      const items: MockListing[] = [];
      for await (const item of paginated) {
        items.push(item);
      }

      // 3 pages * 10 items = 30 items
      expect(items.length).toBe(30);
    });

    it('should respect maxItems option', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, {
        limit: 25,
        maxItems: 50
      });

      const items: MockListing[] = [];
      for await (const item of paginated) {
        items.push(item);
      }

      expect(items.length).toBe(50);
    });

    it('should handle empty results', async () => {
      const fetcher = createMockFetcher(0);
      const paginated = new PaginatedResults(fetcher);

      const items: MockListing[] = [];
      for await (const item of paginated) {
        items.push(item);
      }

      expect(items.length).toBe(0);
    });

    it('should handle offset correctly', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, {
        limit: 10,
        offset: 50
      });

      const items: MockListing[] = [];
      for await (const item of paginated) {
        items.push(item);
      }

      // Should start from item 50
      expect(items[0].listing_id).toBe(50);
      expect(items.length).toBe(50); // Items 50-99
    });
  });

  describe('getAll()', () => {
    it('should fetch all items at once', async () => {
      const fetcher = createMockFetcher(60);
      const paginated = new PaginatedResults(fetcher, { limit: 20 });

      const items = await paginated.getAll();

      expect(items.length).toBe(60);
      expect(items[0].listing_id).toBe(0);
      expect(items[59].listing_id).toBe(59);
    });

    it('should respect maxItems when fetching all', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, {
        limit: 25,
        maxItems: 40
      });

      const items = await paginated.getAll();

      expect(items.length).toBe(40);
    });
  });

  describe('getCurrentPage()', () => {
    it('should return empty array initially', () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher);

      expect(paginated.getCurrentPage()).toEqual([]);
    });

    it('should return current page after fetching', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      await paginated.getNextPage();
      const page = paginated.getCurrentPage();

      expect(page.length).toBe(25);
      expect(page[0].listing_id).toBe(0);
    });
  });

  describe('hasNextPage()', () => {
    it('should return true initially', () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher);

      expect(paginated.hasNextPage()).toBe(true);
    });

    it('should return false after all pages fetched', async () => {
      const fetcher = createMockFetcher(25);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      await paginated.getNextPage();

      expect(paginated.hasNextPage()).toBe(false);
    });

    it('should return false for empty results', async () => {
      const fetcher = createMockFetcher(0);
      const paginated = new PaginatedResults(fetcher);

      await paginated.getNextPage();

      expect(paginated.hasNextPage()).toBe(false);
    });
  });

  describe('getNextPage()', () => {
    it('should fetch next page of results', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      const page1 = await paginated.getNextPage();
      expect(page1.length).toBe(25);
      expect(page1[0].listing_id).toBe(0);

      const page2 = await paginated.getNextPage();
      expect(page2.length).toBe(25);
      expect(page2[0].listing_id).toBe(25);
    });

    it('should return empty array when no more pages', async () => {
      const fetcher = createMockFetcher(25);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      await paginated.getNextPage(); // Fetch first page
      const emptyPage = await paginated.getNextPage(); // Try to fetch second page

      expect(emptyPage).toEqual([]);
    });
  });

  describe('getTotalCount()', () => {
    it('should return null initially', () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher);

      expect(paginated.getTotalCount()).toBeNull();
    });

    it('should return total count after fetching', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher);

      await paginated.getNextPage();

      expect(paginated.getTotalCount()).toBe(100);
    });
  });

  describe('reset()', () => {
    it('should reset pagination state', async () => {
      const fetcher = createMockFetcher(100);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      // Fetch some pages
      await paginated.getNextPage();
      await paginated.getNextPage();

      expect(paginated.getTotalCount()).toBe(100);

      // Reset
      paginated.reset();

      expect(paginated.getTotalCount()).toBeNull();
      expect(paginated.getCurrentPage()).toEqual([]);
      expect(paginated.hasNextPage()).toBe(true);

      // Should be able to fetch from beginning again
      const page = await paginated.getNextPage();
      expect(page[0].listing_id).toBe(0);
    });
  });

  describe('createPaginatedResults helper', () => {
    it('should create PaginatedResults instance', () => {
      const fetcher = createMockFetcher(100);
      const paginated = createPaginatedResults(fetcher, { limit: 50 });

      expect(paginated).toBeInstanceOf(PaginatedResults);
    });
  });

  describe('edge cases', () => {
    it('should handle partial last page', async () => {
      const fetcher = createMockFetcher(65);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      const items: MockListing[] = [];
      for await (const item of paginated) {
        items.push(item);
      }

      expect(items.length).toBe(65);
    });

    it('should handle exactly one page of results', async () => {
      const fetcher = createMockFetcher(25);
      const paginated = new PaginatedResults(fetcher, { limit: 25 });

      const items = await paginated.getAll();

      expect(items.length).toBe(25);
      expect(paginated.hasNextPage()).toBe(false);
    });
  });
});
